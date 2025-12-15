import { createHash } from 'crypto';

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

/**
 * Generate a stable, unique string for storing in QRLabel.qrCode.
 * We store a compact payload and a hash to keep it short and unique.
 */
export function encodeQrPayload(payload: QrPayload): string {
  const json = JSON.stringify(payload);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
  // prefix helps future-proofing and makes the string recognizable
  return `thriftos:v3:unit:${payload.unitId}:${hash}`;
}


