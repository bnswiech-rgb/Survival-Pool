import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GameBoard from './GameBoard';

export default async function PicksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pool } = await supabase.from('pools').select('*').eq('id', id).single();
  if (!pool) redirect('/pools');

  // Get current open round
  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('pool_id', id)
    .eq('status', 'open')
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!round) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-white mb-2">No Active Round</h2>
          <p className="text-gray-400">The admin hasn&apos;t opened a round yet. Check back soon.</p>
        </div>
      </div>
    );
  }

  // Check participant status
  const { data: participant } = await supabase
    .from('pool_participants')
    .select('*')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!participant || participant.status === 'eliminated') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💀</div>
          <h2 className="text-xl font-bold text-white mb-2">You&apos;ve Been Eliminated</h2>
          <p className="text-gray-400">Better luck next contest.</p>
        </div>
      </div>
    );
  }

  // Check if already submitted a pick this round
  const { data: existingPick } = await supabase
    .from('picks')
    .select('*')
    .eq('pool_id', id)
    .eq('round_id', round.id)
    .eq('user_id', user.id)
    .maybeSingle();

  const deadline = new Date(round.deadline);
  const isLocked = deadline < new Date();

  return (
    <GameBoard
      pool={pool}
      round={round}
      participant={participant}
      existingPick={existingPick}
      isLocked={isLocked}
      userId={user.id}
    />
  );
}
