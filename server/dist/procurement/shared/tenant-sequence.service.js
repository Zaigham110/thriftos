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
exports.TenantSequenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let TenantSequenceService = class TenantSequenceService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async next(tenantId, scope) {
        const record = await this.prisma.$transaction((tx) => tx.tenantSequence.upsert({
            where: { tenantId_scope: { tenantId, scope } },
            update: { nextNumber: { increment: 1 } },
            create: { tenantId, scope, nextNumber: 2 },
        }));
        return Math.max(record.nextNumber - 1, 1);
    }
    formatCode(sequence, options = {}) {
        const delimiter = options.delimiter ?? '-';
        const padSize = options.padSize ?? 4;
        const includeYear = options.includeYear ?? true;
        const year = options.yearOverride ?? new Date().getFullYear();
        const parts = [];
        if (options.prefix) {
            parts.push(options.prefix);
        }
        if (includeYear) {
            parts.push(String(year));
        }
        parts.push(sequence.toString().padStart(padSize, '0'));
        if (options.suffix) {
            parts.push(options.suffix);
        }
        return parts.join(delimiter);
    }
    async generateCode(tenantId, scope, options, uniquenessCheck) {
        const maxAttempts = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const sequence = await this.next(tenantId, scope);
            const code = this.formatCode(sequence, options);
            if (!uniquenessCheck || (await uniquenessCheck(code))) {
                return { code, sequence };
            }
        }
        throw new Error(`Unable to generate unique code for scope ${scope}`);
    }
};
exports.TenantSequenceService = TenantSequenceService;
exports.TenantSequenceService = TenantSequenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantSequenceService);
//# sourceMappingURL=tenant-sequence.service.js.map