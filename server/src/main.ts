import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // Enable CORS
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:4200', 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('ThriftOS V3 API')
    .setDescription(`
## ThriftOS V3 - Multi-Tenant Thrift Store ERP

A comprehensive ERP system for managing thrift store operations including:
- **Procurement**: Vendors, Purchase Orders, Containers, Bales
- **Sorting Stage 1**: Category sorting from bales
- **Sorting Stage 2**: Quality grading within categories
- **Repack**: Unit creation and QR code labeling
- **Inventory**: Stock management and movements
- **Reports**: Analytics and operational reports

### Authentication
All endpoints (except /auth/login, /auth/refresh, /health/*) require JWT authentication.
Include the access token in the Authorization header: \`Bearer <token>\`

### Multi-Tenancy
The system is multi-tenant. Regular users are scoped to their tenant.
Super Admins can impersonate tenants to access tenant-scoped data.
    `)
    .setVersion('3.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'Health check endpoints')
    .addTag('Auth', 'Authentication & session management')
    .addTag('Me', 'Current user profile')
    .addTag('Users', 'User management')
    .addTag('Roles', 'Role management')
    .addTag('Permissions', 'Permission listing')
    .addTag('Tenant', 'Tenant configuration & lookups')
    .addTag('SuperAdmin', 'Super Admin tenant management')
    .addTag('Vendors', 'Vendor management')
    .addTag('Purchase Orders', 'Purchase order management')
    .addTag('Containers', 'Container management')
    .addTag('Incoming Bales', 'Bale management')
    .addTag('RAG', 'RAG (unsellable) tracking')
    .addTag('Sorting Stage 1', 'Category sorting sessions')
    .addTag('Category Outputs', 'Sorted category outputs')
    .addTag('Sorting Stage 2', 'Quality grading sessions')
    .addTag('Grade Outputs', 'Graded quality outputs')
    .addTag('Repack Sessions', 'Repack session management')
    .addTag('Repack Units', 'Repack unit management')
    .addTag('Repack Items', 'Individual repack items')
    .addTag('QR Labels', 'QR code generation')
    .addTag('Warehouses', 'Warehouse management')
    .addTag('Inventory Items', 'Inventory management')
    .addTag('Stock Movements', 'Stock movement tracking')
    .addTag('Reports', 'Analytics & reports')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'ThriftOS V3 API Documentation',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 ThriftOS V3 API running on: http://localhost:${port}/api`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
