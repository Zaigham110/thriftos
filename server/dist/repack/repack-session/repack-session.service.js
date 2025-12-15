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
exports.RepackSessionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
let RepackSessionService = class RepackSessionService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(tenantId, dto, currentUserId) {
        const workerId = dto.workerId || currentUserId;
        const supervisorId = dto.supervisorId || currentUserId;
        const session = await this.prisma.repackSession.create({
            data: {
                tenantId,
                workerId,
                supervisorId,
                status: client_1.RepackSessionStatus.OPEN,
            },
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'REPACK_SESSION_CREATED',
            entityType: 'RepackSession',
            entityId: session.id,
            metadataJson: { workerId, supervisorId },
        });
        return session;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const where = {
            tenantId,
            ...(options?.status && { status: options.status }),
        };
        const [data, total] = await Promise.all([
            this.prisma.repackSession.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    worker: { select: { id: true, name: true, email: true } },
                    supervisor: { select: { id: true, name: true, email: true } },
                    _count: { select: { repackUnits: true } },
                },
            }),
            this.prisma.repackSession.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const session = await this.prisma.repackSession.findFirst({
            where: { id, tenantId },
            include: {
                worker: { select: { id: true, name: true, email: true } },
                supervisor: { select: { id: true, name: true, email: true } },
                repackUnits: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        category: { select: { id: true, name: true } },
                        grade: { select: { id: true, name: true } },
                        qrLabel: true,
                        _count: { select: { repackItems: true } },
                    },
                },
            },
        });
        if (!session)
            throw new common_1.NotFoundException('Repack session not found');
        return session;
    }
    async update(tenantId, id, dto, currentUserId) {
        const session = await this.prisma.repackSession.findFirst({
            where: { id, tenantId },
            select: { id: true, status: true },
        });
        if (!session)
            throw new common_1.NotFoundException('Repack session not found');
        if (session.status !== client_1.RepackSessionStatus.OPEN) {
            throw new common_1.ConflictException('Cannot update a CLOSED repack session');
        }
        const updated = await this.prisma.repackSession.update({
            where: { id },
            data: dto,
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'REPACK_SESSION_UPDATED',
            entityType: 'RepackSession',
            entityId: id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async close(tenantId, id, currentUserId) {
        const result = await this.prisma.$transaction(async (tx) => {
            const session = await tx.repackSession.findFirst({
                where: { id, tenantId },
                include: { repackUnits: { select: { id: true } } },
            });
            if (!session)
                throw new common_1.NotFoundException('Repack session not found');
            if (session.status !== client_1.RepackSessionStatus.OPEN)
                throw new common_1.ConflictException('Cannot close session twice');
            if (!session.repackUnits || session.repackUnits.length === 0) {
                throw new common_1.BadRequestException('At least one RepackUnit is required to close the session');
            }
            const closed = await tx.repackSession.update({
                where: { id },
                data: { status: client_1.RepackSessionStatus.CLOSED, endTime: new Date() },
            });
            await tx.repackUnit.updateMany({
                where: { repackSessionId: id },
                data: { status: client_1.RepackStatus.READY },
            });
            return closed;
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'REPACK_SESSION_CLOSED',
            entityType: 'RepackSession',
            entityId: id,
        });
        return result;
    }
};
exports.RepackSessionService = RepackSessionService;
exports.RepackSessionService = RepackSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RepackSessionService);
//# sourceMappingURL=repack-session.service.js.map