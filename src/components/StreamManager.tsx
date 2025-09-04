import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VideoPlayer } from "./VideoPlayer";
import { Plus, Monitor, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Stream {
  id: string;
  url: string;
}

export const StreamManager = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamUrl, setStreamUrl] = useState("");
  const { toast } = useToast();

  // Load saved streams from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("streams");
    if (saved) setStreams(JSON.parse(saved));
  }, []);

  // Save streams to localStorage
  useEffect(() => {
    localStorage.setItem("streams", JSON.stringify(streams));
  }, [streams]);

  const normalizeUrl = (url: string) => url.trim().toLowerCase().replace(/\/$/, "");

  const isValidStreamUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      const lowerUrl = url.toLowerCase();
      const isHLS = lowerUrl.includes(".m3u8");
      const isRTMP = lowerUrl.startsWith("rtmp://");
      const isRTSP = lowerUrl.startsWith("rtsp://");
      const isHTTP = urlObj.protocol === "http:" || urlObj.protocol === "https:";
      return isHLS || isRTMP || isRTSP || isHTTP;
    } catch {
      return false;
    }
  };

  const addStream = () => {
    if (!streamUrl.trim() || !isValidStreamUrl(streamUrl)) {
      toast({
        title: "Invalid Stream URL",
        description: "Enter a valid HLS (.m3u8), RTMP, RTSP, or HTTP URL",
        variant: "destructive",
      });
      return;
    }
    if (streams.length >= 6) {
      toast({
        title: "Limit Reached",
        description: "You can add up to 6 streams",
        variant: "destructive",
      });
      return;
    }
    const normalized = normalizeUrl(streamUrl);
    if (streams.some(s => normalizeUrl(s.url) === normalized)) {
      toast({
        title: "Duplicate Stream",
        description: "This stream URL is already added",
        variant: "destructive",
      });
      return;
    }
    const newStream: Stream = {
      id: `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: streamUrl,
    };
    setStreams(prev => [...prev, newStream]);
    setStreamUrl("");
    toast({
      title: "Stream Added",
      description: `Stream added successfully (${streams.length + 1}/6)`,
    });
  };

  const removeStream = (streamId: string) => {
    setStreams(prev => prev.filter(stream => stream.id !== streamId));
    toast({ title: "Stream Removed", description: "Removed successfully" });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addStream();
  };

  return (
    <div className="min-h-screen bg-gradient-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Stream Monitor
          </h1>
          <p className="text-muted-foreground">
            Professional video streaming interface supporting HLS, RTMP, and RTSP protocols
          </p>
        </div>

        {/* Add Stream Form */}
        <Card className="bg-gradient-card border-stream-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Stream ({streams.length}/6)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stream-url">Stream URL</Label>
              <div className="flex gap-2">
                <Input
                  id="stream-url"
                  type="url"
                  placeholder="Enter stream URL"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 bg-input border-stream-border focus:ring-primary"
                />
                <Button
                  onClick={addStream}
                  disabled={streams.length >= 6}
                  className="bg-gradient-primary hover:shadow-glow transition-all"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streams */}
        {streams.length === 0 ? (
          <Card className="bg-gradient-card border-stream-border">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Monitor className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No streams active</h3>
              <p className="text-muted-foreground max-w-md">
                Add your first stream URL above to start monitoring. Supports up to 6 concurrent streams.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <VideoPlayer
                key={stream.id}
                streamUrl={stream.url}
                onRemove={() => removeStream(stream.id)}
                className="w-full"
              />
            ))}
          </div>
        )}

        {/* Info */}
        {streams.length > 0 && (
          <Card className="bg-gradient-card border-stream-border">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-stream-warning mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Stream Controls</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    <li>• Hover over any stream to access controls</li>
                    <li>• All streams start muted by default</li>
                    <li>• Click the X button to remove a stream</li>
                    <li>• Use fullscreen for detailed monitoring</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
