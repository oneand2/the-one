import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { ResetPasswordForm } from './ResetPasswordForm';

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?message=链接已失效或已过期，请重新申请找回密码');
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif text-stone-800 tracking-wider mb-3">
            设置新密码
          </h1>
          <p className="text-sm text-stone-500 font-sans">
            请设置您的新密码
          </p>
        </div>

        <div className="bg-white/40 backdrop-blur-sm rounded-2xl shadow-sm p-8 border border-stone-200/50">
          <ResetPasswordForm />
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
