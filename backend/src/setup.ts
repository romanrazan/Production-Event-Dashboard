import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { SafeExceptionFilter } from "./shared/filters/safe-exception.filter";

export function setup(app: INestApplication) {
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3001,http://127.0.0.1:3001").split(","),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new SafeExceptionFilter());
  const config = new DocumentBuilder()
    .setTitle("Production Event Processing API")
    .setDescription("Durable COUNT/VOID processing shared by REST and MQTT")
    .setVersion("1.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  return app;
}
