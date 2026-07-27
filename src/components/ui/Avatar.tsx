import React from 'react';
import { cn } from '../../utils/cn';

interface AvatarProps {
  name: string;
  className?: string;
  status?: 'watching' | 'buffering' | 'offline';
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ name, className, status, size = 'md' }) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const statusColors = {
    watching: 'bg-green-500',
    buffering: 'bg-yellow-500',
    offline: 'bg-gray-500',
  };

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-primary/20 border border-primary/30 text-primary-foreground font-semibold uppercase',
          sizes[size],
          className
        )}
      >
        {initial}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-background',
            statusColors[status],
            size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3 h-3' : 'w-3.5 h-3.5'
          )}
        />
      )}
    </div>
  );
};
