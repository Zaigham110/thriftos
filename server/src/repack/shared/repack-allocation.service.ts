/**
 * Mixed-Source Repack Allocation Service
 * 
 * Handles FIFO and Manual allocation strategies for repack units.
 * This service is the ONLY place where RepackInputAllocation records are created.
 * 
 * CRITICAL RULES:
 * 1. All operations must be atomic (wrapped in transactions)
 * 2. GradingOutput usage must be validated before allocation
 * 3. MeasurementType must match across repack unit and all allocations
 * 4. Total allocated amount must equal targetAmount
 * 5. No double allocation or over-allocation allowed
 * 6. FIFO must sort by grading completion timestamp (oldest first)
 */

import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AllocationMode, MeasurementType, GradingOutputStatus, Prisma } from '@prisma/client';

export interface ManualAllocationInput {
  gradingOutputId: string;
  amountUsed: number;
}

export interface AllocationResult {
  allocations: {
    id: string;
    gradingOutputId: string;
    amountUsed: number;
    containerId: string | null;
    ragBaleId: string | null;
  }[];
  totalAllocated: number;
  totalCost: number;
}

@Injectable()
export class RepackAllocationService {
  constructor(private readonly prisma: PrismaService) {}

  private runInTx<T>(
    tx: Prisma.TransactionClient | undefined,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (tx) return fn(tx);
    return this.prisma.$transaction(fn);
  }

