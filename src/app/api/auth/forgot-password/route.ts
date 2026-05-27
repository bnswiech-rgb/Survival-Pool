import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { email } = body;

  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      gotrue_meta_security: {},
      redirect_to: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sharprpicks.com'}/reset-password`,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    return NextResponse.json({ error: data.msg ?? 'Failed to send reset email' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
