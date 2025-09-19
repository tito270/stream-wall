import React from 'react';

interface BitratePanelProps {
  title?: string;
  subtitle?: string;
  data: { time: number; bitrate: number }[];
  color?: string;
  maxBitrate?: number;
}

const BitratePanel: React.FC<BitratePanelProps> = ({ title = 'Bitrate', subtitle, data, color, maxBitrate }) => {
  return (
    <div className="p-3 bg-stream-bg border-stream-border rounded">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground font-mono">{subtitle}</div>}
        </div>
      </div>
      <div className="h-32 flex items-center justify-center text-muted-foreground">
        Bitrate visualization ({data.length} data points)
      </div>
    </div>
  );
};

export default BitratePanel;