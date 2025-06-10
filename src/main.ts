import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as Sentry from '@sentry/node';

async function bootstrap() {
  if (process.env.ENVIRONMENT === 'production') {
    const SENTRY_DSN = process.env.SENTRY_DSN;

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.ENVIRONMENT,
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      release: process.env.COMMIT_HASH,
    });
  }
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Processor Management API')
    .setDescription('API for managing processor devices and their status')
    .setVersion('1.0')
    .addTag('processor')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 9001);
}
bootstrap();
