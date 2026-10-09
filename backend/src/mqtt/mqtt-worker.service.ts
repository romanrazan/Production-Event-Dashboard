import { randomBytes } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import mqtt, { MqttClient } from "mqtt";
import { MqttService } from "./mqtt.service";

export interface WorkerStatus {
  enabled: boolean;
  connected: boolean;
  subscribed: boolean;
  broker_url: string;
  candidate_id: string;
  client_id: string | null;
  topics: { challenge: string; response: string; status: string };
  last_connected_at: string | null;
  last_heartbeat_at: string | null;
  reconnect_attempts: number;
  last_challenge_id: string | null;
  last_challenge_at: string | null;
  last_response_status: string | null;
  last_error: string | null;
}

const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Lifecycle-managed MQTT client inside the single backend process. All business decisions
 * are delegated to MqttService -> ProductionEventsService, the same path REST uses.
 */
@Injectable()
export class MqttWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttWorkerService.name);
  private client: MqttClient | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopping = false;
  private flushing = false;
  private reconnectDelay = 1000;
  /** Messages are handled one at a time, in delivery order. */
  private queue: Promise<void> = Promise.resolve();
  private readonly enabled = process.env.MQTT_ENABLED?.toLowerCase() === "true";
  private readonly broker = process.env.MQTT_BROKER_URL ?? "mqtt://152.42.238.142:1883";
  private readonly heartbeatMs = Math.min(Math.max(Number(process.env.MQTT_HEARTBEAT_MS ?? 30_000) || 30_000, 1000), 30_000);
  private readonly clientId: string;
  private readonly challengeTopic: string;
  private readonly responseTopic: string;
  private readonly statusTopic: string;
  private status: WorkerStatus;

  constructor(private readonly mqtt: MqttService) {
    this.clientId = `fse01-${mqtt.candidateId}-${randomBytes(3).toString("hex")}`;
    this.challengeTopic = `fse-01/${mqtt.candidateId}/challenge`;
    this.responseTopic = `fse-01/${mqtt.candidateId}/response`;
    this.statusTopic = `fse-01/${mqtt.candidateId}/status`;
    this.status = {
      enabled: this.enabled, connected: false, subscribed: false, broker_url: this.broker,
      candidate_id: mqtt.candidateId, client_id: this.enabled ? this.clientId : null,
      topics: { challenge: this.challengeTopic, response: this.responseTopic, status: this.statusTopic },
      last_connected_at: null, last_heartbeat_at: null, reconnect_attempts: 0,
      last_challenge_id: null, last_challenge_at: null, last_response_status: null, last_error: null,
    };
  }

  onModuleInit() {
    if (this.enabled) this.connect();
  }

  private connect() {
    this.client = mqtt.connect(this.broker, {
      clientId: this.clientId,
      protocolVersion: 4,
      reconnectPeriod: 0, // reconnects are scheduled by this worker with bounded backoff
      clean: true,
      connectTimeout: 10_000,
      will: { topic: this.statusTopic, payload: Buffer.from(this.statusPayload("OFFLINE")), qos: 1, retain: false },
    });
    this.client.on("connect", () => this.onConnect());
    this.client.on("message", (topic, payload) => {
      this.queue = this.queue.then(() => this.onMessage(topic, payload)).catch(() => undefined);
    });
    this.client.on("error", (error) => { this.status.last_error = error.message; });
    this.client.on("close", () => this.onClose());
  }

  private onConnect() {
    this.status.connected = true;
    this.status.last_connected_at = new Date().toISOString();
    this.status.last_error = null;
    this.reconnectDelay = 1000;
    this.logger.log(`Connected to ${this.broker} as ${this.clientId}`);
    this.client?.subscribe(this.challengeTopic, { qos: 1 }, (error) => {
      if (error) { this.status.last_error = `Subscribe failed: ${error.message}`; return; }
      this.status.subscribed = true;
      void this.publishStatus("ONLINE").catch((reason: Error) => { this.status.last_error = reason.message; });
      this.startHeartbeat();
      void this.flushUnpublished();
    });
  }

  private onClose() {
    const wasConnected = this.status.connected;
    this.status.connected = false;
    this.status.subscribed = false;
    this.stopHeartbeat();
    if (this.stopping || this.reconnectTimer) return;
    if (wasConnected) this.logger.warn("MQTT connection closed; scheduling reconnect");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.stopping) return;
      this.status.reconnect_attempts += 1;
      this.client?.reconnect(); // resubscription happens in onConnect
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  private async onMessage(topic: string, payload: Buffer) {
    if (topic !== this.challengeTopic) return;
    this.status.last_challenge_at = new Date().toISOString();
    let raw: unknown;
    try { raw = JSON.parse(payload.toString("utf8")); }
    catch { raw = payload.toString("utf8"); }

    let storageId: string | null = null;
    let serialized: string;
    try {
      const handled = await this.mqtt.handleMqttChallenge(raw);
      storageId = handled.storageId;
      serialized = JSON.stringify(handled.response);
      this.status.last_challenge_id = handled.response.challenge_id;
      this.status.last_response_status = handled.response.status;
    } catch (error) {
      // Nothing was committed, so a redelivery can still be processed; answer with INTERNAL_ERROR.
      const message = error instanceof Error ? error.message : "Unknown MQTT processing error";
      this.status.last_error = message;
      this.logger.error(`Challenge processing failed: ${message}`);
      const response = this.mqtt.internalError(raw);
      this.status.last_challenge_id = response.challenge_id;
      this.status.last_response_status = "FAILED";
      serialized = JSON.stringify(response);
    }

    // Publish strictly after commit. A failed publish keeps the durable response for retry.
    try {
      await this.publish(this.responseTopic, serialized);
      await this.mqtt.recordPublish(storageId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish failed";
      this.status.last_error = `Response publish failed: ${message}`;
      await this.mqtt.recordPublish(storageId, message).catch(() => undefined);
    }
  }

  /** Republishes stored responses whose publication was never confirmed (e.g. broker dropped mid-publish). */
  async flushUnpublished(): Promise<number> {
    if (this.flushing || !this.client?.connected) return 0;
    this.flushing = true;
    let published = 0;
    try {
      for (const item of await this.mqtt.unpublishedResponses()) {
        try {
          await this.publish(this.responseTopic, item.payload);
          await this.mqtt.recordPublish(item.storageId);
          published += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Publish failed";
          await this.mqtt.recordPublish(item.storageId, message).catch(() => undefined);
          break;
        }
      }
    } catch (error) {
      this.status.last_error = error instanceof Error ? error.message : "Publish retry failed";
    } finally {
      this.flushing = false;
    }
    return published;
  }

  private publish(topic: string, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) { reject(new Error("MQTT client is not connected")); return; }
      this.client.publish(topic, payload, { qos: 1, retain: false }, (error) => error ? reject(error) : resolve());
    });
  }

  private statusPayload(status: "ONLINE" | "HEARTBEAT" | "OFFLINE") {
    return JSON.stringify({ status, candidate_id: this.mqtt.candidateId, client_id: this.clientId, at: new Date().toISOString() });
  }

  private publishStatus(status: "ONLINE" | "HEARTBEAT" | "OFFLINE") {
    return this.publish(this.statusTopic, this.statusPayload(status));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      void this.publishStatus("HEARTBEAT")
        .then(() => { this.status.last_heartbeat_at = new Date().toISOString(); })
        .catch((error: Error) => { this.status.last_error = error.message; });
      void this.flushUnpublished();
    }, this.heartbeatMs);
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  async getStatus() {
    return { ...this.status, challenge_counts: await this.mqtt.getChallengeCounts() };
  }

  async onModuleDestroy() {
    this.stopping = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    await this.queue.catch(() => undefined);
    if (this.client?.connected) await this.publishStatus("OFFLINE").catch(() => undefined);
    const client = this.client;
    this.client = null;
    if (client) await new Promise<void>((resolve) => client.end(false, {}, () => resolve()));
  }
}
