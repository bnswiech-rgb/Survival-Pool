import { CheckCircle, XCircle } from 'lucide-react';
import { isEligiblePick, getEligibilityReason } from '@/lib/eligibility';
import type { PickType } from '@/types';

interface Props {
  pickType: PickType;
  americanOdds: number;
  className?: string;
}

export function PickEligibilityBadge({ pickType, americanOdds, className }: Props) {
  const eligible = isEligiblePick(pickType, americanOdds);
  const reason = getEligibilityReason(pickType, americanOdds);

  return (
    <div className={`rounded-lg px-3 py-2 border text-sm ${
      eligible
        ? 'bg-green-500/10 border-green-500/30 text-green-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    } ${className ?? ''}`}>
      <div className="flex items-center gap-2 font-semibold">
        {eligible ? <CheckCircle size={16} /> : <XCircle size={16} />}
        {eligible ? '✓ Eligible' : '✗ Not Eligible'}
      </div>
      <div className="text-xs mt-1 opacity-80">{reason}</div>
    </div>
  );
}
