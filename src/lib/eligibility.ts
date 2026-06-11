// Eligibility checks — all picks are allowed, no odds restrictions
export function isEligibleSpreadPick(_americanOdds: number): boolean {
  return true;
}

export function isEligibleTotalPick(_americanOdds: number): boolean {
  return true;
}

export function isEligibleMoneylinePick(_americanOdds: number): boolean {
  return true;
}

export function isEligiblePick(_pickType: 'spread' | 'total' | 'moneyline', _americanOdds: number): boolean {
  return true;
}

export function getEligibilityReason(_pickType: 'spread' | 'total' | 'moneyline', _americanOdds: number): string {
  return 'This pick meets eligibility requirements.';
}
