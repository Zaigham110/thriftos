"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantSequenceModule = void 0;
const common_1 = require("@nestjs/common");
const tenant_sequence_service_1 = require("./tenant-sequence.service");
let TenantSequenceModule = class TenantSequenceModule {
};
exports.TenantSequenceModule = TenantSequenceModule;
exports.TenantSequenceModule = TenantSequenceModule = __decorate([
    (0, common_1.Module)({
        providers: [tenant_sequence_service_1.TenantSequenceService],
        exports: [tenant_sequence_service_1.TenantSequenceService],
    })
], TenantSequenceModule);
//# sourceMappingURL=tenant-sequence.module.js.map