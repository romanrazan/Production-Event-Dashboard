import { randomBytes } from "node:crypto";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import mqtt, { MqttClient } from "mqtt";
import { MqttService } from "./mqtt.service";

interface WorkerStatus {
  enabled: boolean;
  connected: boolean;
  candidate_id: string;
  client_id: string | null;
  last_challenge_id: string | null;
  last_challenge_at: string | null;
  last_response_status: string | null;
  last_error: string | null;
}

@Injectable()
export class MqttWorkerService implements OnModuleInit, OnModuleDestroy {
  private client: MqttClient | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private reconnect: NodeJS.Timeout | null = null;
  private stopping = false;
  private reconnectDelay = 1000;
  private readonly enabled = process.env.MQTT_ENABLED?.toLowerCase() === "true";
  private readonly broker = process.env.MQTT_BROKER_URL ?? "mqtt://152.42.238.142:1883";
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
      enabled: this.enabled, connected: false, candidate_id: mqtt.candidateId,
      client_id: this.enabled ? this.clientId : null, last_challenge_id: null,
      last_challenge_at: null, last_response_status: null, last_error: null,
    };
  }

  onModuleInit() {
    if (this.enabled) this.connect();
  }

  private connect() {
    this.client = mqtt.connect(this.broker, {
      clientId: this.clientId,
      protocolVersion: 4,
      reconnectPeriod: 0,
      clean: true,
      connectTimeout: 10_000,
      will: { topic: this.statusTopic, payload: JSON.stringify({ status: "OFFLINE", candidate_id: this.mqtt.candidateId }), qos: 1, retain: false },
    });
    this.client.on("connect", () => this.onConnect());
    this.client.on("message", (topic, payload) => { void this.onMessage(topic, payload); });
    this.client.on("error", (error) => { this.status.last_error = error.message; });
    this.client.on("close", () => this.onClose());
  }

  private onConnect() {
    this.status.connected = true;
    this.status.last_error = null;
    this.reconnectDelay = 1000;
    this.client?.subscribe(this.challengeTopic, { qos: 1 }, (error) => {
      if (error) { this.status.last_error = error.message; return; }
      void this.publishStatus("ONLINE");
      this.startHeartbeat();
    });
  }

  private onClose() {
    this.status.connected = false;
    this.stopHeartbeat();
    if (this.stopping || this.reconnect) return;
    this.reconnect = setTimeout(() => {
      this.reconnect = null;
      this.client?.reconnect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
    }, this.reconnectDelay);
  }

  private async onMessage(topic: string, payload: Buffer) {
    if (topic !== this.challengeTopic) return;
    this.status.last_challenge_at = new Date().toISOString();
    let raw: unknown;
    try { raw = JSON.parse(payload.toString("utf8")); }
    catch { raw = payload.toString("utf8"); }
    try {
      const handled = await this.mqtt.handleMqttChallenge(raw);
      this.status.last_challenge_id = handled.response.challenge_id;
      this.status.last_response_status = handled.response.status;
      const serialized = JSON.stringify(handled.response);
      await this.publish(this.responseTopic, serialized);
      await this.mqtt.recordPublish(handled.response.challenge_id);
    } catch (error) {
      this.status.last_error = error instanceof Error ? error.message : "Unknown MQTT processing error";
    }
  }

  private publish(topic: string, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) { reject(new Error("MQTT client is not connected")); return; }
      this.client.publish(topic, payload, { qos: 1, retain: false }, (error) => error ? reject(error) : resolve());
    });
  }

  private publishStatus(status: "ONLINE" | "HEARTBEAT" | "OFFLINE") {
    return this.publish(this.statusTopic, JSON.stringify({ status, candidate_id: this.mqtt.candidateId, at: new Date().toISOString() }));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    const interval = Math.min(Math.max(Number(process.env.MQTT_HEARTBEAT_MS ?? 30_000), 1000), 30_000);
    this.heartbeat = setInterval(() => { void this.publishStatus("HEARTBEAT").catch((error: Error) => { this.status.last_error = error.message; }); }, interval);
  }
  private stopHeartbeat() { if (this.heartbeat) clearInterval(this.heartbeat); this.heartbeat = null; }

  async getStatus() {
    return { ...this.status, challenge_counts: await this.mqtt.getChallengeCounts() };
  }

  async onModuleDestroy() {
    this.stopping = true;
    this.stopHeartbeat();
    if (this.reconnect) clearTimeout(this.reconnect);
    if (this.client?.connected) await this.publishStatus("OFFLINE").catch(() => undefined);
    await new Promise<void>((resolve) => this.client ? this.client.end(false, {}, () => resolve()) : resolve());
  }
}
