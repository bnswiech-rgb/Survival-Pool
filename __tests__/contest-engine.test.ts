import {
  processClassicSurvivalResult,
  processLivesModeResult,
  processFirstToXWinsResult,
  processBestRecordResult,
  processStreakRaceResult,
  processTeamBattleResult,
  Participant,
} from '@/lib/contest-engine';

const baseParticipant: Participant = {
  id: 'user1',
  status: 'active',
  lives_remaining: 3,
  current_streak: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  rounds_survived: 0,
  eliminated_round: null,
};

describe('Classic Survival', () => {
  test('win advances participant', () => {
    const result = processClassicSurvivalResult(baseParticipant, 'won', 'advance', 1);
    expect(result.status).toBe('advanced');
    expect(result.wins).toBe(1);
    expect(result.rounds_survived).toBe(1);
  });

  test('loss eliminates participant', () => {
    const result = processClassicSurvivalResult(baseParticipant, 'lost', 'advance', 1);
    expect(result.status).toBe('eliminated');
    expect(result.losses).toBe(1);
    expect(result.eliminated_round).toBe(1);
  });

  test('push with advance rule advances', () => {
    const result = processClassicSurvivalResult(baseParticipant, 'push', 'advance', 1);
    expect(result.status).toBe('advanced');
    expect(result.pushes).toBe(1);
  });

  test('push with eliminate rule eliminates', () => {
    const result = processClassicSurvivalResult(baseParticipant, 'push', 'eliminate', 1);
    expect(result.status).toBe('eliminated');
  });

  test('push with repeat rule keeps active', () => {
    const result = processClassicSurvivalResult(baseParticipant, 'push', 'repeat', 1);
    expect(result.status).toBe('active');
  });
});

describe('Lives Mode', () => {
  test('win advances and increases streak', () => {
    const result = processLivesModeResult(baseParticipant, 'won', 'advance', 1);
    expect(result.status).toBe('advanced');
    expect(result.wins).toBe(1);
    expect(result.current_streak).toBe(1);
  });

  test('loss costs a life but does not eliminate if lives remain', () => {
    const result = processLivesModeResult(baseParticipant, 'lost', 'advance', 1);
    expect(result.status).toBe('advanced');
    expect(result.losses).toBe(1);
    expect(result.lives_remaining).toBe(2);
    expect(result.current_streak).toBe(0);
  });

  test('loss with 1 life eliminates', () => {
    const p = { ...baseParticipant, lives_remaining: 1 };
    const result = processLivesModeResult(p, 'lost', 'advance', 2);
    expect(result.status).toBe('eliminated');
    expect(result.lives_remaining).toBe(0);
    expect(result.eliminated_round).toBe(2);
  });

  test('win resets streak count up', () => {
    const p = { ...baseParticipant, current_streak: 3 };
    const result = processLivesModeResult(p, 'won', 'advance', 1);
    expect(result.current_streak).toBe(4);
  });
});

describe('First To X Wins', () => {
  test('reaching target wins declares winner', () => {
    const p = { ...baseParticipant, wins: 4 };
    const result = processFirstToXWinsResult(p, 'won', 5, null, 5);
    expect(result.status).toBe('winner');
    expect(result.wins).toBe(5);
    expect(result.isWinner).toBe(true);
  });

  test('win below target advances', () => {
    const result = processFirstToXWinsResult(baseParticipant, 'won', 5, null, 1);
    expect(result.status).toBe('advanced');
    expect(result.wins).toBe(1);
    expect(result.isWinner).toBeFalsy();
  });

  test('loss with max_losses eliminates', () => {
    const p = { ...baseParticipant, losses: 2 };
    const result = processFirstToXWinsResult(p, 'lost', 5, 3, 3);
    expect(result.status).toBe('eliminated');
  });

  test('loss without max_losses advances', () => {
    const result = processFirstToXWinsResult(baseParticipant, 'lost', 5, null, 1);
    expect(result.status).toBe('advanced');
  });
});

describe('Best Record', () => {
  test('win increments wins and keeps active', () => {
    const result = processBestRecordResult(baseParticipant, 'won');
    expect(result.wins).toBe(1);
    expect(result.status).toBe('advanced');
  });

  test('loss increments losses but keeps advanced', () => {
    const result = processBestRecordResult(baseParticipant, 'lost');
    expect(result.losses).toBe(1);
    expect(result.status).toBe('advanced');
  });

  test('push increments pushes', () => {
    const result = processBestRecordResult(baseParticipant, 'push');
    expect(result.pushes).toBe(1);
    expect(result.status).toBe('advanced');
  });
});

describe('Streak Race', () => {
  test('reaching target streak declares winner', () => {
    const p = { ...baseParticipant, current_streak: 4 };
    const result = processStreakRaceResult(p, 'won', 5, false, 5);
    expect(result.status).toBe('winner');
    expect(result.current_streak).toBe(5);
    expect(result.isWinner).toBe(true);
  });

  test('loss resets streak to 0', () => {
    const p = { ...baseParticipant, current_streak: 3 };
    const result = processStreakRaceResult(p, 'lost', 5, false, 2);
    expect(result.current_streak).toBe(0);
    expect(result.status).toBe('advanced');
  });

  test('push with pushResetsStreak resets streak', () => {
    const p = { ...baseParticipant, current_streak: 3 };
    const result = processStreakRaceResult(p, 'push', 5, true, 2);
    expect(result.current_streak).toBe(0);
  });

  test('push without pushResetsStreak keeps streak', () => {
    const p = { ...baseParticipant, current_streak: 3 };
    const result = processStreakRaceResult(p, 'push', 5, false, 2);
    expect(result.current_streak).toBe(3);
  });
});

describe('Team Battle', () => {
  test('win advances participant', () => {
    const result = processTeamBattleResult(baseParticipant, 'won', 'advance', 1);
    expect(result.status).toBe('advanced');
  });

  test('loss eliminates participant', () => {
    const result = processTeamBattleResult(baseParticipant, 'lost', 'advance', 1);
    expect(result.status).toBe('eliminated');
  });
});
