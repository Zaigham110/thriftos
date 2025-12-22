import { Request } from 'express';
import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class PurchaseOrderController {
    private readonly purchaseOrderService;
    constructor(purchaseOrderService: PurchaseOrderService);
    create(dto: CreatePurchaseOrderDto, user: CurrentUserData, req: Request): Promise<{
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
        containers: {
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
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import("@prisma/client").$Enums.PurchaseOrderStatus;
        poType: import("@prisma/client").$Enums.PurchaseOrderType;
        vendorId: string | null;
        poNumber: string;
        totalCost: import("@prisma/client/runtime/library").Decimal;
    }>;
    findAll(status: PurchaseOrderStatus, page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
        data: ({
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
            _count: {
                containers: number;
                incomingBales: number;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            status: import("@prisma/client").$Enums.PurchaseOrderStatus;
            poType: import("@prisma/client").$Enums.PurchaseOrderType;
            vendorId: string | null;
            poNumber: string;
            totalCost: import("@prisma/client/runtime/library").Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string, user: CurrentUserData, req: Request): Promise<{
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
        containers: ({
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
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import("@prisma/client").$Enums.PurchaseOrderStatus;
        poType: import("@prisma/client").$Enums.PurchaseOrderType;
        vendorId: string | null;
        poNumber: string;
        totalCost: import("@prisma/client/runtime/library").Decimal;
    }>;
    update(id: string, dto: UpdatePurchaseOrderDto, user: CurrentUserData, req: Request): Promise<{
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
        containers: {
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
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import("@prisma/client").$Enums.PurchaseOrderStatus;
        poType: import("@prisma/client").$Enums.PurchaseOrderType;
        vendorId: string | null;
        poNumber: string;
        totalCost: import("@prisma/client/runtime/library").Decimal;
    }>;
    receive(id: string, user: CurrentUserData, req: Request): Promise<{
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
        containers: {
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
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import("@prisma/client").$Enums.PurchaseOrderStatus;
        poType: import("@prisma/client").$Enums.PurchaseOrderType;
        vendorId: string | null;
        poNumber: string;
        totalCost: import("@prisma/client/runtime/library").Decimal;
    }>;
    close(id: string, user: CurrentUserData, req: Request): Promise<{
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
        containers: {
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
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import("@prisma/client").$Enums.PurchaseOrderStatus;
        poType: import("@prisma/client").$Enums.PurchaseOrderType;
        vendorId: string | null;
        poNumber: string;
        totalCost: import("@prisma/client/runtime/library").Decimal;
    }>;
}
