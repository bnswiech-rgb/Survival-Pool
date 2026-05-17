'use client';
import { useState } from 'react';
import { isEligiblePick } from '@/lib/eligibility';
import type { PickType } from '@/types';

interface Props {
  value: string;
  onChange: (val: string, parsed: number | null) => void;
  pickType: PickType;
}

export function OddsInput({ value, onChange, pickType }: Props) {
  const [touched, setTouched] = useState(false);
  const parsed = parseInt(value, 10);
  const isValid = !isNaN(parsed);
  const isEligible = isValid ? isEligiblePick(pickType, parsed) : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const p = parseInt(v, 10);
    onChange(v, isNaN(p) ? null : p);
  };

  const borderColor = touched && value
    ? isEligible === true
      ? 'border-green-500'
      : isEligible === false
        ? 'border-red-500'
        : 'border-gray-700'
    : 'border-gray-700';

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-300">
        American Odds <span className="text-gray-500 font-normal">(e.g., -110, +150)</span>
      </label>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        placeholder="-110"
        className={`block w-full px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${borderColor}`}
      />
      {touched && value && (
        <div className={`text-xs font-medium flex items-center gap-1.5 ${
          isEligible === true ? 'text-green-400' :
          isEligible === false ? 'text-red-400' :
          'text-gray-500'
        }`}>
          {isEligible === true && '✓ Eligible'}
          {isEligible === false && '✗ Not eligible for this contest'}
          {isEligible === null && 'Enter valid odds'}
        </div>
      )}
    </div>
  );
}
