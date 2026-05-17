import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  username: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
};

export function Avatar({ src, username, size = 'md', className }: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase();
  const colors = ['bg-green-600', 'bg-blue-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600'];
  const colorIndex = username.charCodeAt(0) % colors.length;
  const color = colors[colorIndex];

  if (src) {
    return (
      <img
        src={src}
        alt={username}
        className={cn('rounded-full object-cover flex-shrink-0', sizes[size], className)}
      />
    );
  }

  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold text-white flex-shrink-0', sizes[size], color, className)}>
      {initials}
    </div>
  );
}
