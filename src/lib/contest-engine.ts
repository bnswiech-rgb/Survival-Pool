import { ParticipantStatus, PickStatus, PushRule, ContestFormat } from '@/types';

export interface ParticipantUpdate {
  status: ParticipantStatus;
  lives_remaining?: number;
  current_streak?: number;
  wins?: number;
  losses?: number;
  pushes?: number;
  rounds_survived?: number;
  eliminated_round?: number;
  isWinner?: boolean;
}

export interface Participant {
  id: string;
  status: ParticipantStatus;
  lives_remaining: number;
  current_streak: number;
  wins: number;
  losses: number;
  pushes: number;
  rounds_survived: number;
  eliminated_round: number | null;
}

type AllLoseRule = 'repeat' | 'split' | 'tiebreak';

function handlePush(participant: Participant, pushRule: PushRule, currentRound: number): ParticipantUpdate {
  const base = { pushes: participant.pushes + 1, rounds_survived: participant.rounds_survived };
  switch (pushRule) {
    case 'advance': return { ...base, status: 'advanced' };
    case 'eliminate': return { ...base, status: 'eliminated', eliminated_round: currentRound };
    case 'repeat': return { ...base, status: 'active' };
    default: return { ...base, status: 'advanced' };
  }
}

export function processClassicSurvivalResult(
  participant: Participant,
  pickStatus: PickStatus,
  pushRule: PushRule,
  currentRound: number = 1
): ParticipantUpdate {
  if (pickStatus === 'won') {
    return { status: 'advanced', wins: participant.wins + 1, rounds_survived: participant.rounds_survived + 1 };
  }
  if (pickStatus === 'lost') {
    return { status: 'eliminated', losses: participant.losses + 1, eliminated_round: currentRound };
  }
  if (pickStatus === 'push' || pickStatus === 'void') {
    return handlePush(participant, pushRule, currentRound);
  }
  return { status: participant.status };
}

export function processLivesModeResult(
  participant: Participant,
  pickStatus: PickStatus,
  pushRule: PushRule,
  currentRound: number = 1
): ParticipantUpdate {
  if (pickStatus === 'won') {
    return { status: 'advanced', wins: participant.wins + 1, current_streak: participant.current_streak + 1, rounds_survived: participant.rounds_survived + 1 };
  }
  if (pickStatus === 'lost') {
    const newLives = participant.lives_remaining - 1;
    const isEliminated = newLives <= 0;
    return {
      status: isEliminated ? 'eliminated' : 'advanced',
      losses: participant.losses + 1,
      lives_remaining: newLives,
      current_streak: 0,
      eliminated_round: isEliminated ? currentRound : undefined,
      rounds_survived: participant.rounds_survived + (isEliminated ? 0 : 1),
    };
  }
  if (pickStatus === 'push' || pickStatus === 'void') {
    return handlePush(participant, pushRule, currentRound);
  }
  return { status: participant.status };
}

export function processFirstToXWinsResult(
  participant: Participant,
  pickStatus: PickStatus,
  targetWins: number,
  maxLosses: number | null,
  currentRound: number = 1
): ParticipantUpdate {
  if (pickStatus === 'won') {
    const newWins = participant.wins + 1;
    const isWinner = newWins >= targetWins;
    return {
      status: isWinner ? 'winner' : 'advanced',
      wins: newWins,
      current_streak: participant.current_streak + 1,
      rounds_survived: participant.rounds_survived + 1,
      isWinner,
    };
  }
  if (pickStatus === 'lost') {
    const newLosses = participant.losses + 1;
    const isEliminated = maxLosses !== null && newLosses >= maxLosses;
    return {
      status: isEliminated ? 'eliminated' : 'advanced',
      losses: newLosses,
      current_streak: 0,
      eliminated_round: isEliminated ? currentRound : undefined,
    };
  }
  if (pickStatus === 'push' || pickStatus === 'void') {
    return { pushes: participant.pushes + 1, status: 'advanced' };
  }
  return { status: participant.status };
}

export function processBestRecordResult(
  participant: Participant,
  pickStatus: PickStatus,
  isLastRound: boolean = false
): ParticipantUpdate {
  if (pickStatus === 'won') {
    return { status: 'advanced', wins: participant.wins + 1, rounds_survived: participant.rounds_survived + 1 };
  }
  if (pickStatus === 'lost') {
    return { status: 'advanced', losses: participant.losses + 1 };
  }
  if (pickStatus === 'push' || pickStatus === 'void') {
    return { status: 'advanced', pushes: participant.pushes + 1 };
  }
  return { status: participant.status };
}

