import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';

/**
 * Uploaded files (payment screenshots). Stored on local disk under UPLOAD_DIR (default
 * ./uploads). Files are referred to by a storage key ("local:<path>") so an S3-compatible
 * store can be added later without changing stored rows.
 */
@Injectable()
export class FileStorageService {
  private readonly root = resolve(process.env.UPLOAD_DIR || 'uploads');

  async save(path: string, data: Buffer): Promise<string> {
    const file = this.resolve(path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
    return `local:${path}`;
  }

  async read(key: string): Promise<Buffer> {
    if (!key.startsWith('local:')) throw new NotFoundException('File not found');
    try {
      return await readFile(this.resolve(key.slice('local:'.length)));
    } catch {
      throw new NotFoundException('File not found');
    }
  }

  private resolve(path: string): string {
    const file = resolve(join(this.root, path));
    if (!file.startsWith(this.root + sep)) throw new BadRequestException('Invalid file path');
    return file;
  }
}
