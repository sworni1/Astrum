import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.AUTH_PORT ?? 4580);

  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  app.use(compression());
  app.use((_req, res, next) => {
    res.setHeader("X-Instance", process.env.HOSTNAME ?? "unknown");
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.enableCors({
    origin: ["http://localhost:3000"],
    allowedHeaders: "Content-Type, Authorization, Access-Control-Allow-Origin",
    credentials: true,
  });

  app.setGlobalPrefix("/api", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  const config = new DocumentBuilder()
    .addBearerAuth()
    .setTitle("Astrum auth API Documentation")
    .setDescription(
      'Here are all the project endpoints. Register for your account and enter the token in the "Authorize" field. ',
    )
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("swagger", app, document);

  await app.listen(port);
}
bootstrap();
