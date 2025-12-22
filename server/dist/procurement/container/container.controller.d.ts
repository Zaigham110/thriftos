import { Request } from 'express';
import { ContainerStatus } from '@prisma/client';
import { ContainerService } from './container.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { UpdateContainerStatusDto } from './dto/update-container-status.dto';
import { CreateContainerChargeDto } from './dto/create-container-charge.dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class ContainerController {
    private readonly containerService;
    constructor(containerService: ContainerService);
    create(dto: CreateContainerDto, user: CurrentUserData, req: Request): Promise<{
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
    findAll(purchaseOrderId: string, status: ContainerStatus, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
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
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
    update(id: string, dto: UpdateContainerDto, user: CurrentUserData, req: Request): Promise<{
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
    updateStatus(id: string, dto: UpdateContainerStatusDto, user: CurrentUserData, req: Request): Promise<{
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
    getCostBreakdown(id: string, user: CurrentUserData, req: Request): Promise<{
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
    addCharge(id: string, dto: CreateContainerChargeDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        containerId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        chargeType: import("@prisma/client").$Enums.ChargeType;
    }>;
    getCharges(id: string, user: CurrentUserData, req: Request): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        containerId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        chargeType: import("@prisma/client").$Enums.ChargeType;
    }[]>;
    deleteCharge(id: string, chargeId: string, user: CurrentUserData, req: Request): Promise<{
        success: boolean;
    }>;
}
