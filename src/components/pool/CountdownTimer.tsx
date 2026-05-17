'use client';
import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  deadline: string;
  className?: string;
  onExpire?: () => void;
}

export function CountdownTimer({ deadline, className, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const target = new Date(deadline).getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft('Expired');
        setExpired(true);
        onExpire?.();
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  return (
    <span className={`font-mono font-bold tabular-nums ${expired ? 'text-red-400' : 'text-yellow-400'} ${className ?? ''}`}>
      {timeLeft}
    </span>
  );
}
