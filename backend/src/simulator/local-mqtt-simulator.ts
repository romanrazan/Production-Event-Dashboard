import "dotenv/config";
import mqtt from "mqtt";
import { randomUUID } from "node:crypto";

const candidateId = process.env.MQTT_CANDIDATE_ID ?? "07";
const broker = process.env.MQTT_BROKER_URL ?? "mqtt://127.0.0.1:1883";
const challengeId = `LOCAL-${randomUUID()}`;
const challengeTopic = `fse-01/${candidateId}/challenge`;
const responseTopic = `fse-01/${candidateId}/response`;
const now = new Date();
const challenge = {
  protocol_version: "1.0",
  candidate_id: candidateId,
  challenge_id: challengeId,
  command: "PROCESS_EVENTS",
  sent_at: now.toISOString(),
  expires_at: new Date(now.getTime() + 60_000).toISOString(),
  events: [{ source_id: "LINE-SIM", event_id: `EV-${randomUUID()}`, type: "COUNT", quantity: 5, target_event_id: null, event_time: now.toISOString() }],
};

const client = mqtt.connect(broker, { clientId: `local-simulator-${randomUUID().slice(0, 8)}`, protocolVersion: 4 });
const timeout = setTimeout(() => { console.error("Timed out waiting for a correlated response"); client.end(); process.exitCode = 1; }, 20_000);
client.on("connect", () => {
  client.subscribe(responseTopic, { qos: 1 }, (error) => {
    if (error) throw error;
    client.publish(challengeTopic, JSON.stringify(challenge), { qos: 1, retain: false });
  });
});
client.on("message", (_topic, payload) => {
  const response = JSON.parse(payload.toString("utf8")) as { challenge_id?: string };
  if (response.challenge_id !== challengeId) return;
  clearTimeout(timeout);
  console.log(JSON.stringify(response, null, 2));
  client.end();
});
client.on("error", (error) => { console.error(error.message); });
