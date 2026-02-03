import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

const PROFILE_TABLE = 'user_profiles';
const FINGERPRINT_TABLE = 'device_fingerprints';
const NO_EMAIL_DOMAIN = '@no-email.app';
const INITIAL_COINS = 50;

/** 用户名：字母数字下划线，2～32 位 */
const USERNAME_REG = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,32}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username as string)?.trim() ?? '';
    const nickname = (body.nickname as string)?.trim()?.slice(0, 50) ?? '';
    const password = (body.password as string) ?? '';
    const visitorId = (body.visitorId as string)?.trim() ?? '';
    const displayName = nickname || username;

    if (!username || !password || !visitorId) {
      return NextResponse.json(
        { error: '请填写用户名、密码，并允许获取设备标识' },
        { status: 400 }
      );
    }

    if (!USERNAME_REG.test(username)) {
      return NextResponse.json(
        { error: '用户名仅支持 2～32 位字母、数字、下划线或中文' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码至少 6 位' },
        { status: 400 }
      );
    }

    const email = `${username}${NO_EMAIL_DOMAIN}`;
    const admin = createAdminClient();

    // 1. 检查该设备是否已领取过新人奖励
    const { data: existing } = await admin
      .from(FINGERPRINT_TABLE)
      .select('visitor_id')
      .eq('visitor_id', visitorId)
      .maybeSingle();

    const grantCoins = !existing;

    // 2. 使用 Admin API 创建用户（自动确认邮箱，无需验证）
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nickname: displayName, signup_type: 'ip' },
    });

    if (createError) {
      if (createError.message?.toLowerCase().includes('already registered') || createError.message?.toLowerCase().includes('already exists')) {
        return NextResponse.json(
          { error: '该用户名已被注册' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: '注册失败：' + (createError.message ?? '请稍后重试') },
        { status: 400 }
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 });
    }

    // 3. 写入 user_profiles（铜币：新设备 50，否则 0）
    const coins = grantCoins ? INITIAL_COINS : 0;
    const { error: profileErr } = await admin
      .from(PROFILE_TABLE)
      .insert({ user_id: userId, nickname: displayName, coins_balance: coins });

    if (profileErr) {
      console.error('IP signup: insert profile failed', profileErr);
      return NextResponse.json({ error: '创建档案失败，请重试' }, { status: 500 });
    }

    // 4. 记录设备指纹（不论是否赠币都记，防止同设备再次领奖）
    const { error: fpErr } = await admin
      .from(FINGERPRINT_TABLE)
      .upsert(
        { visitor_id: visitorId, user_id: userId },
        { onConflict: 'visitor_id', ignoreDuplicates: false }
      );

    if (fpErr) {
      console.error('IP signup: insert device_fingerprints failed', fpErr);
      // 不阻断注册，仅记录
    }

    return NextResponse.json({
      ok: true,
      email,
      grantCoins,
      message: grantCoins
        ? '注册成功，已赠送 50 铜币'
        : '注册成功。该设备已领取过新人奖励，本次不赠送铜币。',
    });
  } catch (e) {
    console.error('IP signup error', e);
    return NextResponse.json({ error: '服务异常，请稍后重试' }, { status: 500 });
  }
}
