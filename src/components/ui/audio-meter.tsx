import React from 'react';
import { cn } from '@/lib/utils';

interface AudioMeterProps {
  leftLevel: number;
  rightLevel: number;
  className?: string;
}

export function AudioMeter({ leftLevel, rightLevel, className }: AudioMeterProps) {
  const getBarColor = (level: number) => {
    if (level > 0.8) return 'bg-red-500';
    if (level > 0.6) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const renderBars = (level: number) => {
    const numBars = 8;
    const bars = [];
    
    for (let i = 0; i < numBars; i++) {
      const barLevel = (i + 1) / numBars;
      const isActive = level >= barLevel;
      
      bars.push(
        <div
          key={i}
          className={cn(
            'w-1 h-1 mb-0.5 transition-all duration-75',
            isActive ? getBarColor(level) : 'bg-gray-600'
          )}
        />
      );
    }
    
    return bars;
  };

  // Only show if there's significant audio activity
  if (leftLevel < 0.01 && rightLevel < 0.01) {
    return null;
  }

  return (
    <div className={cn('flex items-end gap-1 p-2 bg-black/50 rounded', className)}>
      <div className="flex flex-col-reverse">
        {renderBars(leftLevel)}
      </div>
      <div className="flex flex-col-reverse">
        {renderBars(rightLevel)}
      </div>
    </div>
  );
}