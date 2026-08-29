import nodemailer from 'nodemailer';

export function hasAuthMailer(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

export async function sendAuthOtpEmail(params: {
  to: string;
  otp: string;
  kind: 'signup' | 'recovery';
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasAuthMailer()) return { ok: false, error: 'mailer not configured' };

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || '465');
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const secure = port === 465;
  const action = params.kind === 'signup' ? '完成注册' : '重置密码';
  const subject = params.kind === 'signup' ? '注册验证码' : '重置密码验证码';

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"二" <${from}>`,
      to: params.to,
      subject,
      text: `你的${action}验证码是：${params.otp}\n\n验证码 1 小时内有效，请勿泄露给他人。`,
      html:
        `<p>你的${action}验证码是：</p>` +
        `<p style="font-size:28px;letter-spacing:6px;font-weight:600">${params.otp}</p>` +
        `<p>验证码 1 小时内有效，请勿泄露给他人。</p>`,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
