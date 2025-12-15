"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenFromName = tokenFromName;
exports.formatYYYYMMDD = formatYYYYMMDD;
exports.formatSeq = formatSeq;
function tokenFromName(name, maxLen) {
    const cleaned = (name || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, maxLen);
    return cleaned || 'NA';
}
function formatYYYYMMDD(date) {
    const yyyy = date.getUTCFullYear().toString();
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = date.getUTCDate().toString().padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}
function formatSeq(seq, width = 4) {
    return seq.toString().padStart(width, '0');
}
//# sourceMappingURL=unit-code.util.js.map