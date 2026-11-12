import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { FileStorageService } from '../common/storage/file-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES, RECORD_TYPES, RecordType } from './record-types';

export interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

export interface ActivityItem {
  id: string;
  at: Date;
  kind: 'change' | 'note' | 'attachment';
  who: string;
  /** Audit action code for changes (the app words it), e.g. SALE_CREATED. */
  action?: string;
  metadata?: unknown;
  text?: string;
  attachment?: { id: string; fileName: string; contentType: string; size: number };
}

type Delegate = { findFirst(args: object): Promise<Record<string, unknown> | null> };

/** Activity panel data for any record (enterprise plan E2.4): history, notes, attachments, mentions. */
/** The signed-in person, as far as record access needs. */
export interface Actor { userId: string; isSuperAdmin: boolean }

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileStorageService,
  ) {}

  private type(type: string): RecordType {
    const t = RECORD_TYPES[type];
    if (!t) throw new NotFoundException(`No record type "${type}"`);
    return t;
  }

  /** The record, if it belongs to this business (404 otherwise, so ids from other businesses tell nothing). */
  /**
   * A record's activity, notes and files are for people who may open the record itself (audit 2026-11): a sale's
   * for people who sell, take payments or keep the books; a container's for people who see containers; and so on.
   */
  async assertMay(user: Actor, type: string, doing: 'read' | 'write'): Promise<void> {
    const t = this.type(type);
    if (user.isSuperAdmin) return;
    const anyOf = doing === 'write' ? (t.write ?? t.read) : t.read;
    const held = await this.prisma.rolePermission.count({ where: { role: { userRoles: { some: { userId: user.userId } } }, permission: { code: { in: [...anyOf] } } } });
    if (!held) throw new ForbiddenException(`Missing required permissions: one of ${anyOf.join(', ')}`);
  }

  private async record(tenantId: string, type: string, id: string): Promise<{ t: RecordType; label: string }> {
    const t = this.type(type);
    const r = await (this.prisma[t.model] as unknown as Delegate).findFirst({ where: { id, tenantId }, select: { id: true, [t.labelField]: true } });
    if (!r) throw new NotFoundException('Record not found');
    return { t, label: String(r[t.labelField] ?? '') };
  }

  async activity(tenantId: string, type: string, id: string, user: Actor): Promise<ActivityItem[]> {
    await this.assertMay(user, type, 'read');
    const { t } = await this.record(tenantId, type, id);
    const [audit, notes, attachments] = await Promise.all([
      this.prisma.auditLog.findMany({ where: { tenantId, OR: [{ entityType: { in: t.auditEntities }, entityId: id }, ...(await this.lotSteps(tenantId, type, id))] }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.recordNote.findMany({ where: { tenantId, recordType: type, recordId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.attachment.findMany({ where: { tenantId, recordType: type, recordId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    const userIds = [...new Set([...audit.map((a) => a.userId), ...notes.map((n) => n.authorId), ...attachments.map((a) => a.uploadedBy)].filter((x): x is string => !!x))];
    const users = new Map((await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    const who = (id: string | null) => (id ? users.get(id) ?? '' : '');
    const items: ActivityItem[] = [
      ...audit.map((a) => ({ id: a.id, at: a.createdAt, kind: 'change' as const, who: who(a.userId), action: a.action, metadata: a.metadataJson ?? undefined })),
      ...notes.map((n) => ({ id: n.id, at: n.createdAt, kind: 'note' as const, who: who(n.authorId), text: n.text })),
      ...attachments.map((a) => ({ id: a.id, at: a.createdAt, kind: 'attachment' as const, who: who(a.uploadedBy), attachment: { id: a.id, fileName: a.fileName, contentType: a.contentType, size: a.size } })),
    ];
    return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 100);
  }

  /**
   * A lot's history also shows its work (v2 cycle review): sorting started and closed, each grading started and
   * finished. Single entries are left out (the sorting screen lists them).
   */
  private async lotSteps(tenantId: string, type: string, id: string): Promise<Prisma.AuditLogWhereInput[]> {
    if (type !== 'lot') return [];
    const [sorts, grades] = await Promise.all([
      this.prisma.sortSession.findMany({ where: { tenantId, ragId: id }, select: { id: true } }),
      this.prisma.gradeSession.findMany({ where: { tenantId, categoryOutput: { ragId: id } }, select: { id: true } }),
    ]);
    return [
      ...(sorts.length ? [{ entityType: 'SortSession', entityId: { in: sorts.map((x) => x.id) }, action: { in: ['SORT_SESSION_CREATED', 'SORT_SESSION_CLOSED'] } }] : []),
      ...(grades.length ? [{ entityType: 'GradeSession', entityId: { in: grades.map((x) => x.id) }, action: { in: ['GRADE_SESSION_CREATED', 'GRADE_SESSION_CLOSED'] } }] : []),
    ];
  }

  /** Team members who can be @mentioned (active users of this business). */
  mentionable(tenantId: string, q = '') {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true, ...(q.trim() ? { name: { contains: q.trim(), mode: 'insensitive' } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  async addNote(tenantId: string, type: string, id: string, user: Actor, text: string, mentions: string[] = []) {
    await this.assertMay(user, type, 'write');
    const authorId = user.userId;
    const { t, label } = await this.record(tenantId, type, id);
    const clean = text.trim();
    if (!clean) throw new BadRequestException('Write something first');
    const ids = [...new Set(mentions)].filter((m) => m !== authorId);
    const valid = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids }, tenantId, isActive: true }, select: { id: true } }) : [];
    if (valid.length !== ids.length) throw new BadRequestException('Only people in this business can be mentioned');
    const author = await this.prisma.user.findUnique({ where: { id: authorId }, select: { name: true } });
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.recordNote.create({ data: { tenantId, recordType: type, recordId: id, authorId, text: clean, mentions: ids } });
      if (ids.length) {
        await tx.notification.createMany({
          data: ids.map((userId) => ({ tenantId, userId, kind: 'mention', title: `${author?.name ?? ''} · ${label}`.trim(), body: clean.slice(0, 280), link: t.link(id) })),
        });
      }
      return note;
    });
  }

  async attach(tenantId: string, type: string, id: string, user: Actor, file: UploadedFileLike | undefined) {
    await this.assertMay(user, type, 'write');
    const uploadedBy = user.userId;
    await this.record(tenantId, type, id);
    if (!file) throw new BadRequestException('Choose a file');
    const ext = ATTACHMENT_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException('Attach a photo, PDF, spreadsheet or Word file');
    if (file.size > ATTACHMENT_MAX_BYTES) throw new BadRequestException('The file is larger than 10 MB');
    const storageKey = await this.files.save(`attachments/${tenantId}/${type}/${id}/${randomUUID()}.${ext}`, file.buffer);
    const fileName = (file.originalname || `file.${ext}`).replace(/[\\/\r\n"]/g, '_').slice(0, 200);
    return this.prisma.attachment.create({ data: { tenantId, recordType: type, recordId: id, uploadedBy, fileName, contentType: file.mimetype, size: file.size, storageKey } });
  }

  async download(tenantId: string, attachmentId: string, user: Actor) {
    const a = await this.prisma.attachment.findFirst({ where: { id: attachmentId, tenantId } });
    if (!a) throw new NotFoundException('File not found');
    await this.assertMay(user, a.recordType, 'read');
    return { data: await this.files.read(a.storageKey), type: a.contentType, fileName: a.fileName };
  }

  notifications(tenantId: string, userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { tenantId, userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(tenantId: string, userId: string, id: string | 'all') {
    const r = await this.prisma.notification.updateMany({ where: { tenantId, userId, readAt: null, ...(id === 'all' ? {} : { id }) }, data: { readAt: new Date() } });
    if (id !== 'all' && !r.count) {
      const exists = await this.prisma.notification.count({ where: { id, tenantId, userId } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
  }
}
