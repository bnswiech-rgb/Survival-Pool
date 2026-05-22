import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PoolDetailClient } from '@/components/pool/PoolDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PoolDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: pool }, { data: participants }, { data: currentRound }, { data: latestRound }] = await Promise.all([
    supabase.from('pools').select('*').eq('id', id).single(),
    supabase
      .from('pool_participants')
      .select('*, profiles(id, username, avatar_url, role, wins, losses, pushes, pools_entered, pools_won, created_at)')
      .eq('pool_id', id)
      .order('wins', { ascending: false }),
    supabase
      .from('rounds')
      .select('*')
      .eq('pool_id', id)
      .in('status', ['open', 'locked', 'grading'])
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('rounds')
      .select('round_number')
      .eq('pool_id', id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Fetch all graded picks from the current open round so the leaderboard
  // can show live-projected stats before the round officially closes
  let currentRoundGradedPicks: any[] = [];
  if (currentRound) {
    const { data: gradedPicks } = await supabase
      .from('picks')
      .select('user_id, status')
      .eq('round_id', currentRound.id)
      .neq('status', 'pending');
    currentRoundGradedPicks = gradedPicks ?? [];
  }

  if (!pool) notFound();

  let myParticipation = null;
  let myPick = null;
  let currentUser = null;
  let picks: any[] = [];

  if (user) {
    const [{ data: prof }, { data: myP }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('pool_participants').select('*').eq('pool_id', id).eq('user_id', user.id).maybeSingle(),
    ]);
    currentUser = prof;
    myParticipation = myP;

    if (currentRound) {
      const { data: pick } = await supabase
        .from('picks')
        .select('*')
        .eq('pool_id', id)
        .eq('round_id', currentRound.id)
        .eq('user_id', user.id)
        .maybeSingle();
      myPick = pick;
    }

    // Picks visible once you've submitted your own, or if you're admin
    const isAdmin = currentUser?.role === 'admin';
    const hasSubmitted = !!myPick;
    if ((hasSubmitted || isAdmin) && currentRound) {
      const { data: picksData } = await supabase
        .from('picks')
        .select('*, profiles(username, avatar_url)')
        .eq('pool_id', id)
        .eq('round_id', currentRound.id)
        .order('submitted_at', { ascending: false });
      picks = picksData ?? [];
    }
  }

  return (
    <PoolDetailClient
      pool={pool}
      initialParticipants={(participants as any) ?? []}
      initialCurrentRound={currentRound}
      latestRoundNumber={latestRound?.round_number ?? 1}
      initialMyPick={myPick}
      myParticipation={myParticipation}
      currentUser={currentUser}
      initialPicks={picks}
      currentRoundGradedPicks={currentRoundGradedPicks}
    />
  );
}
