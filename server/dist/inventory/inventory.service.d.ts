import { PrismaService } from '../prisma/prisma.service';
export declare class InventoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(tenantId: string, filters?: {
        categoryId?: string;
        gradeId?: string;
        warehouseId?: string;
        status?: string;
        fromDate?: string;
        toDate?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: ({
            category: {
                id: string;
                name: string;
            };
            grade: {
                id: string;
                name: string;
            };
            warehouse: {
                id: string;
                name: string;
                code: string;
            };
            repackUnit: {
                id: string;
                status: import("@prisma/client").$Enums.RepackStatus;
                unitCode: string;
                qrLabel: {
                    qrCode: string;
                };
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.InventoryStatus;
            containerId: string | null;
            weightKg: import("@prisma/client/runtime/library").Decimal;
            ragId: string | null;
            categoryId: string;
            gradeId: string;
            warehouseId: string | null;
            pcsCount: number;
            repackUnitId: string;
            avgCost: import("@prisma/client/runtime/library").Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        aggregates: {
            totalWeight: number;
            totalPcs: number;
        };
    }>;
    findOne(tenantId: string, id: string): Promise<{
        category: {
            id: string;
            name: string;
        };
        grade: {
            id: string;
            name: string;
        };
        warehouse: {
            id: string;
            name: string;
            code: string;
        };
        repackUnit: {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.RepackStatus;
            measurementType: import("@prisma/client").$Enums.MeasurementType;
            unitCode: string;
            targetAmount: import("@prisma/client/runtime/library").Decimal;
            qrLabel: {
                qrCode: string;
            };
        };
        stockMovements: {
            id: string;
            metadataJson: import("@prisma/client/runtime/library").JsonValue;
            createdAt: Date;
            movementType: import("@prisma/client").$Enums.MovementType;
            quantityKg: import("@prisma/client/runtime/library").Decimal;
            quantityPcs: number;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.InventoryStatus;
        containerId: string | null;
        weightKg: import("@prisma/client/runtime/library").Decimal;
        ragId: string | null;
        categoryId: string;
        gradeId: string;
        warehouseId: string | null;
        pcsCount: number;
        repackUnitId: string;
        avgCost: import("@prisma/client/runtime/library").Decimal;
    }>;
    getTraceability(tenantId: string, inventoryId: string): Promise<{
        inventoryItem: {
            id: string;
            createdAt: Date;
        };
        repackUnit: {
            id: string;
            unitCode: string;
            status: import("@prisma/client").$Enums.RepackStatus;
            createdAt: Date;
        };
        sourceAllocations: {
            allocationId: any;
            amountUsed: any;
            measurementType: any;
            gradingOutput: {
                id: any;
                weightKg: any;
                count: any;
                grade: any;
                gradeSession: {
                    id: any;
                    startTime: any;
                    endTime: any;
                };
                categoryOutput: {
                    id: any;
                    weightKg: any;
                    category: any;
                    sortSession: {
                        id: any;
                        sessionCode: any;
                        startTime: any;
                        endTime: any;
                        rag: {
                            id: any;
                            ragCode: any;
                            ragType: any;
                            initialWeightKg: any;
                            container: {
                                id: any;
                                containerNumber: any;
                                purchaseOrder: {
                                    id: any;
                                    poNumber: any;
                                    vendor: any;
                                };
                            };
                        };
                    };
                };
            };
        }[];
    }>;
    getSummary(tenantId: string): Promise<{
        totalItems: number;
        totalWeight: number;
        totalPcs: number;
        warehouseCount: number;
        warehouses: {
            id: string;
            name: string;
            code: string;
        }[];
        byCategory: (import("@prisma/client").Prisma.PickEnumerable<import("@prisma/client").Prisma.InventoryItemGroupByOutputType, "categoryId"[]> & {
            _count: number;
            _sum: {
                weightKg: import("@prisma/client/runtime/library").Decimal;
                pcsCount: number;
            };
        })[];
        byGrade: (import("@prisma/client").Prisma.PickEnumerable<import("@prisma/client").Prisma.InventoryItemGroupByOutputType, "gradeId"[]> & {
            _count: number;
            _sum: {
                weightKg: import("@prisma/client/runtime/library").Decimal;
                pcsCount: number;
            };
        })[];
    }>;
    getFilterOptions(tenantId: string): Promise<{
        categories: {
            id: string;
            name: string;
        }[];
        grades: {
            id: string;
            name: string;
        }[];
        warehouses: {
            id: string;
            name: string;
        }[];
    }>;
}
