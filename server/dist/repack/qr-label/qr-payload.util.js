"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeQrPayload = encodeQrPayload;
const crypto_1 = require("crypto");
function encodeQrPayload(payload) {
    const json = JSON.stringify(payload);
    const hash = (0, crypto_1.createHash)('sha256').update(json).digest('hex').slice(0, 16);
    return `thriftos:v3:unit:${payload.unitId}:${hash}`;
}
//# sourceMappingURL=qr-payload.util.js.map