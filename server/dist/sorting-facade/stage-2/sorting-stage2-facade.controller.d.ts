import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CategoryOutputService } from '../../sorting-stage1/category-output/category-output.service';
import { GradeSessionService } from '../../sorting-stage2/grade-session/grade-session.service';
import { GradeBucketService } from '../../sorting-stage2/grade-bucket/grade-bucket.service';
import { WasteService } from '../../waste/waste.service';
import { Stage2AddWasteDto, Stage2AllocateDto, Stage2SealDto, Stage2StartDto, Stage2UpdateWasteDto } from './dto';
export declare class SortingStage2FacadeController {
    private readonly categoryOutputService;
    private readonly gradeSessionService;
    private readonly gradeBucketService;
    private readonly wasteService;
    private readonly prisma;
    constructor(categoryOutputService: CategoryOutputService, gradeSessionService: GradeSessionService, gradeBucketService: GradeBucketService, wasteService: WasteService, prisma: PrismaService);
    queue(page: number, limit: number, user: CurrentUserData, req: Request): Promise<{
        data: {
            gradeStatus: string;
            category: {
                id: string;
                name: string;
            };
            container: {
                id: string;
                containerNumber: string;
            };
            rag: {
                id: string;
                ragCode: string;
            };
            sortCategoryBucket: {
                sortSession: {
                    id: string;
                    status: import("@prisma/client").$Enums.SortStatus;
                    startTime: Date;
                    endTime: Date;
                    worker: {
                        id: string;
                        name: string;
                    };
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                categoryId: string;
                sortSessionId: string;
                outputWeightKg: Decimal;
                outputCount: number;
            };
            gradeSessions: {
                id: string;
                status: import("@prisma/client").$Enums.GradeStatus;
            }[];
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            containerId: string | null;
            weightKg: Decimal;
            allocatedCost: Decimal;
            ragId: string;
            categoryId: string;
            sortSessionId: string;
            count: number;
            sortCategoryBucketId: string;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    start(dto: Stage2StartDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            id: string;
            status: import("@prisma/client").$Enums.GradeStatus;
            categoryOutputId: string;
            categoryOutput: {
                category: {
                    id: string;
                    name: string;
                };
                container: {
                    id: string;
                    containerNumber: string;
                };
                rag: {
                    id: string;
                    ragCode: string;
                };
                id: string;
                containerId: string;
                weightKg: Decimal;
                allocatedCost: Decimal;
                ragId: string;
                categoryId: string;
                sortSessionId: string;
            };
            totalGradeOutputWeight: string;
            wasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            gradeYieldPercent: number;
        };
        buckets: ({
            grade: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            gradeId: string;
            outputWeightKg: Decimal;
            outputCount: number;
            gradeSessionId: string;
        })[];
        wasteLineItems: any;
    }>;
    allocate(dto: Stage2AllocateDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            id: string;
            status: import("@prisma/client").$Enums.GradeStatus;
            categoryOutputId: string;
            categoryOutput: {
                category: {
                    id: string;
                    name: string;
                };
                container: {
                    id: string;
                    containerNumber: string;
                };
                rag: {
                    id: string;
                    ragCode: string;
                };
                id: string;
                containerId: string;
                weightKg: Decimal;
                allocatedCost: Decimal;
                ragId: string;
                categoryId: string;
                sortSessionId: string;
            };
            totalGradeOutputWeight: string;
            wasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            gradeYieldPercent: number;
        };
        buckets: ({
            grade: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            gradeId: string;
            outputWeightKg: Decimal;
            outputCount: number;
            gradeSessionId: string;
        })[];
        wasteLineItems: any;
    }>;
    seal(sessionId: string, dto: Stage2SealDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            id: string;
            status: import("@prisma/client").$Enums.GradeStatus;
            categoryOutputId: string;
            categoryOutput: {
                category: {
                    id: string;
                    name: string;
                };
                container: {
                    id: string;
                    containerNumber: string;
                };
                rag: {
                    id: string;
                    ragCode: string;
                };
                id: string;
                containerId: string;
                weightKg: Decimal;
                allocatedCost: Decimal;
                ragId: string;
                categoryId: string;
                sortSessionId: string;
            };
            totalGradeOutputWeight: string;
            wasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            gradeYieldPercent: number;
        };
        buckets: ({
            grade: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            gradeId: string;
            outputWeightKg: Decimal;
            outputCount: number;
            gradeSessionId: string;
        })[];
        wasteLineItems: any;
    }>;
    addWaste(dto: Stage2AddWasteDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            id: string;
            status: import("@prisma/client").$Enums.GradeStatus;
            categoryOutputId: string;
            categoryOutput: {
                category: {
                    id: string;
                    name: string;
                };
                container: {
                    id: string;
                    containerNumber: string;
                };
                rag: {
                    id: string;
                    ragCode: string;
                };
                id: string;
                containerId: string;
                weightKg: Decimal;
                allocatedCost: Decimal;
                ragId: string;
                categoryId: string;
                sortSessionId: string;
            };
            totalGradeOutputWeight: string;
            wasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            gradeYieldPercent: number;
        };
        buckets: ({
            grade: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            gradeId: string;
            outputWeightKg: Decimal;
            outputCount: number;
            gradeSessionId: string;
        })[];
        wasteLineItems: any;
    }>;
    updateWaste(wasteLineItemId: string, dto: Stage2UpdateWasteDto, user: CurrentUserData, req: Request): Promise<{
        session: {
            id: string;
            status: import("@prisma/client").$Enums.GradeStatus;
            categoryOutputId: string;
            categoryOutput: {
                category: {
                    id: string;
                    name: string;
                };
                container: {
                    id: string;
                    containerNumber: string;
                };
                rag: {
                    id: string;
                    ragCode: string;
                };
                id: string;
                containerId: string;
                weightKg: Decimal;
                allocatedCost: Decimal;
                ragId: string;
                categoryId: string;
                sortSessionId: string;
            };
            totalGradeOutputWeight: string;
            wasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            gradeYieldPercent: number;
        };
        buckets: ({
            grade: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            gradeId: string;
            outputWeightKg: Decimal;
            outputCount: number;
            gradeSessionId: string;
        })[];
        wasteLineItems: any;
    }>;
    removeWaste(wasteLineItemId: string, user: CurrentUserData, req: Request): Promise<{
        session: {
            id: string;
            status: import("@prisma/client").$Enums.GradeStatus;
            categoryOutputId: string;
            categoryOutput: {
                category: {
                    id: string;
                    name: string;
                };
                container: {
                    id: string;
                    containerNumber: string;
                };
                rag: {
                    id: string;
                    ragCode: string;
                };
                id: string;
                containerId: string;
                weightKg: Decimal;
                allocatedCost: Decimal;
                ragId: string;
                categoryId: string;
                sortSessionId: string;
            };
            totalGradeOutputWeight: string;
            wasteWeight: string;
            declaredWasteAmount: any;
            remainingWasteAmount: string;
            gradeYieldPercent: number;
        };
        buckets: ({
            grade: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            gradeId: string;
            outputWeightKg: Decimal;
            outputCount: number;
            gradeSessionId: string;
        })[];
        wasteLineItems: any;
    }>;
    private getSessionSummary;
}
