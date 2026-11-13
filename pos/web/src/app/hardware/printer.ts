import { inject, Injectable, signal } from '@angular/core';
import { Api, Bale, Sale } from '../core';
import { drawerBytes, receiptBytes, ReceiptModel, reportBytes } from './escpos';
import { labelData, receiptModel } from './receipt';
import { labelBytes, LabelData } from './tspl';

/** How this device reaches a printer. `window` is the browser's own print window (any printer). */
export type Link = 'window' | 'usb' | 'serial' | 'ble' | 'network';
export const LINKS: { key: Link; label: string; help: string }[] = [
  { key: 'window', label: 'Print window', help: 'Any printer this device already has. Shows the print window each time; cannot open a cash drawer.' },
  { key: 'usb', label: 'USB', help: 'Thermal printer on a USB cable. Chrome or Edge on a computer or Android.' },
  { key: 'network', label: 'Network (LAN / Wi-Fi)', help: 'Printer with its own address on the shop network. Works from every device, iPhone and iPad too.' },
  { key: 'ble', label: 'Bluetooth', help: 'Small Bluetooth printers. Chrome on Android or a computer. Connect again after reopening the app.' },
  { key: 'serial', label: 'Serial / COM port', help: 'Printers on a COM port, or paired as a Bluetooth serial port. Chrome or Edge on a computer.' },
];

export interface HardwareConfig {
  receipt: { link: Link; width: 80 | 58; host: string; port: number; baud: number; id: string; drawer: boolean; auto: boolean };
  label: { link: Link; widthMm: number; heightMm: number; gapMm: number; host: string; port: number; baud: number; id: string };
}
const DEFAULTS: HardwareConfig = {
  receipt: { link: 'window', width: 80, host: '', port: 9100, baud: 9600, id: '', drawer: true, auto: false },
  label: { link: 'window', widthMm: 50, heightMm: 30, gapMm: 2, host: '', port: 9100, baud: 9600, id: '' },
};
const KEY = 'thriftos-pos-hardware';

export type PrintJob =
  | { kind: 'receipt'; model: ReceiptModel; widthMm: number }
  | { kind: 'labels'; labels: LabelData[]; widthMm: number; heightMm: number }
  | { kind: 'report'; title: string; sub: string[]; rows: ([string, string] | null)[]; widthMm: number };

type Which = 'receipt' | 'label';
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

// Bluetooth printers do not share one standard; these are the services the common ones use.
const BLE_SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb'];

/** Receipt printer, cash drawer and sticker printer of this device. Settings are kept per device, not per shop. */
@Injectable({ providedIn: 'root' })
export class Printer {
  private readonly api = inject(Api);
  readonly config = signal<HardwareConfig>(this.load());
  /** What the print window should show; drawn by the print host in the app shell. */
  readonly job = signal<PrintJob | null>(null);

  private readonly usb: Partial<Record<Which, Any>> = {};
  private readonly serial: Partial<Record<Which, Any>> = {};
  private readonly ble: Partial<Record<Which, Any>> = {};

