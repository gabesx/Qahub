import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Initialize transporter if SMTP is configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (smtpHost && smtpPort && smtpUser && smtpPassword) {
      const port = parseInt(smtpPort, 10);
      const isGmail = smtpHost.includes('gmail.com');
      
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        // Gmail-specific settings
        ...(isGmail && {
          service: 'gmail',
          tls: {
            rejectUnauthorized: false, // For development only
          },
        }),
      });
      
      // Verify connection
      this.transporter.verify((error) => {
        if (error) {
          logger.error('❌ SMTP connection verification failed:', error);
        } else {
          logger.info('✅ Email service initialized and verified with SMTP');
        }
      });
    } else {
      logger.warn('Email service not configured - SMTP settings missing. Emails will be logged only.');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const fromAddress = process.env.SMTP_FROM || 'noreply@qahub.com';
    const smtpUser = process.env.SMTP_USER || '';
    
    // Gmail and most SMTP servers use the authenticated user as "from"
    // So we use the SMTP_USER as "from" but set "replyTo" to the desired address
    // For proper custom "from" addresses, you need:
    // - Gmail Workspace with verified domain, OR
    // - A dedicated email service (SendGrid, AWS SES, etc.)
    const from = smtpUser || fromAddress;
    const replyTo = fromAddress;

    // If SMTP is not configured, just log the email
    if (!this.transporter) {
      logger.warn('Email would be sent (SMTP not configured):', {
        to: options.to,
        subject: options.subject,
        from: fromAddress,
      });
      logger.info('Email content preview:', options.html.substring(0, 200) + '...');
      return true; // Return true to not break the flow
    }

    try {
      logger.info(`Attempting to send email to ${options.to}...`);
      
      // Gmail limitation: Can't send from a different email than the authenticated account
      // The "from" will always be the SMTP_USER email, but we can:
      // 1. Use a display name to make it look better
      // 2. Set replyTo to the desired address
      // For true custom "from" addresses, use Gmail Workspace or a service like SendGrid/AWS SES
      const displayName = 'QaHub';
      const mailOptions: any = {
        from: `"${displayName}" <${from}>`, // Display name with authenticated email
        replyTo: replyTo !== from ? replyTo : undefined, // Only set if different
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      };
      
      logger.debug('Email options:', {
        from: mailOptions.from,
        replyTo: mailOptions.replyTo,
        to: mailOptions.to,
      });
      
      const info = await this.transporter.sendMail(mailOptions);

      logger.info(`✅ Email sent successfully to ${options.to}`, {
        messageId: info.messageId,
        response: info.response,
      });
      return true;
    } catch (error: any) {
      logger.error(`❌ Failed to send email to ${options.to}:`, {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
      });
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string, userName?: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #22c55e; margin: 0;">QaHub</h1>
            <p style="margin: 5px 0 0 0; color: #666;">Quality Management System</p>
          </div>
          
          <div style="background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
            
            <p>Hello${userName ? ` ${userName}` : ''},</p>
            
            <p>We received a request to reset your password for your QaHub account. Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; background-color: #22c55e; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #22c55e; font-size: 12px; word-break: break-all;">${resetLink}</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              <strong>This link will expire in 1 hour.</strong>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            </p>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} QaHub. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your QaHub Password',
      html,
    });
  }

  async sendVerificationEmail(email: string, verificationToken: string, userName?: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const verifyLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #22c55e; margin: 0;">QaHub</h1>
            <p style="margin: 5px 0 0 0; color: #666;">Quality Management System</p>
          </div>
          
          <div style="background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            
            <p>Hello${userName ? ` ${userName}` : ''},</p>
            
            <p>Thank you for registering with QaHub! Please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyLink}" 
                 style="display: inline-block; background-color: #22c55e; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #22c55e; font-size: 12px; word-break: break-all;">${verifyLink}</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              <strong>This link will expire in 24 hours.</strong>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't create an account, please ignore this email.
            </p>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} QaHub. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your QaHub Email Address',
      html,
    });
  }

  async sendInvitationEmail(email: string, invitationToken: string, inviterName?: string, tenantName?: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const acceptLink = `${frontendUrl}/accept-invitation?token=${invitationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #22c55e; margin: 0;">QaHub</h1>
            <p style="margin: 5px 0 0 0; color: #666;">Quality Management System</p>
          </div>
          
          <div style="background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">You've Been Invited!</h2>
            
            <p>Hello,</p>
            
            <p>${inviterName || 'Someone'} has invited you to join${tenantName ? ` ${tenantName} on` : ''} QaHub. Click the button below to accept the invitation and create your account:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptLink}" 
                 style="display: inline-block; background-color: #22c55e; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #22c55e; font-size: 12px; word-break: break-all;">${acceptLink}</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              <strong>This invitation will expire in 7 days.</strong>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't expect this invitation, please ignore this email.
            </p>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} QaHub. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `You've been invited to join${tenantName ? ` ${tenantName} on` : ''} QaHub`,
      html,
    });
  }
}

export const emailService = new EmailService();

