"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    const config = new swagger_1.DocumentBuilder()
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
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT access token',
        in: 'header',
    }, 'JWT-auth')
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
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document, {
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
//# sourceMappingURL=main.js.map