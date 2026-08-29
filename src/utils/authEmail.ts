export const ALREADY_REGISTERED_MESSAGE =
  '该邮箱已注册，请直接登录。若忘记密码，请使用「忘记密码」。';

export const MAIL_SEND_FAILED_MESSAGE =
  '验证邮件暂时发不出去。请改用微信注册，或稍后再试。';

export function isMailSendFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('error sending confirmation email') ||
    lower.includes('error sending recovery email') ||
    lower.includes('error sending magic link') ||
    lower.includes('unable to send email') ||
    lower.includes('error sending email')
  );
}

function isAlreadyRegisteredMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('already registered')
  );
}

/** 把 Supabase 发信失败等英文错误转成可读的中文说明。 */
export function friendlySignupError(raw: string | undefined): string {
  const message = (raw ?? '').trim();
  if (isMailSendFailure(message)) return MAIL_SEND_FAILED_MESSAGE;
  if (isAlreadyRegisteredMessage(message)) return ALREADY_REGISTERED_MESSAGE;
  const lower = message.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('email rate limit') || lower.includes('too many requests')) {
    return '发送过于频繁，请稍后再试。';
  }
  return message ? `注册失败：${message}` : '注册失败，请稍后重试';
}

export function friendlyRecoveryError(raw: string | undefined): string {
  const message = (raw ?? '').trim();
  if (isMailSendFailure(message)) return '重置邮件暂时发不出去，请稍后再试。';
  if (message.toLowerCase().includes('user not found') || message.toLowerCase().includes('unable to find user')) {
    return '该邮箱尚未注册。';
  }
  return message ? `发送失败：${message}` : '发送失败，请稍后重试';
}
