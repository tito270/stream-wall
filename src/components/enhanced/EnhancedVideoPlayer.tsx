import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, Play, Pause, Volume2, VolumeX, Maximize, Edit2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Stream } from "@/lib/supabase";

interface EnhancedVideoPlayerProps {
  stream: Stream;
  onRemove: () => void;
  onEdit: () => void;
  className?: string;
}

export const EnhancedVideoPlayer = ({ stream, onRemove, onEdit, className }: EnhancedVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const bitrateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [bitrate, setBitrate] = useState<number>(0);
  const [lastBytes, setLastBytes] = useState<number>(0);
  const [lastTime, setLastTime] = useState<number>(Date.now());

  // Calculate bitrate
  const calculateBitrate = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    
    // Use video element properties for bitrate estimation
    const videoElement = video as any; // Type assertion for webkit properties
    if (videoElement.webkitVideoDecodedByteCount !== undefined) {
      // Chrome/Safari
      const currentBytes = videoElement.webkitVideoDecodedByteCount;
      const currentTime = Date.now();
      
      if (lastBytes > 0) {
        const byteDiff = currentBytes - lastBytes;
        const timeDiff = (currentTime - lastTime) / 1000; // seconds
        
        if (timeDiff > 0) {
          const currentBitrate = (byteDiff * 8) / timeDiff; // bits per second
          setBitrate(Math.round(currentBitrate / 1000)); // kbps
        }
      }
      
      setLastBytes(currentBytes);
      setLastTime(currentTime);
    } else {
      // Fallback: estimate based on video quality
      const videoWidth = video.videoWidth || 0;
      const videoHeight = video.videoHeight || 0;
      
      if (videoWidth && videoHeight) {
        // Rough bitrate estimation based on resolution
        const pixels = videoWidth * videoHeight;
        let estimatedBitrate = 0;
        
        if (pixels <= 640 * 480) estimatedBitrate = 800; // SD
        else if (pixels <= 1280 * 720) estimatedBitrate = 2500; // HD
        else if (pixels <= 1920 * 1080) estimatedBitrate = 5000; // FHD
        else estimatedBitrate = 8000; // 4K+
        
        setBitrate(estimatedBitrate);
      }
    }
  }, [lastBytes, lastTime]);

  // Start bitrate monitoring
  useEffect(() => {
    if (isPlaying && !hasError) {
      bitrateIntervalRef.current = setInterval(calculateBitrate, 2000);
    } else {
      if (bitrateIntervalRef.current) {
        clearInterval(bitrateIntervalRef.current);
        bitrateIntervalRef.current = null;
      }
    }

    return () => {
      if (bitrateIntervalRef.current) {
        clearInterval(bitrateIntervalRef.current);
      }
    };
  }, [isPlaying, hasError, calculateBitrate]);

  // Load mute preference
  useEffect(() => {
    const savedMute = localStorage.getItem("videoMuted") === "true";
    setIsMuted(savedMute);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setHasError(false);
    setBitrate(0);

    const initPlayer = () => {
      if (stream.url.includes(".m3u8")) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            // Optimized settings for live streams
            maxBufferLength: 10,
            maxMaxBufferLength: 20,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
            lowLatencyMode: true,
            backBufferLength: 90,
          });
          
          hlsRef.current = hls;
          hls.loadSource(stream.url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            video.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS Error:', data);
            if (data.fatal) {
              setHasError(true);
              setIsLoading(false);
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = stream.url;
          video.addEventListener("loadedmetadata", () => {
            setIsLoading(false);
            video.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
          });
        } else {
          setHasError(true);
          setIsLoading(false);
        }
      } else {
        // For other stream types (RTMP, RTSP, HTTP)
        video.src = stream.url;
        video.addEventListener("loadedmetadata", () => {
          setIsLoading(false);
          video.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
        });
        video.addEventListener("error", () => {
          setHasError(true);
          setIsLoading(false);
        });
      }
    };

    initPlayer();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (bitrateIntervalRef.current) {
        clearInterval(bitrateIntervalRef.current);
      }
    };
  }, [stream.url]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !video.muted;
    video.muted = newMuted;
    setIsMuted(newMuted);
    localStorage.setItem("videoMuted", String(newMuted));
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else video.requestFullscreen();
  };

  const formatBitrate = (kbps: number) => {
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} kbps`;
  };

  return (
    <Card
      className={cn("relative group overflow-hidden bg-gradient-card border-stream-border shadow-card", className)}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Action buttons */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          onClick={onEdit}
          variant="secondary"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          onClick={onRemove}
          variant="destructive"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Stream info */}
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <div className="px-2 py-1 bg-primary/90 rounded text-xs font-mono">
          {stream.stream_type}
        </div>
        {bitrate > 0 && (
          <div className="px-2 py-1 bg-stream-success/90 rounded text-xs font-mono flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {formatBitrate(bitrate)}
          </div>
        )}
      </div>

      <div className="relative aspect-video bg-stream-bg">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted={isMuted}
          playsInline
          controls={false}
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-stream-bg">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-stream-bg text-destructive">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Failed to load stream</p>
            </div>
          </div>
        )}

        {showControls && !hasError && !isLoading && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="flex items-center gap-4 bg-black/60 rounded-lg px-4 py-2">
              <Button onClick={togglePlay} variant="ghost" size="sm" className="text-white hover:bg-white/20">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button onClick={toggleMute} variant="ghost" size="sm" className="text-white hover:bg-white/20">
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button onClick={toggleFullscreen} variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-stream-bg border-t border-stream-border">
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium text-sm truncate">{stream.name}</p>
          {bitrate > 0 && (
            <span className="text-xs text-stream-success font-mono">
              {formatBitrate(bitrate)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">{stream.url}</p>
      </div>
    </Card>
  );
};