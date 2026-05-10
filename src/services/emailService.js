import nodemailer from 'nodemailer';
import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const styles = {
  body: `
    font-family: Arial, sans-serif;
    background: #f6f8fa;
    padding: 20px;
    color: #24292f;
  `,

  container: `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 600px;
    margin: auto;
    border: 1px solid #e1e4e8;
  `,

  repo: `
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    background: #f1f1f1;
    border: 1px solid #d0d7de;
    font-family: monospace;
    font-size: 13px;
  `,

  btnBase: `
    display: inline-block;
    padding: 10px 16px;
    margin-top: 12px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: bold;
  `,

  confirm: `
    background: #2da44e;
    color: white;
  `,

  unsubscribe: `
    background: #d73a49;
    color: white;
    margin-left: 8px;
  `,

  muted: `
    color: #57606a;
    font-size: 13px;
    margin-top: 12px;
  `,
};

class EmailService {
  constructor(transporter) {
    this.transporter = transporter;
  }

  async sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken) {
    const confirmUrl = `${BASE_URL}/api/confirm/${confirmToken}`;
    const unsubscribeUrl = `${BASE_URL}/api/unsubscribe/${unsubscribeToken}`;

    const html = `
      <div style="${styles.body}">
        <div style="${styles.container}">
          <h2>Confirm subscription</h2>

          <p>
            You subscribed to repository:
            <span style="${styles.repo}">${repo}</span>
          </p>

          <a href="${confirmUrl}" style="${styles.btnBase + styles.confirm}">
            Confirm subscription
          </a>

          <a href="${unsubscribeUrl}" style="${styles.btnBase + styles.unsubscribe}">
            Unsubscribe
          </a>

          <p style="${styles.muted}">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    return this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: `Confirm subscription to ${repo}`,
      html,
    });
  }

  async sendReleaseNotificationEmail(email, repo, newTag, releaseUrl, unsubscribeToken) {
    const unsubscribeUrl = `${BASE_URL}/api/unsubscribe/${unsubscribeToken}`;

    const html = `
      <div style="${styles.body}">
        <div style="${styles.container}">
          <h2>🚀 New release detected</h2>

          <p>
            Repository:
            <span style="${styles.repo}">${repo}</span>
          </p>
          <p>
            New version:
            <strong>${newTag}</strong>
          </p>
          <p>
            Release details:
            <a href="${releaseUrl}" target="_blank">View release on GitHub</a>
          </p>
          <a href="${unsubscribeUrl}" style="${styles.btnBase + styles.unsubscribe}">
            Unsubscribe
          </a>
          <p style="${styles.muted}">
            You are receiving this because you subscribed to this repository.
          </p>
        </div>
      </div>
    `;

    return this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: `New release ${newTag} for ${repo}`,
      html,
    });
  }
}

const emailService = new EmailService(transporter);
export default emailService;
export { EmailService };