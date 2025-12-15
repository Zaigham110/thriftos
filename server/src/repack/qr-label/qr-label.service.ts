import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import QRCode from 'qrcode';

@Injectable()
export class QrLabelService {
  constructor(private prisma: PrismaService) {}

  async getUnitQr(tenantId: string, unitId: string) {
    const unit = await this.prisma.repackUnit.findFirst({
      where: { id: unitId, tenantId },
      include: {
        qrLabel: true,
        category: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
      },
    });
    if (!unit) throw new NotFoundException('Repack unit not found');
    if (!unit.qrLabel) throw new NotFoundException('QR label not found');

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
}


