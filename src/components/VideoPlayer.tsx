import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  streamUrl: string;
  onRemove: () => void;
  className?: string;
}

export const VideoPlayer = ({ streamUrl, onRemove, className }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setHasError(false);

    const initializePlayer = () => {
      if (streamUrl.includes('.m3u8')) {
        // HLS stream
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false, // Disable for better stability with live streams
            backBufferLength: 90, // Keep more back buffer for stability
            maxBufferLength: 30, // Reasonable forward buffer
            maxMaxBufferLength: 60, // Maximum buffer size
            maxBufferSize: 60 * 1000 * 1000, // 60MB buffer
            maxBufferHole: 0.5, // Allow small holes in buffer
            highBufferWatchdogPeriod: 2, // Check buffer health every 2s
            nudgeOffset: 0.1, // Small nudge for stalls
            nudgeMaxRetry: 3, // Retry nudging 3 times
            maxFragLookUpTolerance: 0.25, // Fragment lookup tolerance
            liveSyncDurationCount: 3, // Live sync segments
            liveMaxLatencyDurationCount: 10, // Max latency for live
            liveDurationInfinity: true, // Handle infinite live streams
            manifestLoadingTimeOut: 10000, // 10s manifest timeout
            manifestLoadingMaxRetry: 4, // Retry manifest loading
            manifestLoadingRetryDelay: 500, // Delay between retries
            levelLoadingTimeOut: 10000, // 10s level timeout
            levelLoadingMaxRetry: 4, // Retry level loading
            fragLoadingTimeOut: 20000, // 20s fragment timeout
            fragLoadingMaxRetry: 6, // Retry fragment loading
            startLevel: -1, // Auto start level
            capLevelToPlayerSize: true, // Cap quality to player size
            debug: false, // Disable debug in production
          });
          hlsRef.current = hls;
          
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS manifest parsed successfully');
            setIsLoading(false);
            video.play().then(() => {
              setIsPlaying(true);
              console.log('HLS stream started playing');
            }).catch((err) => {
              console.error('HLS play failed:', err);
              setHasError(true);
              setIsLoading(false);
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.warn('HLS event:', event, data);
            
            if (data.fatal) {
              console.error('Fatal HLS error:', data);
              setHasError(true);
              setIsLoading(false);
              
              // Try to recover from fatal errors
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log('Attempting to recover from network error');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log('Attempting to recover from media error');
                  hls.recoverMediaError();
                  break;
                default:
                  console.log('Unrecoverable error, destroying HLS instance');
                  hls.destroy();
                  break;
              }
            } else {
              // Handle non-fatal errors like buffer stalls
              if (data.details === 'bufferStalledError') {
                console.log('Buffer stall detected, attempting recovery');
                // Don't show error for buffer stalls, they're usually recoverable
                setTimeout(() => {
                  if (video.paused && isPlaying) {
                    video.play().catch(() => {
                      console.log('Recovery play failed');
                    });
                  }
                }, 1000);
              }
            }
          });

          // Add additional event listeners for better debugging
          hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log('Quality level switched to:', data.level);
          });

          hls.on(Hls.Events.FRAG_LOADED, () => {
            // Fragment loaded successfully
            if (hasError) {
              setHasError(false); // Clear error state if fragments are loading
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          console.log('Using native HLS support');
          video.src = streamUrl;
          video.addEventListener('loadedmetadata', () => {
            setIsLoading(false);
            video.play().then(() => {
              setIsPlaying(true);
            }).catch((err) => {
              console.error('Native HLS play failed:', err);
              setHasError(true);
              setIsLoading(false);
            });
          });
        } else {
          console.error('HLS not supported in this browser');
          setHasError(true);
          setIsLoading(false);
        }
      } else {
        // Direct video stream (RTMP/RTSP would need additional handling)
        console.log('Using direct video stream');
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          video.play().then(() => {
            setIsPlaying(true);
          }).catch((err) => {
            console.error('Direct stream play failed:', err);
            setHasError(true);
            setIsLoading(false);
          });
        });
        video.addEventListener('error', (err) => {
          console.error('Direct stream error:', err);
          setHasError(true);
          setIsLoading(false);
        });
      }
    };

    initializePlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setHasError(true);
      });
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const getStreamType = (url: string) => {
    if (url.includes('.m3u8')) return 'HLS';
    if (url.includes('rtmp://')) return 'RTMP';
    if (url.includes('rtsp://')) return 'RTSP';
    return 'Direct';
  };

  return (
    <Card 
      className={cn(
        "relative group overflow-hidden bg-gradient-card border-stream-border shadow-card transition-all duration-300 hover:shadow-stream",
        className
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Remove button */}
      <Button
        onClick={onRemove}
        variant="destructive"
        size="sm"
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Stream type indicator */}
      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-primary/90 rounded text-xs font-mono text-primary-foreground">
        {getStreamType(streamUrl)}
      </div>

      {/* Video element */}
      <div className="relative aspect-video bg-stream-bg">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted={isMuted}
          playsInline
          controls={false}
        />

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-stream-bg">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading stream...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-stream-bg">
            <div className="flex flex-col items-center gap-2 text-destructive">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm">Failed to load stream</span>
            </div>
          </div>
        )}

        {/* Video controls overlay */}
        {showControls && !hasError && !isLoading && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="flex items-center gap-4 bg-black/60 rounded-lg px-4 py-2">
              <Button
                onClick={togglePlay}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                onClick={toggleMute}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button
                onClick={toggleFullscreen}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stream URL display */}
      <div className="p-3 bg-stream-bg border-t border-stream-border">
        <p className="text-xs text-muted-foreground font-mono truncate" title={streamUrl}>
          {streamUrl}
        </p>
      </div>
    </Card>
  );
};