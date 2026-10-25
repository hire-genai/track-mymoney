import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = (process.env.SMTP_SECURE ?? "true") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP configuration incomplete");
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendOtpEmail(toEmail: string, code: string): Promise<void> {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const html = buildEmailHtml(code);
  await getTransport().sendMail({
    from,
    to: toEmail,
    subject: `Your Track-MyMoney verification code: ${code}`,
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html,
  });
}

function buildEmailHtml(code: string): string {
  return `<!doctype html>
  <html>
    <body style="margin:0;padding:0;background:#f6f8fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="padding:28px 28px 12px 28px;">
          <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;">
            <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#059669,#047857);display:inline-block;line-height:36px;text-align:center;color:#fff;font-weight:700;">T</div>
            <div style="font-weight:700;font-size:16px;">Track-MyMoney</div>
          </div>
          <h1 style="font-size:20px;margin:0 0 10px 0;">Your verification code</h1>
          <p style="font-size:14px;color:#475569;line-height:1.5;margin:0 0 24px 0;">
            Enter this 6-digit code to finish signing in. The code expires in 10 minutes.
          </p>
          <div style="display:inline-block;padding:14px 24px;background:#f1f5f9;border-radius:12px;font-size:26px;letter-spacing:8px;font-weight:800;color:#0f172a;">
            ${code}
          </div>
          <p style="font-size:12px;color:#94a3b8;margin:24px 0 0 0;line-height:1.5;">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
        <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #eef2f7;font-size:11px;color:#94a3b8;">
          Track-MyMoney · Automated message, please do not reply.
        </div>
      </div>
    </body>
  </html>`;
}
