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
exports.RepackAllocationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let RepackAllocationService = class RepackAllocationService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    runInTx(tx, fn) {
        if (tx)
            return fn(tx);
        return this.prisma.$transaction(fn);
    }
    async appendManualAllocations(tenantId, repackUnitId, categoryId, gradeId, measurementType, remainingTarget, manualAllocations, tx) {
        return this.runInTx(tx, async (tx) => {
            if (!manualAllocations || manualAllocations.length === 0) {
                throw new common_1.BadRequestException('allocations are required');
            }
            const gradingOutputIds = manualAllocations.map((a) => a.gradingOutputId);
            const uniqueIds = new Set(gradingOutputIds);
            if (uniqueIds.size !== gradingOutputIds.length) {
                throw new common_1.BadRequestException('Duplicate grading output IDs detected in allocation request');
            }
            const totalRequested = manualAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
            if (!Number.isFinite(totalRequested) || totalRequested <= 0) {
                throw new common_1.BadRequestException('Total allocation amount must be > 0');
            }
            if (totalRequested - remainingTarget > 0.001) {
                throw new common_1.BadRequestException(`Allocation exceeds remaining target. Remaining: ${remainingTarget}, Requested: ${totalRequested}`);
            }
            const outputs = await tx.gradeOutput.findMany({
                where: {
                    id: { in: gradingOutputIds },
                    tenantId,
                },
                include: {
                    gradeBucket: {
                        include: {
                            gradeSession: {
                                include: {
                                    categoryOutput: {
                                        include: {
                                            sortCategoryBucket: {
                                                include: {
                                                    sortSession: {
                                                        include: {
                                                            rag: {
                                                                select: { id: true, containerId: true },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (outputs.length !== manualAllocations.length) {
                throw new common_1.NotFoundException(`Some grading outputs not found. Expected: ${manualAllocations.length}, Found: ${outputs.length}`);
            }
            const allocations = [];
            let totalCost = 0;
            for (const allocationInput of manualAllocations) {
                const output = outputs.find((o) => o.id === allocationInput.gradingOutputId);
                if (!output)
                    throw new common_1.NotFoundException(`Grading output ${allocationInput.gradingOutputId} not found`);
                if (output.gradeId !== gradeId) {
                    throw new common_1.BadRequestException(`Grading output ${output.id} has gradeId ${output.gradeId}, expected ${gradeId}`);
                }
                const outputCategoryId = output.gradeBucket?.gradeSession?.categoryOutput?.categoryId;
                if (!outputCategoryId || outputCategoryId !== categoryId) {
                    throw new common_1.BadRequestException(`Grading output ${output.id} does not match repack category`);
                }
                if (output.measurementType !== measurementType) {
                    throw new common_1.BadRequestException(`Grading output ${output.id} has measurementType ${output.measurementType}, expected ${measurementType}`);
                }
                const amountToTake = Number(allocationInput.amountUsed);
                if (!Number.isFinite(amountToTake) || amountToTake <= 0) {
                    throw new common_1.BadRequestException('amountUsed must be > 0');
                }
                if (Number(output.remainingAmount) < amountToTake) {
                    throw new common_1.BadRequestException(`Insufficient remaining amount in grading output ${output.id}. Remaining: ${output.remainingAmount}, Requested: ${amountToTake}`);
                }
                const totalAmountNum = Number(output.totalAmount);
                const allocatedCostNum = Number(output.allocatedCost);
                if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
                    throw new common_1.BadRequestException(`Invalid grading output totalAmount for cost calculation: ${output.id}`);
                }
                if (!Number.isFinite(allocatedCostNum) || allocatedCostNum < 0) {
                    throw new common_1.BadRequestException(`Invalid grading output allocatedCost for cost calculation: ${output.id}`);
                }
                const costPerUnit = allocatedCostNum / totalAmountNum;
                const allocationCost = costPerUnit * amountToTake;
                const sortSession = output.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession;
                const rag = sortSession?.rag;
                const containerId = rag?.containerId || null;
                const ragBaleId = rag?.id || null;
                const allocation = await tx.repackInputAllocation.create({
                    data: {
                        tenant: { connect: { id: tenantId } },
                        repackUnit: { connect: { id: repackUnitId } },
                        gradingOutput: { connect: { id: output.id } },
                        containerId,
                        ragBaleId,
                        amountUsed: amountToTake,
                        measurementType,
                        allocatedCost: allocationCost,
                    },
                });
                const newUsedAmount = Number(output.usedAmount) + amountToTake;
                const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
                let newStatus = output.status;
                if (newRemainingAmount <= 0) {
                    newStatus = client_1.GradingOutputStatus.DEPLETED;
                }
                else if (newUsedAmount > 0) {
                    newStatus = client_1.GradingOutputStatus.PARTIALLY_USED;
                }
                await tx.gradeOutput.update({
                    where: { id: output.id },
                    data: {
                        usedAmount: newUsedAmount,
                        remainingAmount: newRemainingAmount,
                        status: newStatus,
                    },
                });
                allocations.push({
                    id: allocation.id,
                    gradingOutputId: output.id,
                    amountUsed: amountToTake,
                    containerId,
                    ragBaleId,
                });
                totalCost += allocationCost;
            }
            return {
                allocations,
                totalAllocated: totalRequested,
                totalCost,
            };
        });
    }
    async deallocateSingle(tenantId, allocationId, tx) {
        return this.runInTx(tx, async (tx) => {
            const allocation = await tx.repackInputAllocation.findFirst({
                where: { id: allocationId, tenantId },
                select: {
                    id: true,
                    repackUnitId: true,
                    gradingOutputId: true,
                    amountUsed: true,
                    allocatedCost: true,
                },
            });
            if (!allocation)
                throw new common_1.NotFoundException('Allocation not found');
            const output = await tx.gradeOutput.findFirst({
                where: { id: allocation.gradingOutputId, tenantId },
                select: { id: true, totalAmount: true, usedAmount: true, remainingAmount: true, status: true },
            });
            if (!output)
                throw new common_1.NotFoundException('Grading output not found');
            const amount = Number(allocation.amountUsed);
            const newUsedAmount = Number(output.usedAmount) - amount;
            if (newUsedAmount < -0.001) {
                throw new common_1.ConflictException('Invalid deallocation: usedAmount would become negative');
            }
            const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
            let newStatus = output.status;
            if (newUsedAmount <= 0.001) {
                newStatus = client_1.GradingOutputStatus.AVAILABLE;
            }
            else if (newRemainingAmount > 0) {
                newStatus = client_1.GradingOutputStatus.PARTIALLY_USED;
            }
            else {
                newStatus = client_1.GradingOutputStatus.DEPLETED;
            }
            await tx.gradeOutput.update({
                where: { id: output.id },
                data: {
                    usedAmount: newUsedAmount,
                    remainingAmount: newRemainingAmount,
                    status: newStatus,
                },
            });
            await tx.repackInputAllocation.delete({ where: { id: allocation.id } });
            return {
                repackUnitId: allocation.repackUnitId,
                gradingOutputId: allocation.gradingOutputId,
                amountRestored: amount,
                costRestored: Number(allocation.allocatedCost),
            };
        });
    }
    async allocateFIFO(tenantId, repackUnitId, categoryId, gradeId, measurementType, targetAmount) {
        return this.prisma.$transaction(async (tx) => {
            const eligibleOutputs = await tx.gradeOutput.findMany({
                where: {
                    tenantId,
                    gradeId,
                    measurementType,
                    status: {
                        in: [client_1.GradingOutputStatus.READY_FOR_REPACK],
                    },
                    remainingAmount: {
                        gt: 0,
                    },
                },
                include: {
                    gradeBucket: {
                        include: {
                            gradeSession: {
                                include: {
                                    categoryOutput: {
                                        include: {
                                            sortCategoryBucket: {
                                                include: {
                                                    sortSession: {
                                                        include: {
                                                            rag: {
                                                                select: {
                                                                    id: true,
                                                                    containerId: true,
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    gradeBucket: {
                        gradeSession: {
                            endTime: 'asc',
                        },
                    },
                },
            });
            if (eligibleOutputs.length === 0) {
                throw new common_1.BadRequestException(`No eligible grading outputs found for FIFO allocation. Category: ${categoryId}, Grade: ${gradeId}, Type: ${measurementType}`);
            }
            const allocations = [];
            let remainingToAllocate = targetAmount;
            let totalCost = 0;
            for (const output of eligibleOutputs) {
                if (remainingToAllocate <= 0)
                    break;
                const amountToTake = Math.min(Number(output.remainingAmount), remainingToAllocate);
                const totalAmountNum = Number(output.totalAmount);
                const allocatedCostNum = Number(output.allocatedCost);
                if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
                    throw new common_1.BadRequestException(`Invalid grading output totalAmount for cost calculation: ${output.id}`);
                }
                if (!Number.isFinite(allocatedCostNum) || allocatedCostNum < 0) {
                    throw new common_1.BadRequestException(`Invalid grading output allocatedCost for cost calculation: ${output.id}`);
                }
                const costPerUnit = allocatedCostNum / totalAmountNum;
                const allocationCost = costPerUnit * amountToTake;
                if (!Number.isFinite(allocationCost)) {
                    throw new common_1.BadRequestException(`Invalid allocation cost computed for grading output: ${output.id}`);
                }
                const sortSession = output.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession;
                const rag = sortSession?.rag;
                const containerId = rag?.containerId || null;
                const ragBaleId = rag?.id || null;
                const allocation = await tx.repackInputAllocation.create({
                    data: {
                        tenant: { connect: { id: tenantId } },
                        repackUnit: { connect: { id: repackUnitId } },
                        gradingOutput: { connect: { id: output.id } },
                        containerId,
                        ragBaleId,
                        amountUsed: amountToTake,
                        measurementType,
                        allocatedCost: allocationCost,
                    },
                });
                allocations.push({
                    id: allocation.id,
                    gradingOutputId: output.id,
                    amountUsed: amountToTake,
                    containerId,
                    ragBaleId,
                });
                const newUsedAmount = Number(output.usedAmount) + amountToTake;
                const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
                let newStatus = output.status;
                if (newRemainingAmount <= 0) {
                    newStatus = client_1.GradingOutputStatus.DEPLETED;
                }
                else if (newUsedAmount > 0) {
                    newStatus = client_1.GradingOutputStatus.PARTIALLY_USED;
                }
                await tx.gradeOutput.update({
                    where: { id: output.id },
                    data: {
                        usedAmount: newUsedAmount,
                        remainingAmount: newRemainingAmount,
                        status: newStatus,
                    },
                });
                remainingToAllocate -= amountToTake;
                totalCost += allocationCost;
            }
            if (remainingToAllocate > 0.001) {
                throw new common_1.BadRequestException(`Insufficient stock for FIFO allocation. Requested: ${targetAmount}, Allocated: ${targetAmount - remainingToAllocate}, Shortage: ${remainingToAllocate}`);
            }
            return {
                allocations,
                totalAllocated: targetAmount,
                totalCost,
            };
        });
    }
    async allocateManual(tenantId, repackUnitId, measurementType, targetAmount, manualAllocations) {
        return this.prisma.$transaction(async (tx) => {
            const gradingOutputIds = manualAllocations.map((a) => a.gradingOutputId);
            const uniqueIds = new Set(gradingOutputIds);
            if (uniqueIds.size !== gradingOutputIds.length) {
                throw new common_1.BadRequestException('Duplicate grading output IDs detected in manual allocation');
            }
            const totalRequested = manualAllocations.reduce((sum, a) => sum + a.amountUsed, 0);
            if (Math.abs(totalRequested - targetAmount) > 0.001) {
                throw new common_1.BadRequestException(`Manual allocation total (${totalRequested}) does not match target amount (${targetAmount})`);
            }
            const outputs = await tx.gradeOutput.findMany({
                where: {
                    id: { in: gradingOutputIds },
                    tenantId,
                },
                include: {
                    gradeBucket: {
                        include: {
                            gradeSession: {
                                include: {
                                    categoryOutput: {
                                        include: {
                                            sortCategoryBucket: {
                                                include: {
                                                    sortSession: {
                                                        include: {
                                                            rag: {
                                                                select: {
                                                                    id: true,
                                                                    containerId: true,
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (outputs.length !== manualAllocations.length) {
                throw new common_1.NotFoundException(`Some grading outputs not found. Expected: ${manualAllocations.length}, Found: ${outputs.length}`);
            }
            const allocations = [];
            let totalCost = 0;
            for (const allocationInput of manualAllocations) {
                const output = outputs.find((o) => o.id === allocationInput.gradingOutputId);
                if (!output) {
                    throw new common_1.NotFoundException(`Grading output ${allocationInput.gradingOutputId} not found`);
                }
                if (output.measurementType !== measurementType) {
                    throw new common_1.BadRequestException(`Grading output ${output.id} has measurementType ${output.measurementType}, expected ${measurementType}`);
                }
                if (Number(output.remainingAmount) < allocationInput.amountUsed) {
                    throw new common_1.BadRequestException(`Insufficient remaining amount in grading output ${output.id}. Requested: ${allocationInput.amountUsed}, Available: ${output.remainingAmount}`);
                }
                if (output.status === client_1.GradingOutputStatus.DEPLETED) {
                    throw new common_1.ConflictException(`Grading output ${output.id} is already depleted`);
                }
                const totalAmountNum = Number(output.totalAmount);
                const allocatedCostNum = Number(output.allocatedCost);
                if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
                    throw new common_1.BadRequestException(`Invalid grading output totalAmount for cost calculation: ${output.id}`);
                }
                if (!Number.isFinite(allocatedCostNum) || allocatedCostNum < 0) {
                    throw new common_1.BadRequestException(`Invalid grading output allocatedCost for cost calculation: ${output.id}`);
                }
                const costPerUnit = allocatedCostNum / totalAmountNum;
                const allocationCost = costPerUnit * allocationInput.amountUsed;
                if (!Number.isFinite(allocationCost)) {
                    throw new common_1.BadRequestException(`Invalid allocation cost computed for grading output: ${output.id}`);
                }
                const sortSession = output.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession;
                const rag = sortSession?.rag;
                const containerId = rag?.containerId || null;
                const ragBaleId = rag?.id || null;
                const allocation = await tx.repackInputAllocation.create({
                    data: {
                        tenant: { connect: { id: tenantId } },
                        repackUnit: { connect: { id: repackUnitId } },
                        gradingOutput: { connect: { id: output.id } },
                        containerId,
                        ragBaleId,
                        amountUsed: allocationInput.amountUsed,
                        measurementType,
                        allocatedCost: allocationCost,
                    },
                });
                allocations.push({
                    id: allocation.id,
                    gradingOutputId: output.id,
                    amountUsed: allocationInput.amountUsed,
                    containerId,
                    ragBaleId,
                });
                const newUsedAmount = Number(output.usedAmount) + allocationInput.amountUsed;
                const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
                let newStatus = output.status;
                if (newRemainingAmount <= 0) {
                    newStatus = 'DEPLETED';
                }
                else if (newUsedAmount > 0) {
                    newStatus = 'PARTIALLY_USED';
                }
                await tx.gradeOutput.update({
                    where: { id: output.id },
                    data: {
                        usedAmount: newUsedAmount,
                        remainingAmount: newRemainingAmount,
                        status: newStatus,
                    },
                });
                totalCost += allocationCost;
            }
            return {
                allocations,
                totalAllocated: targetAmount,
                totalCost,
            };
        });
    }
    async deallocate(tenantId, repackUnitId) {
        await this.prisma.$transaction(async (tx) => {
            const allocations = await tx.repackInputAllocation.findMany({
                where: {
                    tenantId,
                    repackUnitId,
                },
            });
            for (const allocation of allocations) {
                const output = await tx.gradeOutput.findUnique({
                    where: { id: allocation.gradingOutputId },
                });
                if (output) {
                    const newUsedAmount = Number(output.usedAmount) - Number(allocation.amountUsed);
                    const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
                    let newStatus = 'AVAILABLE';
                    if (newUsedAmount > 0) {
                        newStatus = 'PARTIALLY_USED';
                    }
                    await tx.gradeOutput.update({
                        where: { id: output.id },
                        data: {
                            usedAmount: Math.max(0, newUsedAmount),
                            remainingAmount: newRemainingAmount,
                            status: newStatus,
                        },
                    });
                }
            }
            await tx.repackInputAllocation.deleteMany({
                where: {
                    tenantId,
                    repackUnitId,
                },
            });
        });
    }
    async getAvailableStock(tenantId, categoryId, gradeId, measurementType) {
        const outputs = await this.prisma.gradeOutput.findMany({
            where: {
                tenantId,
                gradeId,
                measurementType,
                status: {
                    in: [client_1.GradingOutputStatus.READY_FOR_REPACK],
                },
                remainingAmount: {
                    gt: 0,
                },
                gradeBucket: {
                    gradeSession: {
                        categoryOutput: {
                            categoryId: categoryId,
                        },
                    },
                },
            },
            include: {
                grade: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                gradeBucket: {
                    include: {
                        gradeSession: {
                            include: {
                                categoryOutput: {
                                    include: {
                                        category: {
                                            select: {
                                                id: true,
                                                name: true,
                                            },
                                        },
                                        sortCategoryBucket: {
                                            include: {
                                                sortSession: {
                                                    include: {
                                                        rag: {
                                                            select: {
                                                                id: true,
                                                                ragCode: true,
                                                                containerId: true,
                                                                container: {
                                                                    select: {
                                                                        containerNumber: true,
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        return outputs.map((output) => {
            const categoryOutput = output.gradeBucket.gradeSession.categoryOutput;
            const rag = categoryOutput.sortCategoryBucket.sortSession.rag;
            return {
                id: output.id,
                gradeId: output.gradeId,
                gradeName: output.grade.name,
                categoryId: categoryOutput.categoryId,
                categoryName: categoryOutput.category.name,
                totalAmount: Number(output.totalAmount),
                usedAmount: Number(output.usedAmount),
                remainingAmount: Number(output.remainingAmount),
                measurementType: output.measurementType,
                status: output.status,
                allocatedCost: Number(output.allocatedCost),
                containerId: rag?.containerId || null,
                containerNumber: rag?.container?.containerNumber || 'N/A',
                ragBaleCode: rag?.ragCode || null,
                sortSessionId: categoryOutput.sortCategoryBucket.sortSessionId,
                gradeSessionId: output.gradeBucket.gradeSessionId,
            };
        });
    }
};
exports.RepackAllocationService = RepackAllocationService;
exports.RepackAllocationService = RepackAllocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RepackAllocationService);
//# sourceMappingURL=repack-allocation.service.js.map