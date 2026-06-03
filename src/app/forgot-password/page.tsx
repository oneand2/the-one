import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-sm text-stone-500 font-sans leading-relaxed">
            请输入注册时使用的邮箱，我们将发送验证码，验证后即可设置新密码
          </p>
        </div>

        <div className="bg-white/40 backdrop-blur-sm rounded-2xl shadow-sm p-8 border border-stone-200/50">
          <ForgotPasswordForm />
        </div>

        <div className="text-center mt-8">
          <a
            href="/login"
            className="text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors"
          >
            ← 返回登录
          </a>
        </div>
      </div>
    </div>
  );
}
