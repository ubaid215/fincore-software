// src/modules/auth/services/email.service.ts
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface ResendError {
  message: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly fromName: string;
  private readonly appName: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('auth.resendApiKey');
    if (!apiKey) {
      throw new Error('😥 RESEND_API_KEY is not configured. Add it to your .env file.');
    }
    this.resend = new Resend(apiKey);
    this.from = this.config.get<string>('auth.emailFrom') ?? 'noreply@fincore.app';
    this.fromName = this.config.get<string>('auth.emailFromName') ?? 'FinCore';
    this.appName = this.config.get<string>('auth.appName') ?? 'FinCore';
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: `Verify your ${this.appName} email`,
      html: this.wrap(`
        <h2>Verify your email address</h2>
        <p>Thanks for signing up! Click the button below to verify your email address. This link expires in 24 hours.</p>
        ${this.button('Verify Email', verifyUrl)}
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color:#6b7280;font-size:12px;word-break:break-all;">
          Or copy this link: ${verifyUrl}
        </p>
      `),
    });
  }

  async sendMagicLinkEmail(to: string, loginUrl: string, expiryMin: number): Promise<void> {
    await this.send({
      to,
      subject: `Your ${this.appName} sign-in link`,
      html: this.wrap(`
        <h2>Sign in to ${this.appName}</h2>
        <p>Click the button below to sign in. This link expires in ${expiryMin} minutes and can only be used once.</p>
        ${this.button('Sign In', loginUrl)}
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">
          If you didn't request this, you can safely ignore this email. Your account is secure.
        </p>
        <p style="color:#6b7280;font-size:12px;word-break:break-all;">
          Or copy this link: ${loginUrl}
        </p>
      `),
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string, expiryMin: number): Promise<void> {
    await this.send({
      to,
      subject: `Reset your ${this.appName} password`,
      html: this.wrap(`
        <h2>Reset your password</h2>
        <p>We received a request to reset your password. Click the button below. This link expires in ${expiryMin} minutes.</p>
        ${this.button('Reset Password', resetUrl)}
        <p style="color:#dc2626;font-size:13px;margin-top:16px;">
          ⚠️ If you didn't request a password reset, please ignore this email. Your password has not been changed.
        </p>
        <p style="color:#6b7280;font-size:12px;word-break:break-all;">
          Or copy this link: ${resetUrl}
        </p>
      `),
    });
  }

  async sendOAuthAccountEmail(to: string): Promise<void> {
    await this.send({
      to,
      subject: `Sign in to ${this.appName} with Google`,
      html: this.wrap(`
        <h2>Your account uses Google sign-in</h2>
        <p>Your ${this.appName} account is linked to Google. You can't reset a password because you sign in with Google.</p>
        <p>To access your account, use the "Continue with Google" button on the login page.</p>
      `),
    });
  }

  async sendInviteEmail(
    to: string,
    orgName: string,
    role: string,
    inviteUrl: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `You've been invited to join ${orgName} on ${this.appName}`,
      html: this.wrap(`
        <h2>You're invited!</h2>
        <p>You've been invited to join <strong>${orgName}</strong> as <strong>${role}</strong>.</p>
        ${this.button('Accept Invitation', inviteUrl)}
        <p style="color:#6b7280;font-size:13px;margin-top:16px;">
          This invitation expires in 7 days. If you weren't expecting this, you can ignore it.
        </p>
      `),
    });
  }

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    try {
      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.from}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });

      // resend v2+ returns { data, error }
      const error = result.error as ResendError | null;
      if (error) {
        this.logger.error(`Resend error sending to ${opts.to}: ${error.message}`);
        throw new InternalServerErrorException('Failed to send email. Please try again.');
      }

      this.logger.debug(`Email sent: "${opts.subject}" → ${opts.to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email send failed to ${opts.to}: ${message}`);
      throw err;
    }
  }

  private wrap(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;max-width:540px;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#111827;">${this.appName}</p>
          <div style="color:#374151;font-size:15px;line-height:1.6;">${body}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private button(label: string, url: string): string {
    return `<p style="margin:24px 0;">
  <a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;display:inline-block;">
    ${label}
  </a>
</p>`;
  }
}
