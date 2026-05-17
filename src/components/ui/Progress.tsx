import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  color?: 'green' | 'blue' | 'red' | 'yellow';
}

export function Progress({ value, max = 100, className, color = 'green' }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  };
  return (
    <div className={cn('w-full bg-gray-800 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-300', colors[color])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