  async appendManualAllocations(
    tenantId: string,
    repackUnitId: string,
    categoryId: string,
    gradeId: string,
    measurementType: MeasurementType,
    remainingTarget: number,
    manualAllocations: ManualAllocationInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<AllocationResult> {
    return this.runInTx(tx, async (tx) => {
      if (!manualAllocations || manualAllocations.length === 0) {
        throw new BadRequestException('allocations are required');
      }

      const gradingOutputIds = manualAllocations.map((a) => a.gradingOutputId);
      const uniqueIds = new Set(gradingOutputIds);
      if (uniqueIds.size !== gradingOutputIds.length) {
        throw new BadRequestException('Duplicate grading output IDs detected in allocation request');
      }

      const totalRequested = manualAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
      if (!Number.isFinite(totalRequested) || totalRequested <= 0) {
        throw new BadRequestException('Total allocation amount must be > 0');
      }
      if (totalRequested - remainingTarget > 0.001) {
        throw new BadRequestException(
          `Allocation exceeds remaining target. Remaining: ${remainingTarget}, Requested: ${totalRequested}`,
        );
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
        throw new NotFoundException(
          `Some grading outputs not found. Expected: ${manualAllocations.length}, Found: ${outputs.length}`,
        );
      }

      const allocations: any[] = [];
      let totalCost = 0;

      for (const allocationInput of manualAllocations) {
        const output = outputs.find((o) => o.id === allocationInput.gradingOutputId);
        if (!output) throw new NotFoundException(`Grading output ${allocationInput.gradingOutputId} not found`);

        // Validate grade/category/measurementType match
        if (output.gradeId !== gradeId) {
          throw new BadRequestException(`Grading output ${output.id} has gradeId ${output.gradeId}, expected ${gradeId}`);
        }
        const outputCategoryId = output.gradeBucket?.gradeSession?.categoryOutput?.categoryId;
        if (!outputCategoryId || outputCategoryId !== categoryId) {
          throw new BadRequestException(`Grading output ${output.id} does not match repack category`);
        }
        if (output.measurementType !== measurementType) {
          throw new BadRequestException(
            `Grading output ${output.id} has measurementType ${output.measurementType}, expected ${measurementType}`,
          );
        }

        const amountToTake = Number(allocationInput.amountUsed);
        if (!Number.isFinite(amountToTake) || amountToTake <= 0) {
          throw new BadRequestException('amountUsed must be > 0');
        }
        if (Number(output.remainingAmount) < amountToTake) {
          throw new BadRequestException(
            `Insufficient remaining amount in grading output ${output.id}. Remaining: ${output.remainingAmount}, Requested: ${amountToTake}`,
          );
        }

        // Cost proportional
        const totalAmountNum = Number(output.totalAmount);
        const allocatedCostNum = Number(output.allocatedCost);
        if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
          throw new BadRequestException(`Invalid grading output totalAmount for cost calculation: ${output.id}`);
        }
        if (!Number.isFinite(allocatedCostNum) || allocatedCostNum < 0) {
          throw new BadRequestException(`Invalid grading output allocatedCost for cost calculation: ${output.id}`);
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

        // Update GradingOutput balances
        const newUsedAmount = Number(output.usedAmount) + amountToTake;
        const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
        let newStatus = output.status;
        if (newRemainingAmount <= 0) {
          newStatus = GradingOutputStatus.DEPLETED;
        } else if (newUsedAmount > 0) {
          newStatus = GradingOutputStatus.PARTIALLY_USED;
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

  async deallocateSingle(
    tenantId: string,
    allocationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ repackUnitId: string; gradingOutputId: string; amountRestored: number; costRestored: number }> {
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
      if (!allocation) throw new NotFoundException('Allocation not found');

      const output = await tx.gradeOutput.findFirst({
        where: { id: allocation.gradingOutputId, tenantId },
        select: { id: true, totalAmount: true, usedAmount: true, remainingAmount: true, status: true },
      });
      if (!output) throw new NotFoundException('Grading output not found');

      const amount = Number(allocation.amountUsed);
      const newUsedAmount = Number(output.usedAmount) - amount;
      if (newUsedAmount < -0.001) {
        throw new ConflictException('Invalid deallocation: usedAmount would become negative');
      }
      const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;

      let newStatus = output.status;
      if (newUsedAmount <= 0.001) {
        newStatus = GradingOutputStatus.AVAILABLE;
      } else if (newRemainingAmount > 0) {
        newStatus = GradingOutputStatus.PARTIALLY_USED;
      } else {
        newStatus = GradingOutputStatus.DEPLETED;
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

  /**
   * FIFO MODE: Automatically allocate from oldest grading outputs
   * 
   * Algorithm:
   * 1. Query eligible GradingOutputs (same tenant, category, grade, measurementType, status != DEPLETED)
   * 2. Sort by gradeSession.endTime ASC (oldest first)
   * 3. Allocate sequentially until targetAmount is fulfilled
   * 4. Create RepackInputAllocation records
   * 5. Update GradingOutput balances atomically
   * 
   * @param tenantId - Tenant identifier
   * @param repackUnitId - Target repack unit
   * @param categoryId - Required category filter
   * @param gradeId - Required grade filter
   * @param measurementType - WEIGHT or QUANTITY
   * @param targetAmount - Total amount to allocate
   * @returns AllocationResult with created allocations
   */
  async allocateFIFO(
    tenantId: string,
    repackUnitId: string,
    categoryId: string,
    gradeId: string,
    measurementType: MeasurementType,
    targetAmount: number,
  ): Promise<AllocationResult> {
    return this.prisma.$transaction(async (tx) => {
      // Step 1: Fetch eligible GradingOutputs with traceability chain
      const eligibleOutputs = await tx.gradeOutput.findMany({
        where: {
          tenantId,
          gradeId,
          measurementType,
          status: {
            in: [GradingOutputStatus.READY_FOR_REPACK], // FIX-2
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
              endTime: 'asc', // FIFO: oldest first
            },
          },
        },
      });

      if (eligibleOutputs.length === 0) {
        throw new BadRequestException(
          `No eligible grading outputs found for FIFO allocation. Category: ${categoryId}, Grade: ${gradeId}, Type: ${measurementType}`,
        );
      }

      // Step 2: Allocate sequentially until target is met
      const allocations: any[] = [];
      let remainingToAllocate = targetAmount;
      let totalCost = 0;

      for (const output of eligibleOutputs) {
        if (remainingToAllocate <= 0) break;

        const amountToTake = Math.min(
          Number(output.remainingAmount),
          remainingToAllocate,
        );

        // Calculate proportional cost (guard against invalid data)
        const totalAmountNum = Number(output.totalAmount);
        const allocatedCostNum = Number(output.allocatedCost);
        if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
          throw new BadRequestException(`Invalid grading output totalAmount for cost calculation: ${output.id}`);
        }
        if (!Number.isFinite(allocatedCostNum) || allocatedCostNum < 0) {
          throw new BadRequestException(`Invalid grading output allocatedCost for cost calculation: ${output.id}`);
        }
        const costPerUnit = allocatedCostNum / totalAmountNum;
        const allocationCost = costPerUnit * amountToTake;
        if (!Number.isFinite(allocationCost)) {
          throw new BadRequestException(`Invalid allocation cost computed for grading output: ${output.id}`);
        }

        // Extract traceability data (all relations should be included in query)
        const sortSession = output.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession;
        const rag = sortSession?.rag;
        const containerId = rag?.containerId || null;
        const ragBaleId = rag?.id || null;

        // Create allocation record
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

        // Update GradingOutput balances
        const newUsedAmount = Number(output.usedAmount) + amountToTake;
        const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
        
        let newStatus = output.status;
        if (newRemainingAmount <= 0) {
          newStatus = GradingOutputStatus.DEPLETED;
        } else if (newUsedAmount > 0) {
          newStatus = GradingOutputStatus.PARTIALLY_USED;
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

      // Step 3: Validate that target amount was fully allocated
      if (remainingToAllocate > 0.001) {
        // Allow small floating point tolerance
        throw new BadRequestException(
          `Insufficient stock for FIFO allocation. Requested: ${targetAmount}, Allocated: ${targetAmount - remainingToAllocate}, Shortage: ${remainingToAllocate}`,
        );
      }

      return {
        allocations,
        totalAllocated: targetAmount,
        totalCost,
      };
    });
  }

  /**
   * MANUAL MODE: Validate and persist user-defined allocations
   * 
   * Validation Rules:
   * 1. Each gradingOutputId must exist and belong to tenant
   * 2. Each gradingOutput must have measurementType matching repack unit
   * 3. Each gradingOutput must have remainingAmount >= amountUsed
   * 4. Sum(amountUsed) must equal targetAmount exactly
   * 5. No duplicate gradingOutputId allowed
   * 
   * @param tenantId - Tenant identifier
   * @param repackUnitId - Target repack unit
   * @param measurementType - WEIGHT or QUANTITY
   * @param targetAmount - Total amount required
   * @param manualAllocations - User-provided allocation inputs
   * @returns AllocationResult with created allocations
   */
  async allocateManual(
    tenantId: string,
    repackUnitId: string,
    measurementType: MeasurementType,
    targetAmount: number,
    manualAllocations: ManualAllocationInput[],
  ): Promise<AllocationResult> {
    return this.prisma.$transaction(async (tx) => {
      // Step 1: Validate no duplicates
      const gradingOutputIds = manualAllocations.map((a) => a.gradingOutputId);
      const uniqueIds = new Set(gradingOutputIds);
      if (uniqueIds.size !== gradingOutputIds.length) {
        throw new BadRequestException('Duplicate grading output IDs detected in manual allocation');
      }

      // Step 2: Validate total amount
      const totalRequested = manualAllocations.reduce((sum, a) => sum + a.amountUsed, 0);
      if (Math.abs(totalRequested - targetAmount) > 0.001) {
        throw new BadRequestException(
          `Manual allocation total (${totalRequested}) does not match target amount (${targetAmount})`,
        );
      }

      // Step 3: Fetch and validate all grading outputs
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
        throw new NotFoundException(
          `Some grading outputs not found. Expected: ${manualAllocations.length}, Found: ${outputs.length}`,
        );
      }

      // Step 4: Validate each allocation
      const allocations: any[] = [];
      let totalCost = 0;

      for (const allocationInput of manualAllocations) {
        const output = outputs.find((o) => o.id === allocationInput.gradingOutputId);
        if (!output) {
          throw new NotFoundException(`Grading output ${allocationInput.gradingOutputId} not found`);
        }

        // Validate measurementType match
        if (output.measurementType !== measurementType) {
          throw new BadRequestException(
            `Grading output ${output.id} has measurementType ${output.measurementType}, expected ${measurementType}`,
          );
        }

        // Validate sufficient remaining amount
        if (Number(output.remainingAmount) < allocationInput.amountUsed) {
          throw new BadRequestException(
            `Insufficient remaining amount in grading output ${output.id}. Requested: ${allocationInput.amountUsed}, Available: ${output.remainingAmount}`,
          );
        }

        // Validate not depleted
        if (output.status === GradingOutputStatus.DEPLETED) {
          throw new ConflictException(`Grading output ${output.id} is already depleted`);
        }

        // Calculate proportional cost (guard against invalid data)
        const totalAmountNum = Number(output.totalAmount);
        const allocatedCostNum = Number(output.allocatedCost);
        if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
          throw new BadRequestException(`Invalid grading output totalAmount for cost calculation: ${output.id}`);
        }
        if (!Number.isFinite(allocatedCostNum) || allocatedCostNum < 0) {
          throw new BadRequestException(`Invalid grading output allocatedCost for cost calculation: ${output.id}`);
        }
        const costPerUnit = allocatedCostNum / totalAmountNum;
        const allocationCost = costPerUnit * allocationInput.amountUsed;
        if (!Number.isFinite(allocationCost)) {
          throw new BadRequestException(`Invalid allocation cost computed for grading output: ${output.id}`);
        }

        // Extract traceability data (may be missing for legacy/partial records)
        const sortSession = output.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession;
        const rag = sortSession?.rag;
        const containerId = rag?.containerId || null;
        const ragBaleId = rag?.id || null;

        // Create allocation record
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

        // Update GradingOutput balances
        const newUsedAmount = Number(output.usedAmount) + allocationInput.amountUsed;
        const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
        
        let newStatus: 'AVAILABLE' | 'PARTIALLY_USED' | 'DEPLETED' | 'READY_FOR_REPACK' = output.status;
        if (newRemainingAmount <= 0) {
          newStatus = 'DEPLETED';
        } else if (newUsedAmount > 0) {
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

  /**
   * Deallocate all allocations for a repack unit (when editing DRAFT)
   * Reverses GradingOutput balances atomically
   * 
   * @param tenantId - Tenant identifier
   * @param repackUnitId - Repack unit to deallocate
   */
  async deallocate(tenantId: string, repackUnitId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Fetch existing allocations
      const allocations = await tx.repackInputAllocation.findMany({
        where: {
          tenantId,
          repackUnitId,
        },
      });

      // Reverse each allocation
      for (const allocation of allocations) {
        const output = await tx.gradeOutput.findUnique({
          where: { id: allocation.gradingOutputId },
        });

        if (output) {
          const newUsedAmount = Number(output.usedAmount) - Number(allocation.amountUsed);
          const newRemainingAmount = Number(output.totalAmount) - newUsedAmount;
          
          let newStatus: 'AVAILABLE' | 'PARTIALLY_USED' | 'DEPLETED' | 'READY_FOR_REPACK' = 'AVAILABLE';
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

      // Delete allocation records
      await tx.repackInputAllocation.deleteMany({
        where: {
          tenantId,
          repackUnitId,
        },
      });
    });
  }

  /**
   * Get available stock for a category/grade combination
   * Used by frontend to show available amounts for manual allocation
   * 
   * @param tenantId - Tenant identifier
   * @param categoryId - Category filter
   * @param gradeId - Grade filter
   * @param measurementType - WEIGHT or QUANTITY
   * @returns List of available grading outputs with remaining amounts
   */
  async getAvailableStock(
    tenantId: string,
    categoryId: string,
    gradeId: string,
    measurementType: MeasurementType,
  ) {
    const outputs = await this.prisma.gradeOutput.findMany({
      where: {
        tenantId,
        gradeId,
        measurementType,
        status: {
          in: [GradingOutputStatus.READY_FOR_REPACK], // FIX-2
        },
        remainingAmount: {
          gt: 0,
        },
        gradeBucket: {
          gradeSession: {
            categoryOutput: {
              categoryId: categoryId, // Filter by category
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
        createdAt: 'asc', // Show oldest first for FIFO preview
      },
    });

    // Transform to flat structure expected by frontend
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
}
