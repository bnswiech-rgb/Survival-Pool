import { isEligibleSpreadPick, isEligibleTotalPick, isEligibleMoneylinePick, isEligiblePick } from '@/lib/eligibility';

describe('Spread Eligibility', () => {
  test('allows -110', () => expect(isEligibleSpreadPick(-110)).toBe(true));
  test('allows -115', () => expect(isEligibleSpreadPick(-115)).toBe(true));
  test('allows -105', () => expect(isEligibleSpreadPick(-105)).toBe(true));
  test('blocks -120', () => expect(isEligibleSpreadPick(-120)).toBe(false));
  test('blocks -100', () => expect(isEligibleSpreadPick(-100)).toBe(false));
  test('blocks +100', () => expect(isEligibleSpreadPick(100)).toBe(false));
});

describe('Total Eligibility', () => {
  test('allows -110', () => expect(isEligibleTotalPick(-110)).toBe(true));
  test('allows -105', () => expect(isEligibleTotalPick(-105)).toBe(true));
  test('blocks -120', () => expect(isEligibleTotalPick(-120)).toBe(false));
  test('blocks -116', () => expect(isEligibleTotalPick(-116)).toBe(false));
  test('blocks -104', () => expect(isEligibleTotalPick(-104)).toBe(false));
});

describe('Moneyline Eligibility', () => {
  test('allows -150', () => expect(isEligibleMoneylinePick(-150)).toBe(true));
  test('allows -140', () => expect(isEligibleMoneylinePick(-140)).toBe(true));
  test('allows -110', () => expect(isEligibleMoneylinePick(-110)).toBe(true));
  test('allows +100', () => expect(isEligibleMoneylinePick(100)).toBe(true));
  test('allows +200', () => expect(isEligibleMoneylinePick(200)).toBe(true));
  test('allows +500', () => expect(isEligibleMoneylinePick(500)).toBe(true));
  test('blocks -151', () => expect(isEligibleMoneylinePick(-151)).toBe(false));
  test('blocks -160', () => expect(isEligibleMoneylinePick(-160)).toBe(false));
  test('blocks -200', () => expect(isEligibleMoneylinePick(-200)).toBe(false));
  test('blocks -300', () => expect(isEligibleMoneylinePick(-300)).toBe(false));
});

describe('isEligiblePick', () => {
  test('spread -110 is eligible', () => expect(isEligiblePick('spread', -110)).toBe(true));
  test('spread -120 is not eligible', () => expect(isEligiblePick('spread', -120)).toBe(false));
  test('total -110 is eligible', () => expect(isEligiblePick('total', -110)).toBe(true));
  test('moneyline -150 is eligible', () => expect(isEligiblePick('moneyline', -150)).toBe(true));
  test('moneyline -200 is not eligible', () => expect(isEligiblePick('moneyline', -200)).toBe(false));
  test('moneyline +300 is eligible', () => expect(isEligiblePick('moneyline', 300)).toBe(true));
});
