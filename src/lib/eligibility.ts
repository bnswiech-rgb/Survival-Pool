// Spreads/Totals: must be around -110 (allow -115 to -105 range)
export function isEligibleSpreadPick(americanOdds: number): boolean {
  return americanOdds >= -115 && americanOdds <= -105;
}

export function isEligibleTotalPick(americanOdds: number): boolean {
  return americanOdds >= -115 && americanOdds <= -105;
}

// Moneyline: -150 or BETTER (less negative or positive)
// ALLOWED: -150, -140, -130, -120, -110, +100, +120, +200
// BLOCKED: -151, -160, -200, -300
export function isEligibleMoneylinePick(americanOdds: number): boolean {
  // For negative odds: must be -150 or closer to 0 (i.e., >= -150)
  // For positive odds: always allowed
  if (americanOdds > 0) return true;
  return americanOdds >= -150;
}

export function isEligiblePick(pickType: 'spread' | 'total' | 'moneyline', americanOdds: number): boolean {
  switch (pickType) {
    case 'spread': return isEligibleSpreadPick(americanOdds);
    case 'total': return isEligibleTotalPick(americanOdds);
    case 'moneyline': return isEligibleMoneylinePick(americanOdds);
    default: return false;
  }
}

export function getEligibilityReason(pickType: 'spread' | 'total' | 'moneyline', americanOdds: number): string {
  if (isEligiblePick(pickType, americanOdds)) {
    return 'This pick meets eligibility requirements.';
  }
  switch (pickType) {
    case 'spread':
    case 'total':
      return `Spread/Total picks must have odds between -115 and -105. Your odds (${americanOdds > 0 ? '+' : ''}${americanOdds}) are outside this range.`;
    case 'moneyline':
      return `Moneyline picks must be -150 or better. Your odds (${americanOdds}) are too heavily favored.`;
    default:
      return 'Invalid pick type.';
  }
}
