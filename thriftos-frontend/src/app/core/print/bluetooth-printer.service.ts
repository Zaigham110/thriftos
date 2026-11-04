import { Injectable, signal } from '@angular/core';
import { chunks } from './escpos';

/** Minimal Web Bluetooth types (not in TypeScript's DOM library). */
interface BtCharacteristic {
  uuid: string;
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse?(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
  writeValue(data: BufferSource): Promise<void>;
}
interface BtService {
  getCharacteristics(): Promise<BtCharacteristic[]>;
}
interface BtServer {
  connected: boolean;
  connect(): Promise<BtServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BtService[]>;
}
interface BtDevice extends EventTarget {
  name?: string;
  gatt?: BtServer;
}
interface BtNavigator {
  bluetooth?: { requestDevice(options: object): Promise<BtDevice> };
}

/**
 * The write services of common market printers (Xprinter, GOOJPRT, MTP-II, Rongta, Munbyn, "BlueTooth Printer" and
 * other unbranded 58/80 mm models). A printer is found by any of these; the first writable characteristic is used.
 */
export const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
];

export type PrinterError = 'unsupported' | 'cancelled' | 'notAPrinter' | 'failed';

/**
 * A Bluetooth thermal printer through Web Bluetooth (Chrome on Android, Windows and Mac; not on iPhone). The person
 * picks the printer once per app session; it reconnects by itself when it was switched off and on.
 */
@Injectable({ providedIn: 'root' })
export class BluetoothPrinterService {
  readonly name = signal<string | null>(null);
  private device: BtDevice | null = null;
  private target: BtCharacteristic | null = null;
  /** Bytes per write; drops to 20 when the printer refuses bigger pieces. */
  private chunkSize = 180;

  get supported(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as unknown as BtNavigator).bluetooth;
  }

  /** Asks the person to pick their printer (the browser's own list). */
  async choose(): Promise<void> {
    const bt = (navigator as unknown as BtNavigator).bluetooth;
    if (!bt) throw this.err('unsupported');
    let device: BtDevice;
    try {
      device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
    } catch (e) {
      throw this.err((e as Error)?.name === 'NotFoundError' ? 'cancelled' : 'failed');
    }
    this.forget();
    this.device = device;
    device.addEventListener('gattserverdisconnected', () => (this.target = null));
    await this.connect();
    this.name.set(device.name || 'Printer');
  }

  forget(): void {
    try {
      this.device?.gatt?.disconnect();
    } catch {
      /* already gone */
    }
    this.device = null;
    this.target = null;
    this.name.set(null);
  }

  /** Sends the bytes; picks a printer first if none is chosen yet. */
  async print(bytes: Uint8Array): Promise<void> {
    if (!this.device) await this.choose();
    if (!this.target) await this.connect();
    const target = this.target!;
    const pieces = chunks(bytes, this.chunkSize);
    for (let i = 0; i < pieces.length; i++) {
      try {
        await this.write(target, pieces[i]);
      } catch {
        if (this.chunkSize > 20) {
          // Older printers only take 20 bytes at a time: resend the rest in small pieces.
          this.chunkSize = 20;
          return this.print(bytes.subarray(i * 180));
        }
        this.target = null;
        throw this.err('failed');
      }
    }
  }

  private async write(c: BtCharacteristic, data: Uint8Array): Promise<void> {
    const copy = data.slice(); // a fresh ArrayBuffer of exactly this piece
    if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) {
      await c.writeValueWithoutResponse(copy);
      await new Promise((r) => setTimeout(r, 8)); // let the printer's small buffer drain
    } else if (c.writeValueWithResponse) {
      await c.writeValueWithResponse(copy);
    } else {
      await c.writeValue(copy);
    }
  }

  private async connect(): Promise<void> {
    const gatt = this.device?.gatt;
    if (!gatt) throw this.err('notAPrinter');
    let server: BtServer;
    try {
      server = gatt.connected ? gatt : await gatt.connect();
    } catch {
      throw this.err('failed');
    }
    const services = await server.getPrimaryServices().catch(() => [] as BtService[]);
    for (const service of services) {
      const chars = await service.getCharacteristics().catch(() => [] as BtCharacteristic[]);
      const writable = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
      if (writable) {
        this.target = writable;
        return;
      }
    }
    throw this.err('notAPrinter');
  }

  private err(code: PrinterError): Error {
    const e = new Error(code);
    e.name = 'PrinterError';
    return e;
  }
}
