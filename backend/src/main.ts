import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { setup } from "./setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setup(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "127.0.0.1");
  console.log(`Production Event API http://localhost:${port}/api | Swagger http://localhost:${port}/docs`);
}

void bootstrap();
