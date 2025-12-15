"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDateRange = parseDateRange;
exports.toCsv = toCsv;
const common_1 = require("@nestjs/common");
function parseDateRange(filters, maxDays = 366) {
    const start = filters.startDate ? new Date(filters.startDate) : undefined;
    const end = filters.endDate ? new Date(filters.endDate) : undefined;
    if (start && isNaN(start.getTime()))
        throw new common_1.BadRequestException('Invalid startDate');
    if (end && isNaN(end.getTime()))
        throw new common_1.BadRequestException('Invalid endDate');
    if (start && end && start > end)
        throw new common_1.BadRequestException('startDate must be <= endDate');
    if (start && end) {
        const diffMs = end.getTime() - start.getTime();
        const days = diffMs / (1000 * 60 * 60 * 24);
        if (days > maxDays)
            throw new common_1.BadRequestException('Date range too large');
    }
    return { start, end };
}
function toCsv(rows, columns) {
    if (!rows || rows.length === 0) {
        const cols = columns ?? [];
        return cols.join(',') + '\n';
    }
    const cols = columns ?? Object.keys(rows[0]);
    const escape = (v) => {
        if (v === null || v === undefined)
            return '';
        const s = String(v);
        if (/[",\n]/.test(s))
            return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const header = cols.join(',');
    const lines = rows.map((r) => cols.map((c) => escape(r[c])).join(','));
    return [header, ...lines].join('\n') + '\n';
}
//# sourceMappingURL=report-utils.js.map