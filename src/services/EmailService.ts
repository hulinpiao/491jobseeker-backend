import nodemailer from 'nodemailer';

/**
 * Email Service
 * Handles sending emails via SMTP
 */
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM || 'noreply@491jobseeker.com';
    this.initializeTransporter();
  }

  /**
   * Initialize SMTP transporter
   */
  private initializeTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // Only initialize if SMTP config is provided
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, code: string): Promise<void> {
    // If no transporter configured, log to console (for development)
    if (!this.transporter) {
      console.log(`[EMAIL SERVICE] Verification code for ${email}: ${code}`);
      return;
    }

    const mailOptions = {
      from: this.fromAddress,
      to: email,
      subject: 'Verify your email - 491JobSeeker',
      html: this.getVerificationEmailTemplate(code),
      text: `Your verification code is: ${code}`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Get HTML template for verification email
   */
  private getVerificationEmailTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9fafb;
              border-radius: 8px;
              padding: 40px;
              text-align: center;
            }
            h1 {
              color: #1f2937;
              margin-bottom: 20px;
            }
            .code {
              background-color: #3b82f6;
              color: white;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              padding: 20px 40px;
              border-radius: 8px;
              margin: 30px 0;
              display: inline-block;
            }
            .expires {
              color: #6b7280;
              font-size: 14px;
              margin-top: 20px;
            }
            .footer {
              margin-top: 40px;
              color: #9ca3af;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Verify Your Email Address</h1>
            <p>Thank you for registering with 491JobSeeker!</p>
            <p>Please use the following verification code to complete your registration:</p>
            <div class="code">${code}</div>
            <p class="expires">This code will expire in 15 minutes.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <div class="footer">
              &copy; ${new Date().getFullYear()} 491JobSeeker. All rights reserved.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return this.transporter !== null;
  }
}

// Export singleton instance
export default new EmailService();
