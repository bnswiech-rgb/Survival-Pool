import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { PoolDetailClient } from '@/components/pool/PoolDetailClient';

export const dynamic = 'force-dynamic';

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

  // For team_battle pools, fetch user_ids who have submitted any pick this round
  // (just IDs — no pick details — so teammates can see who is locked in)
  let submittedPickUserIds: string[] = [];
  if (pool?.contest_format === 'team_battle') {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    // Get the latest non-completed round
    const { data: activeRound } = await serviceClient
      .from('rounds')
      .select('id')
      .eq('pool_id', id)
      .neq('status', 'completed')
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const roundId = activeRound?.id ?? currentRound?.id;
    if (roundId) {
      const { data: submitted } = await serviceClient
        .from('picks')
        .select('user_id')
        .eq('round_id', roundId);
      submittedPickUserIds = (submitted ?? []).map((p: any) => p.user_id);
    }
  }

  // Fetch all graded picks from the current open round using service role
  // (bypasses RLS so we can see everyone's picks for the live leaderboard projection)
  let currentRoundGradedPicks: any[] = [];
  if (currentRound) {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: gradedPicks } = await serviceClient
      .from('picks')
      .select('user_id, status')
      .eq('round_id', currentRound.id)
      .neq('status', 'pending');
    currentRoundGradedPicks = gradedPicks ?? [];
  }

  if (!pool || pool.status === 'canceled') notFound();

  // Auto-heal: if pool is open/active but has no open round, create one now
  if (!currentRound && pool.status !== 'completed' && pool.status !== 'canceled') {
    const { data: anyRound } = await supabase
      .from('rounds')
      .select('id')
      .eq('pool_id', id)
      .limit(1)
      .maybeSingle();

    if (!anyRound) {
      // No rounds at all — create round 1 with a safe deadline
      const now = new Date();
      // Default: 11:59 PM ET tonight
      const deadline = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 3, 59, 0, 0));
      const { data: newRound } = await supabase
        .from('rounds')
        .insert({ pool_id: id, round_number: 1, deadline: deadline.toISOString(), status: 'open' })
        .select()
        .single();
      if (newRound) {
        // Use newly created round as currentRound
        (currentRound as any) = newRound;
      }
    }
  }

  let myParticipation = null;
  let myPick = null;
  let currentUser = null;
  let picks: any[] = [];
  let myTeam: any = null;
  let allTeams: any[] = [];

  // Fetch all teams for team_battle pools
  if (pool?.contest_format === 'team_battle') {
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, invite_code, captain_id')
      .eq('pool_id', id);
    allTeams = teamsData ?? [];
  }

  if (user) {
    const [{ data: prof }, { data: myP }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('pool_participants').select('*').eq('pool_id', id).eq('user_id', user.id).maybeSingle(),
    ]);
    currentUser = prof;
    myParticipation = myP;

    // For team pools, fetch the user's team + teammates
    if (pool?.contest_format === 'team_battle' && myParticipation?.team_id) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('*, pool_participants(user_id, profiles(username, avatar_url))')
        .eq('id', myParticipation.team_id)
        .single();
      myTeam = teamData;
    }

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
      initialMyTeam={myTeam}
      initialAllTeams={allTeams}
      submittedPickUserIds={submittedPickUserIds}
    />
  );
}
