import { NextResponse } from 'next/server';

export async function GET() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  if (!publishableKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  return NextResponse.json({ publishableKey });
}
