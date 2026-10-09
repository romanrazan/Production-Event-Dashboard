// Local MQTT 3.1.1/5 broker for development and integration tests (no Docker or mosquitto needed).
// Usage: node scripts/local-mqtt-broker.mjs [port]   (default MQTT_LOCAL_PORT or 1883)
// It only ever listens on 127.0.0.1 and is never the examiner's broker.
import net from "node:net";
import { Aedes } from "aedes";

const port = Number(process.argv[2] ?? process.env.MQTT_LOCAL_PORT ?? 1883);
const quiet = process.argv.includes("--quiet");
const broker = await Aedes.createBroker();
const server = net.createServer(broker.handle);

if (!quiet) {
  broker.on("client", (client) => console.log(`[broker] client connected ${client.id}`));
  broker.on("clientDisconnect", (client) => console.log(`[broker] client disconnected ${client.id}`));
  broker.on("subscribe", (subs, client) => console.log(`[broker] ${client?.id} subscribed ${subs.map((s) => `${s.topic}@qos${s.qos}`).join(", ")}`));
  broker.on("publish", (packet, client) => {
    if (client && packet.topic.startsWith("fse-01/")) console.log(`[broker] ${client.id} -> ${packet.topic} (${packet.payload.length} bytes, qos ${packet.qos}, retain ${packet.retain})`);
  });
}

server.listen(port, "127.0.0.1", () => console.log(`READY local MQTT broker mqtt://127.0.0.1:${port}`));

const shutdown = () => server.close(() => broker.close(() => process.exit(0)));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
