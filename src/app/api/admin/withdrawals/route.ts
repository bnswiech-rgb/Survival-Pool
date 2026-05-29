import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function PATCH(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await userSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, status, admin_note } = await request.json();
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
  if (!['approved', 'paid', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // If rejecting, refund the balance
  if (status === 'rejected') {
    const { data: withdrawal } = await supabase
      .from('withdrawal_requests')
      .select('amount_cents, user_id, status')
      .eq('id', id)
      .single();

    if (!withdrawal) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    if (withdrawal.status === 'paid') {
      return NextResponse.json({ error: 'Cannot reject an already paid withdrawal' }, { status: 400 });
    }

    // Refund if it was pending or approved (coins already deducted)
    if (withdrawal.status === 'pending' || withdrawal.status === 'approved') {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('sweeps_coins')
        .eq('id', withdrawal.user_id)
        .single();

      if (userProfile) {
        await supabase.from('profiles').update({
          sweeps_coins: (userProfile.sweeps_coins ?? 0) + withdrawal.amount_cents,
        }).eq('id', withdrawal.user_id);

        await supabase.from('coin_transactions').insert({
          user_id: withdrawal.user_id,
          gold_delta: 0,
          sweeps_delta: withdrawal.amount_cents,
          transaction_type: 'refund',
          note: `Withdrawal rejected — $${(withdrawal.amount_cents / 100).toFixed(2)} refunded`,
        });
      }
    }
  }

  const { error } = await supabase
    .from('withdrawal_requests')
    .update({
      status,
      admin_note: admin_note ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
