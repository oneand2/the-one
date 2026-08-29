import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  ALREADY_REGISTERED_MESSAGE,
  friendlyRecoveryError,
  friendlySignupError,
} from '@/utils/authEmail';
import { hasAuthMailer, sendAuthOtpEmail } from '@/utils/authMailer';

export type SignupOtpResult =
  | { otpEmail: string }
  | { sessionUserId: string }
  | { error: string };

export type RecoveryOtpResult = { otpEmail: string } | { error: string };

/** 已确认用户再次注册时，GoTrue 会返回空 identities 且不发信，避免被用来探测邮箱。 */
function isFakeSignupSuccess(user: User | null, hasSession: boolean): boolean {
  if (hasSession) return false;
  if (!user) return true;
  return !user.identities || user.identities.length === 0;
}

async function issueOtpViaMailer(params: {
  type: 'signup' | 'recovery';
  email: string;
  password?: string;
  data?: { nickname: string; invite_code?: string };
}): Promise<{ otpEmail: string } | { error: string }> {
  const admin = createAdminClient();
  const generated =
    params.type === 'signup'
      ? await admin.auth.admin.generateLink({
          type: 'signup',
          email: params.email,
          password: params.password ?? '',
          options: { data: params.data },
        })
      : await admin.auth.admin.generateLink({
          type: 'recovery',
          email: params.email,
        });

  if (generated.error) {
    console.error(`auth generateLink (${params.type}) failed:`, generated.error.message);
    return {
      error:
        params.type === 'signup'
          ? friendlySignupError(generated.error.message)
          : friendlyRecoveryError(generated.error.message),
    };
  }

  const otp = generated.data.properties?.email_otp;
  if (!otp) {
    return { error: params.type === 'signup' ? '无法生成验证码，请稍后重试' : '无法生成验证码，请稍后重试' };
  }

  const sent = await sendAuthOtpEmail({ to: params.email, otp, kind: params.type });
  if (!sent.ok) {
    console.error(`auth otp email (${params.type}) failed:`, sent.error);
    return {
      error:
        params.type === 'signup'
          ? friendlySignupError('Error sending confirmation email')
          : friendlyRecoveryError('Error sending recovery email'),
    };
  }

  return { otpEmail: params.email };
}

export async function requestSignupOtp(
  supabase: SupabaseClient,
  params: { email: string; password: string; nickname: string; inviteCode: string },
): Promise<SignupOtpResult> {
  const email = params.email.trim();
  const data = {
    nickname: params.nickname.slice(0, 50),
    invite_code: params.inviteCode.slice(0, 32) || undefined,
  };

  if (hasAuthMailer()) {
    return issueOtpViaMailer({ type: 'signup', email, password: params.password, data });
  }

  const { data: signupData, error } = await supabase.auth.signUp({
    email,
    password: params.password,
    options: { data },
  });

  if (error) {
    console.error('signup failed:', error.message);
    return { error: friendlySignupError(error.message) };
  }
  if (signupData.session && signupData.user) {
    return { sessionUserId: signupData.user.id };
  }
  if (isFakeSignupSuccess(signupData.user, Boolean(signupData.session))) {
    return { error: ALREADY_REGISTERED_MESSAGE };
  }
  return { otpEmail: email };
}

export async function requestRecoveryOtp(
  supabase: SupabaseClient,
  email: string,
): Promise<RecoveryOtpResult> {
  if (hasAuthMailer()) {
    return issueOtpViaMailer({ type: 'recovery', email });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    console.error('recovery email failed:', error.message);
    return { error: friendlyRecoveryError(error.message) };
  }
  return { otpEmail: email };
}
