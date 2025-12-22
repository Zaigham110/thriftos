import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { UpdateContainerStatusDto } from './dto/update-container-status.dto';
import { CreateContainerChargeDto } from './dto/create-container-charge.dto';
import { ContainerStatus } from '@prisma/client';
import { TenantSequenceService } from '../shared/tenant-sequence.service';
export declare class ContainerService {
    private prisma;
    private auditService;
    private costAllocationService;
    private tenantSequenceService;
    constructor(prisma: PrismaService, auditService: AuditService, costAllocationService: CostAllocationService, tenantSequenceService: TenantSequenceService);
    private toDate;
    create(tenantId: string, dto: CreateContainerDto, userId: string): Promise<{
        purchaseOrder: {
            poNumber: string;
        };
        containerCharges: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            containerId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            chargeType: import("@prisma/client").$Enums.ChargeType;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ContainerStatus;
        purchaseOrderId: string;
        containerNumber: string;
        referenceNumber: string | null;
        containerType: string | null;
        eta: Date | null;
        etd: Date | null;
        arrivedAt: Date | null;
        clearedAt: Date | null;
        releasedAt: Date | null;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
        billOfLadingNumber: string | null;
        shipmentReference: string | null;
        shippingLine: string | null;
        vesselName: string | null;
        portOfLoading: string | null;
        portOfDischarge: string | null;
        forwarder: string | null;
        notes: string | null;
    }>;
    findAll(tenantId: string, options?: {
        purchaseOrderId?: string;
        status?: ContainerStatus;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            purchaseOrder: {
                id: string;
                tenantId: string;
                poNumber: string;
            };
            _count: {
                rags: number;
                incomingBales: number;
            };
            containerCharges: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                description: string;
                containerId: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                chargeType: import("@prisma/client").$Enums.ChargeType;
            }[];
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.ContainerStatus;
            purchaseOrderId: string;
            containerNumber: string;
            referenceNumber: string | null;
            containerType: string | null;
            eta: Date | null;
            etd: Date | null;
            arrivedAt: Date | null;
            clearedAt: Date | null;
            releasedAt: Date | null;
            grossWeight: import("@prisma/client/runtime/library").Decimal;
            netWeight: import("@prisma/client/runtime/library").Decimal;
            billOfLadingNumber: string | null;
            shipmentReference: string | null;
            shippingLine: string | null;
            vesselName: string | null;
            portOfLoading: string | null;
            portOfDischarge: string | null;
            forwarder: string | null;
            notes: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(tenantId: string, id: string): Promise<{
        purchaseOrder: {
            vendor: {
                id: string;
                tenantId: string;
                createdAt: Date;
                name: string;
                isActive: boolean;
                updatedAt: Date;
                country: string | null;
                contactInfo: string | null;
            };
            id: string;
            tenantId: string;
            poNumber: string;
        };
        rags: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RagStatus;
            notes: string | null;
            containerId: string | null;
            rawCategoryId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragCode: string;
            ragBaleType: import("@prisma/client").$Enums.RagBaleType;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
            sourceType: import("@prisma/client").$Enums.RagSourceType;
        }[];
        incomingBales: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            vendorId: string | null;
            purchaseOrderId: string | null;
            containerId: string | null;
            rawCategoryId: string | null;
            baleCode: string;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            cost: import("@prisma/client/runtime/library").Decimal;
        }[];
        containerCharges: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            containerId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            chargeType: import("@prisma/client").$Enums.ChargeType;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ContainerStatus;
        purchaseOrderId: string;
        containerNumber: string;
        referenceNumber: string | null;
        containerType: string | null;
        eta: Date | null;
        etd: Date | null;
        arrivedAt: Date | null;
        clearedAt: Date | null;
        releasedAt: Date | null;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
        billOfLadingNumber: string | null;
        shipmentReference: string | null;
        shippingLine: string | null;
        vesselName: string | null;
        portOfLoading: string | null;
        portOfDischarge: string | null;
        forwarder: string | null;
        notes: string | null;
    }>;
    update(tenantId: string, id: string, dto: UpdateContainerDto, userId: string): Promise<{
        purchaseOrder: {
            poNumber: string;
        };
        containerCharges: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            containerId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            chargeType: import("@prisma/client").$Enums.ChargeType;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ContainerStatus;
        purchaseOrderId: string;
        containerNumber: string;
        referenceNumber: string | null;
        containerType: string | null;
        eta: Date | null;
        etd: Date | null;
        arrivedAt: Date | null;
        clearedAt: Date | null;
        releasedAt: Date | null;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
        billOfLadingNumber: string | null;
        shipmentReference: string | null;
        shippingLine: string | null;
        vesselName: string | null;
        portOfLoading: string | null;
        portOfDischarge: string | null;
        forwarder: string | null;
        notes: string | null;
    }>;
    updateStatus(tenantId: string, id: string, dto: UpdateContainerStatusDto, userId: string): Promise<{
        purchaseOrder: {
            poNumber: string;
        };
        containerCharges: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            containerId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            chargeType: import("@prisma/client").$Enums.ChargeType;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ContainerStatus;
        purchaseOrderId: string;
        containerNumber: string;
        referenceNumber: string | null;
        containerType: string | null;
        eta: Date | null;
        etd: Date | null;
        arrivedAt: Date | null;
        clearedAt: Date | null;
        releasedAt: Date | null;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
        billOfLadingNumber: string | null;
        shipmentReference: string | null;
        shippingLine: string | null;
        vesselName: string | null;
        portOfLoading: string | null;
        portOfDischarge: string | null;
        forwarder: string | null;
        notes: string | null;
    }>;
    addCharge(tenantId: string, containerId: string, dto: CreateContainerChargeDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        containerId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        chargeType: import("@prisma/client").$Enums.ChargeType;
    }>;
    getCharges(tenantId: string, containerId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        containerId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        chargeType: import("@prisma/client").$Enums.ChargeType;
    }[]>;
    deleteCharge(tenantId: string, containerId: string, chargeId: string, userId: string): Promise<{
        success: boolean;
    }>;
    getCostBreakdown(tenantId: string, containerId: string): Promise<{
        containerId: string;
        containerNumber: string;
        totalCost: number;
        costPerKg: number;
        totalWeight: number;
        currency: string;
        charges: {
            id: string;
            containerId: string;
            chargeType: import("@prisma/client").$Enums.ChargeType;
            description: string;
            amount: number;
            createdAt: string;
            updatedAt: string;
        }[];
        rags: {
            id: string;
            code: string;
            weightKg: number;
            allocatedCost: number;
        }[];
        incomingBales: {
            id: string;
            code: string;
            weightKg: number;
            allocatedCost: number;
        }[];
    }>;
}
