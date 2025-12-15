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
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ContainerStatus;
        purchaseOrderId: string;
        containerNumber: string;
        referenceNumber: string | null;
        containerType: string | null;
        eta: Date | null;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
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
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.ContainerStatus;
            purchaseOrderId: string;
            containerNumber: string;
            referenceNumber: string | null;
            containerType: string | null;
            eta: Date | null;
            grossWeight: import("@prisma/client/runtime/library").Decimal;
            netWeight: import("@prisma/client/runtime/library").Decimal;
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
            containerId: string;
            ragCode: string;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            allocatedCost: import("@prisma/client/runtime/library").Decimal;
        }[];
        incomingBales: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            vendorId: string | null;
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            baleCode: string;
            categoryGuess: string | null;
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
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ContainerStatus;
        purchaseOrderId: string;
        containerNumber: string;
        referenceNumber: string | null;
        containerType: string | null;
        eta: Date | null;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
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
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ContainerStatus;
        purchaseOrderId: string;
        containerNumber: string;
        referenceNumber: string | null;
        containerType: string | null;
        eta: Date | null;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
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
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ContainerStatus;
        purchaseOrderId: string;
        containerNumber: string;
        referenceNumber: string | null;
        containerType: string | null;
        eta: Date | null;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
    }>;
    getCostBreakdown(id: string, user: CurrentUserData, req: Request): Promise<{
        containerId: string;
        containerNumber: string;
        grossWeight: import("@prisma/client/runtime/library").Decimal;
        netWeight: import("@prisma/client/runtime/library").Decimal;
        totalCharges: string;
        chargeBreakdown: {
            type: import("@prisma/client").$Enums.ChargeType;
            description: string;
            amount: string;
        }[];
        rags: {
            id: string;
            code: string;
            weightKg: string;
            allocatedCost: string;
        }[];
        incomingBales: {
            id: string;
            code: string;
            weightKg: string;
            allocatedCost: string;
        }[];
        totalAllocatedToRags: string;
        totalAllocatedToBales: string;
        totalAllocated: string;
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
