import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  decryptWechatResource,
  validateWechatNotification,
  verifyWechatNotification,
} from '@/lib/payments/wechat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function failure(message: string, status = 400) {
  return NextResponse.json({ code: 'FAIL', message }, { status });
}

export async function POST(request: Request) {
  const body = await request.text();
  const headers = {
    timestamp: request.headers.get('wechatpay-timestamp') || '',
    nonce: request.headers.get('wechatpay-nonce') || '',
    serial: request.headers.get('wechatpay-serial') || '',
    signature: request.headers.get('wechatpay-signature') || '',
  };

  try {
    if (
      !headers.timestamp ||
      !headers.nonce ||
      !headers.serial ||
      !headers.signature ||
      !verifyWechatNotification(body, headers)
    ) {
      console.warn('wechat notify signature verification failed');
      return failure('签名验证失败', 401);
    }

    const event = JSON.parse(body) as {
      event_type?: string;
      resource?: {
        algorithm: string;
        ciphertext: string;
        associated_data?: string;
        nonce: string;
      };
    };

    if (event.event_type !== 'TRANSACTION.SUCCESS') {
      return new NextResponse(null, { status: 204 });
    }
    if (!event.resource) return failure('缺少加密资源');

    const notification = decryptWechatResource(event.resource);
    if (!validateWechatNotification(notification)) {
      console.warn('wechat notify merchant or trade validation failed');
      return failure('订单校验失败');
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('credit_wechat_order', {
      p_out_trade_no: notification.out_trade_no,
      p_transaction_id: notification.transaction_id,
      p_amount_cents: notification.amount.total,
    });

    if (error) {
      console.error('credit wechat order error:', error);
      return failure('订单入账失败', 500);
    }
    if (!['credited', 'already_credited'].includes(String(data))) {
      console.warn('wechat notify order validation failed:', data);
      return failure('订单校验失败');
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('wechat notify error:', error);
    return failure('回调处理失败', 500);
  }
}
