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
  const [triedProxy, setTriedProxy] = useState(false);

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

    const sourceUrl = triedProxy ? `/proxy?url=${encodeURIComponent(streamUrl)}` : streamUrl;

    const initPlayer = () => {
      if (sourceUrl.includes(".m3u8")) {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(sourceUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            video.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              if (!triedProxy && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                setTriedProxy(true); // retry with proxy
              } else {
                setHasError(true);
                setIsLoading(false);
              }
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = sourceUrl;
          video.addEventListener("loadedmetadata", () => {
            setIsLoading(false);
            video.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
          });
        } else {
          setHasError(true);
          setIsLoading(false);
        }
      } else {
        video.src = sourceUrl;
        video.addEventListener("loadedmetadata", () => {
          setIsLoading(false);
          video.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
        });
        video.addEventListener("error", () => {
          if (!triedProxy) setTriedProxy(true);
          else setHasError(true);
        });
      }
    };

    initPlayer();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, triedProxy]);

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

  const getStreamType = (url: string) => {
    if (url.includes(".m3u8")) return "HLS";
    if (url.startsWith("rtmp://")) return "RTMP";
    if (url.startsWith("rtsp://")) return "RTSP";
    return "Direct";
  };

  return (
    <Card
      className={cn("relative group overflow-hidden bg-gradient-card border-stream-border shadow-card", className)}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <Button
        onClick={onRemove}
        variant="destructive"
        size="sm"
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-primary/90 rounded text-xs font-mono">
        {getStreamType(streamUrl)}
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
            <AlertCircle className="h-8 w-8" />
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
        <p className="text-xs text-muted-foreground font-mono truncate">{streamUrl}</p>
      </div>
    </Card>
  );
};