  private load(): HardwareConfig {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      return { receipt: { ...DEFAULTS.receipt, ...saved.receipt }, label: { ...DEFAULTS.label, ...saved.label } };
    } catch {
      return DEFAULTS;
    }
  }

  save(config: HardwareConfig) {
    localStorage.setItem(KEY, JSON.stringify(config));
    this.config.set(config);
  }

  /** Can this browser use this kind of connection at all? */
  supports(link: Link): boolean {
    const n = navigator as Any;
    if (link === 'usb') return !!n.usb;
    if (link === 'serial') return !!n.serial;
    if (link === 'ble') return !!n.bluetooth;
    return true;
  }

  get direct(): boolean {
    return this.config().receipt.link !== 'window';
  }

  // ---- What the shop prints ----

  async receipt(sale: Sale, opts: { drawer?: boolean } = {}) {
    const shop = this.api.shop();
    if (!shop) return;
    const cfg = this.config().receipt;
    const model = receiptModel(sale, shop, this.api.branch());
    if (cfg.link === 'window') return this.window({ kind: 'receipt', model, widthMm: cfg.width });
    await this.send('receipt', receiptBytes(model, cfg.width === 58 ? 32 : 48, { drawer: opts.drawer && cfg.drawer }));
  }

  /** Opens the cash drawer through the receipt printer. False when this device prints through the print window. */
  async drawer(): Promise<boolean> {
    const cfg = this.config().receipt;
    if (cfg.link === 'window' || !cfg.drawer) return false;
    await this.send('receipt', drawerBytes());
    return true;
  }

  async report(title: string, sub: string[], rows: ([string, string] | null)[]) {
    const cfg = this.config().receipt;
    if (cfg.link === 'window') return this.window({ kind: 'report', title, sub, rows, widthMm: cfg.width });
    await this.send('receipt', reportBytes(title, sub, rows, cfg.width === 58 ? 32 : 48));
  }

  async labels(bales: Bale[]) {
    const cfg = this.config().label;
    const labels = bales.map(labelData);
    if (cfg.link === 'window') return this.window({ kind: 'labels', labels, widthMm: cfg.widthMm, heightMm: cfg.heightMm });
    await this.send('label', labelBytes(labels, cfg));
  }

  // ---- Ways to reach a printer ----

  private window(job: PrintJob): Promise<void> {
    return new Promise((resolve) => {
      let style = document.getElementById('pos-page') as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = 'pos-page';
        document.head.appendChild(style);
      }
      style.textContent = job.kind === 'labels' ? `@page { size: ${job.widthMm}mm ${job.heightMm}mm; margin: 0 }` : `@page { size: ${job.widthMm}mm auto; margin: 0 }`;
      this.job.set(job);
      const done = () => {
        window.removeEventListener('afterprint', done);
        this.job.set(null);
        resolve();
      };
      window.addEventListener('afterprint', done);
      // Give the print host a moment to draw the bill (and its barcode) before the window opens.
      setTimeout(() => window.print(), 150);
    });
  }

  /** Asks the person to pick the device (needs a tap). Returns its name. */
  async connect(which: Which): Promise<string> {
    const cfg = this.config()[which];
    const n = navigator as Any;
    if (cfg.link === 'usb') {
      const dev = await n.usb.requestDevice({ filters: [] });
      this.usb[which] = dev;
      this.remember(which, `${dev.vendorId}:${dev.productId}`);
      return dev.productName || 'USB printer';
    }
    if (cfg.link === 'serial') {
      const port = await n.serial.requestPort();
      this.serial[which] = port;
      const info = port.getInfo?.() ?? {};
      this.remember(which, `${info.usbVendorId ?? ''}:${info.usbProductId ?? ''}`);
      return 'Serial printer';
    }
    if (cfg.link === 'ble') {
      const dev = await n.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
      this.ble[which] = await this.bleWriter(dev);
      return dev.name || 'Bluetooth printer';
    }
    return '';
  }

  private remember(which: Which, id: string) {
    const config = this.config();
    this.save({ ...config, [which]: { ...config[which], id } });
  }

  private async send(which: Which, bytes: Uint8Array) {
    const cfg = this.config()[which];
    if (cfg.link === 'network') {
      if (!cfg.host) throw new Error('Type the printer address in Settings, Hardware.');
      let text = '';
      for (let i = 0; i < bytes.length; i += 4096) text += String.fromCharCode(...bytes.subarray(i, i + 4096));
      await this.api.post('/print/network', { host: cfg.host, port: cfg.port, data: btoa(text) });
    } else if (cfg.link === 'usb') await this.sendUsb(which, bytes, cfg.id);
    else if (cfg.link === 'serial') await this.sendSerial(which, bytes, cfg.id, cfg.baud);
    else if (cfg.link === 'ble') await this.sendBle(which, bytes);
  }

  private async sendUsb(which: Which, bytes: Uint8Array, id: string) {
    const usb = (navigator as Any).usb;
    if (!usb) throw new Error('This browser cannot use USB printers. Use Chrome or Edge, or choose another connection in Settings.');
    let dev = this.usb[which];
    if (!dev) {
      const known: Any[] = await usb.getDevices();
      dev = known.find((d) => `${d.vendorId}:${d.productId}` === id) ?? (known.length === 1 ? known[0] : undefined);
    }
    if (!dev) throw new Error('The USB printer is not connected yet. Connect it once in Settings, Hardware.');
    this.usb[which] = dev;
    if (!dev.opened) await dev.open();
    if (!dev.configuration) await dev.selectConfiguration(1);
    let target: { iface: number; endpoint: number } | null = null;
    for (const iface of dev.configuration.interfaces) {
      for (const alt of iface.alternates) {
        const out = alt.endpoints.find((e: Any) => e.direction === 'out' && e.type === 'bulk');
        if (out && !target) target = { iface: iface.interfaceNumber, endpoint: out.endpointNumber };
      }
    }
    if (!target) throw new Error('This USB device does not look like a printer.');
    if (!dev.configuration.interfaces.find((i: Any) => i.interfaceNumber === target!.iface)?.claimed) await dev.claimInterface(target.iface);
    for (let i = 0; i < bytes.length; i += 8192) await dev.transferOut(target.endpoint, bytes.subarray(i, i + 8192));
  }

  private async sendSerial(which: Which, bytes: Uint8Array, id: string, baudRate: number) {
    const serial = (navigator as Any).serial;
    if (!serial) throw new Error('This browser cannot use serial printers. Use Chrome or Edge on a computer.');
    let port = this.serial[which];
    if (!port) {
      const known: Any[] = await serial.getPorts();
      port = known.find((p) => {
        const info = p.getInfo?.() ?? {};
        return `${info.usbVendorId ?? ''}:${info.usbProductId ?? ''}` === id;
      }) ?? (known.length === 1 ? known[0] : undefined);
    }
    if (!port) throw new Error('The serial printer is not connected yet. Connect it once in Settings, Hardware.');
    this.serial[which] = port;
    if (!port.writable) await port.open({ baudRate });
    const writer = port.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  }

  private async bleWriter(dev: Any) {
    const server = await dev.gatt.connect();
    for (const service of await server.getPrimaryServices()) {
      for (const c of await service.getCharacteristics()) {
        if (c.properties.write || c.properties.writeWithoutResponse) return c;
      }
    }
    throw new Error('This Bluetooth device does not look like a printer.');
  }

  private async sendBle(which: Which, bytes: Uint8Array) {
    let c = this.ble[which];
    if (!c) throw new Error('The Bluetooth printer is not connected. Connect it in Settings, Hardware (needed again after the app was closed).');
    if (!c.service.device.gatt.connected) c = this.ble[which] = await this.bleWriter(c.service.device);
    // Bluetooth printers take small pieces, with a short breath between them.
    for (let i = 0; i < bytes.length; i += 180) {
      const piece = bytes.subarray(i, i + 180);
      if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(piece);
      else await c.writeValue(piece);
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}
