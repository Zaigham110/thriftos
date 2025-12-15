"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepackSessionModule = void 0;
const common_1 = require("@nestjs/common");
const repack_session_controller_1 = require("./repack-session.controller");
const repack_session_service_1 = require("./repack-session.service");
let RepackSessionModule = class RepackSessionModule {
};
exports.RepackSessionModule = RepackSessionModule;
exports.RepackSessionModule = RepackSessionModule = __decorate([
    (0, common_1.Module)({
        controllers: [repack_session_controller_1.RepackSessionController],
        providers: [repack_session_service_1.RepackSessionService],
        exports: [repack_session_service_1.RepackSessionService],
    })
], RepackSessionModule);
//# sourceMappingURL=repack-session.module.js.map