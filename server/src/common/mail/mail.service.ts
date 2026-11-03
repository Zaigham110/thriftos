import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

/**
 * Transactional email (password reset only). Off unless SMTP_URL is set, e.g.
 * smtps://user:password@email-smtp.ap-southeast-2.amazonaws.com:465 (SES) or any SMTP provider's address.
 * MAIL_FROM is the sender ("ThriftOS <no-reply@example.com>").
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null = process.env.SMTP_URL ? createTransport(process.env.SMTP_URL) : null;

  get configured(): boolean {
    return this.transport !== null;
  }

  async send(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.transport) return false;
    try {
      await this.transport.sendMail({ from: process.env.MAIL_FROM || 'ThriftOS <no-reply@thriftos.app>', to, subject, text });
      return true;
    } catch (e) {
      this.logger.error(`Mail not sent: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }
}
