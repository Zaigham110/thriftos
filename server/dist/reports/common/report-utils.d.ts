export declare function parseDateRange(filters: {
    startDate?: string;
    endDate?: string;
}, maxDays?: number): {
    start: Date;
    end: Date;
};
export declare function toCsv(rows: Record<string, any>[], columns?: string[]): string;
