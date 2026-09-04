import { NextRequest, NextResponse } from 'next/server';
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { APPLE_ROOT_CERTIFICATES } from '@/lib/payments/appleRootCertificates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID?.trim() || 'com.theone.er';
const APPLE_APP_ID = Number(process.env.APPLE_APP_ID || 6801478964);

async function verifyNotification(signedPayload: string) {
  const candidates: Array<{ environment: Environment; appAppleId?: number }> = [
    { environment: Environment.PRODUCTION, appAppleId: APPLE_APP_ID },
    { environment: Environment.SANDBOX },
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const verifier = new SignedDataVerifier(
        APPLE_ROOT_CERTIFICATES,
        true,
        candidate.environment,
        BUNDLE_ID,
        candidate.appAppleId,
      );
      return await verifier.verifyAndDecodeNotification(signedPayload);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Apple notification verification failed');
}

export async function POST(request: NextRequest) {
  let body: { signedPayload?: unknown };
  try {
    body = (await request.json()) as { signedPayload?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid notification body' }, { status: 400 });
  }

  if (typeof body.signedPayload !== 'string' || body.signedPayload.length > 200_000) {
    return NextResponse.json({ error: 'missing signed payload' }, { status: 400 });
  }

  try {
    const notification = await verifyNotification(body.signedPayload);
    console.info('Apple App Store Server Notification received', {
      notificationType: notification.notificationType ?? null,
      subtype: notification.subtype ?? null,
      notificationUUID: notification.notificationUUID ?? null,
      environment: notification.data?.environment ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Apple App Store Server Notification verification failed:', error);
    return NextResponse.json({ error: 'invalid signed payload' }, { status: 400 });
  }
}