export function processStreakRaceResult(
  participant: Participant,
  pickStatus: PickStatus,
  targetStreak: number,
  pushResetsStreak: boolean = false,
  currentRound: number = 1
): ParticipantUpdate {
  if (pickStatus === 'won') {
    // If currently on a loss streak, reset to 1W; otherwise extend win streak
    const newStreak = participant.current_streak < 0 ? 1 : participant.current_streak + 1;
    const isWinner = newStreak >= targetStreak;
    return {
      status: isWinner ? 'winner' : 'advanced',
      wins: participant.wins + 1,
      current_streak: newStreak,
      rounds_survived: participant.rounds_survived + 1,
      isWinner,
    };
  }
  if (pickStatus === 'lost') {
    // If currently on a win streak, reset to -1L; otherwise extend loss streak
    const newStreak = participant.current_streak > 0 ? -1 : participant.current_streak - 1;
    return { status: 'advanced', losses: participant.losses + 1, current_streak: newStreak };
  }
  if (pickStatus === 'push' || pickStatus === 'void') {
    return {
      status: 'advanced',
      pushes: participant.pushes + 1,
      current_streak: pushResetsStreak ? 0 : participant.current_streak,
    };
  }
  return { status: participant.status };
}

export function processTeamBattleResult(
  participant: Participant,
  pickStatus: PickStatus,
  pushRule: PushRule,
  currentRound: number = 1
): ParticipantUpdate {
  return processClassicSurvivalResult(participant, pickStatus, pushRule, currentRound);
}

export function determineContestWinners(
  participants: Participant[],
  contestFormat: ContestFormat
): string[] {
  const active = participants.filter(p => p.status === 'active' || p.status === 'advanced');
  if (contestFormat === 'best_record') {
    const maxWins = Math.max(...active.map(p => p.wins));
    const leaders = active.filter(p => p.wins === maxWins);
    const minLosses = Math.min(...leaders.map(p => p.losses));
    return leaders.filter(p => p.losses === minLosses).map(p => p.id);
  }
  return active.map(p => p.id);
}

export function processRoundResults(
  participants: Participant[],
  picks: Map<string, PickStatus>,
  pool: {
    contest_format: ContestFormat;
    push_rule: PushRule;
    all_lose_rule: AllLoseRule;
    lives_count: number;
    target_wins: number;
    target_streak: number;
    max_losses: number | null;
    push_resets_streak: boolean;
    tiebreaker_active?: boolean;
  },
  roundNumber: number
): { updates: Map<string, ParticipantUpdate>; startTiebreaker: boolean } {
  const updates = new Map<string, ParticipantUpdate>();
  for (const participant of participants) {
    const rawPickStatus = picks.get(participant.id);
    // Streak race: no pick = push (streak preserved). All other formats: no pick = loss.
    const pickStatus: PickStatus = rawPickStatus ?? (pool.contest_format === 'streak_race' ? 'push' : 'lost');
    let update: ParticipantUpdate;
    switch (pool.contest_format) {
      case 'classic':
        update = processClassicSurvivalResult(participant, pickStatus, pool.push_rule, roundNumber);
        break;
      case 'lives':
        update = processLivesModeResult(participant, pickStatus, pool.push_rule, roundNumber);
        break;
      case 'first_to_x':
        update = processFirstToXWinsResult(participant, pickStatus, pool.target_wins, pool.max_losses, roundNumber);
        break;
      case 'best_record':
        update = processBestRecordResult(participant, pickStatus);
        break;
      case 'streak_race':
        // In tiebreaker mode, use classic survival (1 loss = eliminated)
        if (pool.tiebreaker_active) {
          update = processClassicSurvivalResult(participant, pickStatus, pool.push_rule, roundNumber);
        } else {
          update = processStreakRaceResult(participant, pickStatus, pool.target_streak, pool.push_resets_streak, roundNumber);
        }
        break;
      case 'team_battle':
        update = processTeamBattleResult(participant, pickStatus, pool.push_rule, roundNumber);
        break;
      default:
        update = processClassicSurvivalResult(participant, pickStatus, pool.push_rule, roundNumber);
    }
    updates.set(participant.id, update);
  }

  // Streak race: detect simultaneous winners → start tiebreaker
  let startTiebreaker = false;
  if (pool.contest_format === 'streak_race' && !pool.tiebreaker_active) {
    const tiedWinners = [...updates.entries()].filter(([, u]) => u.isWinner);
    if (tiedWinners.length > 1) {
      startTiebreaker = true;
      const winnerIds = new Set(tiedWinners.map(([id]) => id));
      for (const [id, update] of updates) {
        if (winnerIds.has(id)) {
          // Keep tied players alive for sudden death — don't crown yet
          updates.set(id, { ...update, status: 'advanced', isWinner: false });
        } else {
          // Eliminate everyone who didn't reach the target
          updates.set(id, { ...update, status: 'eliminated', eliminated_round: roundNumber });
        }
      }
    }
  }

  // Check all-lose scenario (skip during tiebreaker — someone must go out)
  if (!startTiebreaker && !pool.tiebreaker_active) {
    const allLost = participants.every(p => {
      const update = updates.get(p.id);
      return update?.status === 'eliminated';
    });

    if (allLost && pool.all_lose_rule === 'repeat') {
      for (const [id] of updates) {
        const orig = participants.find(p => p.id === id)!;
        updates.set(id, { ...updates.get(id)!, status: 'active', eliminated_round: undefined, losses: orig.losses + 1 });
      }
    }
  }

  return { updates, startTiebreaker };
}
