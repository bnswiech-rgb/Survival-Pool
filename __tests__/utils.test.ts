import { calculatePrizePool, formatCents, formatOdds, timeUntil, getContestFormatLabel } from '@/lib/utils';

describe('calculatePrizePool', () => {
  test('free contest returns zeros', () => {
    const result = calculatePrizePool(0, 10, 10);
    expect(result.grossPot).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.netPrizePool).toBe(0);
  });

  test('calculates correct prize pool with 10% rake', () => {
    const result = calculatePrizePool(1000, 10, 10);
    expect(result.grossPot).toBe(10000);
    expect(result.platformFee).toBe(1000);
    expect(result.netPrizePool).toBe(9000);
  });

  test('calculates correct prize pool with 0% rake', () => {
    const result = calculatePrizePool(500, 20, 0);
    expect(result.grossPot).toBe(10000);
    expect(result.platformFee).toBe(0);
    expect(result.netPrizePool).toBe(10000);
  });

  test('rounds platform fee correctly', () => {
    const result = calculatePrizePool(100, 3, 10);
    expect(result.grossPot).toBe(300);
    expect(result.platformFee).toBe(30);
    expect(result.netPrizePool).toBe(270);
  });

  test('handles 15% rake', () => {
    const result = calculatePrizePool(2000, 5, 15);
    expect(result.grossPot).toBe(10000);
    expect(result.platformFee).toBe(1500);
    expect(result.netPrizePool).toBe(8500);
  });
});

describe('formatCents', () => {
  test('formats 0 as $0.00', () => expect(formatCents(0)).toBe('$0.00'));
  test('formats 100 as $1.00', () => expect(formatCents(100)).toBe('$1.00'));
  test('formats 2500 as $25.00', () => expect(formatCents(2500)).toBe('$25.00'));
  test('formats 100000 as $1,000.00', () => expect(formatCents(100000)).toBe('$1,000.00'));
});

describe('formatOdds', () => {
  test('formats negative odds', () => expect(formatOdds(-110)).toBe('-110'));
  test('formats positive odds with plus sign', () => expect(formatOdds(150)).toBe('+150'));
  test('formats +100', () => expect(formatOdds(100)).toBe('+100'));
});

describe('getContestFormatLabel', () => {
  test('classic', () => expect(getContestFormatLabel('classic')).toBe('Classic Survival'));
  test('lives', () => expect(getContestFormatLabel('lives')).toBe('Lives Mode'));
  test('first_to_x', () => expect(getContestFormatLabel('first_to_x')).toBe('First To X Wins'));
  test('best_record', () => expect(getContestFormatLabel('best_record')).toBe('Best Record'));
  test('streak_race', () => expect(getContestFormatLabel('streak_race')).toBe('Streak Race'));
  test('team_battle', () => expect(getContestFormatLabel('team_battle')).toBe('Team Battle'));
  test('unknown returns itself', () => expect(getContestFormatLabel('unknown')).toBe('unknown'));
});
