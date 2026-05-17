import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pool_id, user_id, amount_cents } = await request.json();

  if (!pool_id || !user_id || amount_cents === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: pool } = await supabase.from('pools').select('rake_percentage').eq('id', pool_id).single();
  const platformFee = pool ? Math.round(amount_cents * (pool.rake_percentage / 100)) : 0;

  // Record mock payment
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      pool_id,
      user_id,
      amount_cents,
      platform_fee_cents: platformFee,
      status: 'completed',
      provider: 'mock',
      provider_payment_id: `mock_${Date.now()}`,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payment, success: true }, { status: 201 });
}
