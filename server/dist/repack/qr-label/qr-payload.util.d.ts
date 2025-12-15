export interface QrPayload {
    unitId: string;
    unitCode: string;
    category?: string | null;
    grade?: string | null;
    weightKg: string;
    pcsCount: number;
    totalCost: string;
    createdAt: string;
}
export declare function encodeQrPayload(payload: QrPayload): string;
