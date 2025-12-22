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
exports.QrLabelService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const QRCode = require("qrcode");
let QrLabelService = class QrLabelService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getUnitQr(tenantId, unitId) {
        const unit = await this.prisma.repackUnit.findFirst({
            where: { id: unitId, tenantId },
            include: {
                qrLabel: true,
                category: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
            },
        });
        if (!unit)
            throw new common_1.NotFoundException('Repack unit not found');
        if (!unit.qrLabel)
            throw new common_1.NotFoundException('QR label not found');
        const qrData = unit.qrLabel.qrCode;
        const qrPngDataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 300 });
        return {
            qr: {
                encoded: qrData,
                pngDataUrl: qrPngDataUrl,
                generatedAt: unit.qrLabel.generatedAt,
            },
            unit: {
                id: unit.id,
                unitCode: unit.unitCode,
                unitType: unit.unitType,
                category: unit.category?.name ?? null,
                grade: unit.grade?.name ?? null,
                weightKg: unit.weightKg.toString(),
                pcsCount: unit.pcsCount,
                totalCost: unit.totalCost.toString(),
                createdAt: unit.createdAt,
            },
        };
    }
};
exports.QrLabelService = QrLabelService;
exports.QrLabelService = QrLabelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QrLabelService);
//# sourceMappingURL=qr-label.service.js.map