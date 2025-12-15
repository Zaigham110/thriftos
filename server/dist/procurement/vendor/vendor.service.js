"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
let VendorService = class VendorService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(tenantId, dto, userId) {
        const existing = await this.prisma.vendor.findFirst({
            where: { tenantId, name: dto.name },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Vendor "${dto.name}" already exists`);
        }
        const vendor = await this.prisma.vendor.create({
            data: {
                tenantId,
                name: dto.name,
                country: dto.country,
                contactInfo: dto.contactInfo,
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'VENDOR_CREATED',
            entityType: 'Vendor',
            entityId: vendor.id,
            metadataJson: { vendorName: vendor.name },
        });
        return vendor;
    }
    async findAll(tenantId, includeInactive = false) {
        return this.prisma.vendor.findMany({
            where: {
                tenantId,
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: { name: 'asc' },
        });
    }
    async findOne(tenantId, id) {
        const vendor = await this.prisma.vendor.findFirst({
            where: { id, tenantId },
        });
        if (!vendor) {
            throw new common_1.NotFoundException('Vendor not found');
        }
        return vendor;
    }
    async update(tenantId, id, dto, userId) {
        const vendor = await this.findOne(tenantId, id);
        if (dto.name && dto.name !== vendor.name) {
            const existing = await this.prisma.vendor.findFirst({
                where: { tenantId, name: dto.name, id: { not: id } },
            });
            if (existing) {
                throw new common_1.BadRequestException(`Vendor "${dto.name}" already exists`);
            }
        }
        const updated = await this.prisma.vendor.update({
            where: { id },
            data: dto,
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'VENDOR_UPDATED',
            entityType: 'Vendor',
            entityId: id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
};
exports.VendorService = VendorService;
exports.VendorService = VendorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], VendorService);
//# sourceMappingURL=vendor.service.js.map