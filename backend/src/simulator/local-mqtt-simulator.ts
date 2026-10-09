import "dotenv/config";
import mqtt from "mqtt";
import { randomUUID } from "node:crypto";

/**
 * Local examiner simulator. Publishes challenges on fse-01/{candidate}/challenge and waits for the
 * correlated response on fse-01/{candidate}/response. It reads MQTT_SIMULATOR_BROKER_URL (default
 * the local broker), never MQTT_BROKER_URL, so it cannot accidentally publish to the examiner broker.
 *
 *   npm run mqtt:broker      # terminal 1: local broker on 127.0.0.1:1883
 *   npm run dev:backend      # terminal 2: with MQTT_BROKER_URL=mqtt://127.0.0.1:1883
 *   npm run mqtt:simulate    # terminal 3
 */
const candidateId = process.env.MQTT_CANDIDATE_ID ?? "07";
const broker = process.env.MQTT_SIMULATOR_BROKER_URL ?? "mqtt://127.0.0.1:1883";
const host = new URL(broker).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`Refusing to publish simulated challenges to non-local broker ${broker}. Pass --allow-remote to override.`);
  process.exit(2);
}

const challengeTopic = `fse-01/${candidateId}/challenge`;
const responseTopic = `fse-01/${candidateId}/response`;
const run = randomUUID().slice(0, 8);
const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

const base = {
  protocol_version: "1.0",
  candidate_id: candidateId,
  command: "PROCESS_EVENTS",
  sent_at: iso(0),
  expires_at: iso(5 * 60_000),
};
const main = {
  ...base,
  challenge_id: `SIM-${run}-1`,
  events: [
    { source_id: "LINE-SIM", event_id: `SIM-${run}-VOID`, type: "VOID", quantity: null, target_event_id: `SIM-${run}-COUNT`, event_time: iso(0) },
    { source_id: "LINE-SIM", event_id: `SIM-${run}-COUNT`, type: "COUNT", quantity: 7, target_event_id: null, event_time: iso(0) },
    { source_id: "LINE-SIM", event_id: `SIM-${run}-COUNT-2`, type: "COUNT", quantity: 3, event_time: iso(0) },
    { source_id: "LINE-SIM", event_id: `SIM-${run}-BAD`, type: "COUNT", quantity: "5", event_time: iso(0) },
  ],
};
const scenarios: Array<{ label: string; body: unknown; expect: string }> = [
  { label: "process events (VOID before COUNT, valid COUNT, invalid item)", body: main, expect: "COMPLETED" },
  { label: "identical redelivery -> exact replay", body: main, expect: "COMPLETED" },
  { label: "same challenge_id, changed body", body: { ...main, events: [] }, expect: "FAILED/CHALLENGE_CONFLICT" },
  { label: "expired challenge", body: { ...base, challenge_id: `SIM-${run}-EXPIRED`, sent_at: iso(-120_000), expires_at: iso(-60_000), events: [] }, expect: "FAILED/CHALLENGE_EXPIRED" },
];

const client = mqtt.connect(broker, { clientId: `fse01-sim-${run}`, protocolVersion: 4, reconnectPeriod: 0 });
let waiting: { id: string; resolve: (payload: Record<string, unknown>) => void } | null = null;

client.on("message", (topic, payload) => {
  if (topic !== responseTopic || !waiting) return;
  const response = JSON.parse(payload.toString("utf8")) as Record<string, unknown>;
  if (response.challenge_id === waiting.id) waiting.resolve(response);
});
client.on("error", (error) => { console.error(`MQTT error: ${error.message}`); process.exitCode = 1; client.end(true); });

function send(body: unknown): Promise<Record<string, unknown>> {
  const id = (body as { challenge_id: string }).challenge_id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting = null; reject(new Error(`No response for ${id} within 15s (is the backend running with MQTT_ENABLED=true against ${broker}?)`)); }, 15_000);
    waiting = { id, resolve: (response) => { clearTimeout(timer); waiting = null; resolve(response); } };
    client.publish(challengeTopic, JSON.stringify(body), { qos: 1, retain: false });
  });
}

client.on("connect", () => {
  client.subscribe(responseTopic, { qos: 1 }, async (error) => {
    if (error) { console.error(error.message); process.exitCode = 1; client.end(); return; }
    let first: string | null = null;
    try {
      for (const [index, scenario] of scenarios.entries()) {
        const response = await send(scenario.body);
        const outcome = response.status === "FAILED" ? `FAILED/${String(response.error_code)}` : String(response.status);
        const ok = outcome === scenario.expect;
        if (index === 0) first = JSON.stringify(response);
        console.log(`\n[${ok ? "PASS" : "FAIL"}] ${scenario.label}: ${outcome}`);
        if (index === 1) console.log(`  replay byte-identical to first response: ${JSON.stringify(response) === first}`);
        console.log(JSON.stringify(response, null, 2));
        if (!ok || (index === 1 && JSON.stringify(response) !== first)) process.exitCode = 1;
      }
    } catch (reason) {
      console.error(reason instanceof Error ? reason.message : reason);
      process.exitCode = 1;
    } finally {
      client.end();
    }
  });
});
