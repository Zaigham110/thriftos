/**
 * USB and Bluetooth barcode scanners "type" the code like a very fast keyboard and then press Enter. This tells a
 * scan from a person typing: every key comes within `gapMs` of the one before, and there are `minLength` or more.
 */
export class ScanDetector {
  private buffer = '';
  private last = 0;
  private slow = false;

  private readonly gapMs: number;
  private readonly minLength: number;

  constructor(gapMs = 50, minLength = 4) {
    this.gapMs = gapMs;
    this.minLength = minLength;
  }

  /** Feed every key press with its time (ms). Returns the code when a scan just finished, otherwise null. */
  key(key: string, at: number): string | null {
    const gap = at - this.last;
    this.last = at;
    if (key === 'Enter') {
      const code = this.buffer;
      const scanned = !this.slow && gap <= this.gapMs && code.length >= this.minLength;
      this.buffer = '';
      this.slow = false;
      return scanned ? code : null;
    }
    if (key.length !== 1) return null; // Shift, arrows: not part of a code, and not a break either
    if (this.buffer && gap > this.gapMs) {
      // A pause: whatever came before was typed by hand. Start again from this key.
      this.buffer = '';
      this.slow = false;
    }
    this.buffer += key;
    return null;
  }
}
