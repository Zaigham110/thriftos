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
exports.ReportsAuditService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
let ReportsAuditService = class ReportsAuditService {
    constructor(audit) {
        this.audit = audit;
    }
    async logAccess(input) {
        await this.audit.log({
            tenantId: input.tenantId,
            userId: input.userId,
            action: input.exported ? 'REPORT_EXPORTED' : 'REPORT_ACCESSED',
            entityType: 'Report',
            entityId: input.report,
            metadataJson: input.params,
        });
    }
};
exports.ReportsAuditService = ReportsAuditService;
exports.ReportsAuditService = ReportsAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], ReportsAuditService);
//# sourceMappingURL=reports-audit.service.js.map