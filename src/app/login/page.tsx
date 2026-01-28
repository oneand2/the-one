import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { LoginForm } from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 如果已登录，重定向到首页
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const params = await searchParams;
  const next = (params.next as string) || '/';
  const message = params.message as string;
  
  if (user) {
    redirect(next);
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* 标题区 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif text-stone-800 tracking-wider mb-3">
            注册
          </h1>
          <p className="text-sm text-stone-500 font-sans">
            世界即道场，让我们一起修行
          </p>
        </div>

        {/* 提示消息 */}
        {message && (
          <div className="mb-6 px-4 py-3 bg-stone-100 border border-stone-300 rounded-lg">
            <p className="text-sm text-stone-700 font-sans text-center">
              {message}
            </p>
          </div>
        )}

        {/* 登录表单 */}
        <div className="bg-white/40 backdrop-blur-sm rounded-2xl shadow-sm p-8 border border-stone-200/50">
          <LoginForm next={next} />

          {/* 提示信息 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-stone-400 font-sans">
              注册后需验证邮箱方可登录
            </p>
          </div>
        </div>

        {/* 返回首页 */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors"
          >
            ← 返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
