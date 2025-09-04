import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { RotateCcw } from "lucide-react";
import {
  Plus,
  Monitor,
  History,
  Trash2,
  Save,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import AllBitrateGraph from "./ui/AllBitrateGraph";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const streamColors = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#387908",
  "#ff0000",
  "#0088fe",
  "#00c49f",
  "#ffbb28",
  "#ff8042",
  "#00cfff",
  "#ff00ff",
];

interface Stream {
  id: string;
  name: string;
  url: string;
  color: string;
}

interface AllBitrateDataPoint {
  time: number;
  [streamId: string]: number | null;
}

export const StreamManager: React.FC = () => {
  const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, ''))
    || `${window.location.protocol}//${window.location.hostname}:3001`;

  // track which streams we've already requested the server to start
  const startedStreamsRef = useRef<Set<string>>(new Set());

  const pointsForStream = useCallback((hist: Array<{ time: number; bitrate: number | null; estimated?: boolean }>, streamId: string) => {
    return hist.map(h => {
      const p: AllBitrateDataPoint = { time: h.time } as AllBitrateDataPoint;
  // When there's no explicit measurement, use 0 so the graph draws down to zero
  p[streamId] = typeof h.bitrate === 'number' ? h.bitrate : 0;
      (p as Record<string, number | null | boolean>)[`${streamId}__est`] = !!h.estimated;
      return p;
    });
  }, []);

  const ensureStartAndFetchHistory = useCallback(async (stream: Stream) => {
    try {
      // Always fetch history, even if we think it's started.
      // This covers cases where the server restarts or the stream was added in a previous session.
      
      // Request server to start transcoding/proxy. The server should handle this idempotently.
      await fetch(`${API_BASE}/start-stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ streamUrl: stream.url, streamName: stream.name })
      }).catch(() => null);

      // Request history from server
      const res = await fetch(`${API_BASE}/bitrate-history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ streamUrl: stream.url, maxSamples: 10000 }) // Fetch more samples
      });
      if (res.ok) {
        const json = await res.json();
        const hist = Array.isArray(json.history) ? json.history : [];
        if (hist.length > 0) {
          const added = pointsForStream(hist, stream.id);
          setAllBitrateHistory(prev => {
            const merged = [...prev, ...added];
            const mapByTime: Record<number, AllBitrateDataPoint> = {};
            merged.forEach(m => { 
              const timeKey = Math.round(m.time / 1000); // Group by second
              mapByTime[timeKey] = { ...(mapByTime[timeKey]||{time: m.time}), ...m }; 
            });
            const out = Object.values(mapByTime).sort((a,b)=>a.time-b.time);
            const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
            return out.filter(p=>p.time >= twentyFourHoursAgo);
          });
        }
      }
    } catch (err) {
      console.debug('Failed to start/fetch history for', stream.id, err);
    } finally {
      startedStreamsRef.current.add(stream.id);
    }
  }, [API_BASE, pointsForStream]);

  const [streams, setStreams] = useState<Stream[]>([]);
  // Helper: merge raw history samples into AllBitrateDataPoint[] format
  const mergeHistoryToPoints = useCallback((hist: Array<{ time: number; bitrate: number | null; estimated?: boolean }>, streamId: string) => {
    return hist.map(h => {
      const item: AllBitrateDataPoint = { time: h.time } as AllBitrateDataPoint;
      streams.forEach(s => {
        if (s.id === streamId) {
          // Use 0 for missing measurements so the combined timeline shows a drop to zero
          item[s.id] = typeof h.bitrate === 'number' ? h.bitrate : 0;
          // companion key to indicate whether this sample was estimated
          const rec = item as Record<string, number | null | boolean>;
          rec[`${s.id}__est`] = !!h.estimated;
        } else {
          // For other streams at this timestamp, default to 0 so lines continue (not cut)
          item[s.id] = 0;
          const rec2 = item as Record<string, number | null | boolean>;
          rec2[`${s.id}__est`] = false;
        }
      });
      return item;
    });
  }, [streams]);
  const [streamName, setStreamName] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [history, setHistory] = useState<string[]>([]);
  const [savedLists, setSavedLists] = useState<Record<string, Stream[]>>({});
  const [gridLayout, setGridLayout] = useState<"3-2" | "4-2" | "4-3">("4-2");
  const [allBitrateHistory, setAllBitrateHistory] = useState<
    AllBitrateDataPoint[]
  >([]);
  // track per-stream failure counts (no bitrate) and reload signals
  const [failureCounts, setFailureCounts] = useState<Record<string, number>>({});
  const [reloadSignals, setReloadSignals] = useState<Record<string, number>>({});
  const [logDates, setLogDates] = useState<string[]>([]);

  useEffect(() => {
    console.debug('allBitrateHistory updated (length):', allBitrateHistory.length);
  }, [allBitrateHistory]);
  const [selectedGraphStream, setSelectedGraphStream] = useState<string>("all");
  const { toast } = useToast();

  // compute latest aggregate bitrate (sum of numeric bitrates from most recent point)
  const latestTotalBitrate = useMemo(() => {
    if (!allBitrateHistory || allBitrateHistory.length === 0) return 0;
    // find latest point
    const latest = allBitrateHistory[allBitrateHistory.length - 1];
    if (!latest) return 0;
    // sum values for known streams
    let total = 0;
    streams.forEach(s => {
      const v = latest[s.id];
      if (typeof v === 'number' && isFinite(v)) total += v as number;
    });
    return Math.round(total * 100) / 100;
  }, [allBitrateHistory, streams]);

  useEffect(() => {
    try {
      const savedStreams = localStorage.getItem("streams");
      if (savedStreams) {
        const parsedStreams = JSON.parse(savedStreams);
        if (Array.isArray(parsedStreams)) {
          const streamsWithColors = parsedStreams.map((stream, index) => ({
            ...stream,
            color: stream.color || streamColors[index % streamColors.length],
          }));
          setStreams(streamsWithColors);
        }
      }
    } catch (error) {
      console.error("Failed to load streams from localStorage", error);
    }

    // Fetch available log dates from the server
    fetch(`${API_BASE}/logs/dates`)
      .then(res => res.json())
      .then(dates => setLogDates(dates))
      .catch(err => console.error("Failed to fetch log dates", err));
  }, [API_BASE]);

  // On first load (e.g. after browser refresh) retry/reload all configured streams.
  // This bumps `reloadSignals` so `VideoPlayer` instances reload, and ensures the
  // server is asked to start/transcode each stream and fetch history.
  const _initialLoadRef = useRef(true);
  useEffect(() => {
    if (!_initialLoadRef.current) return;
    if (!streams || streams.length === 0) return;
    _initialLoadRef.current = false;

    streams.forEach(s => {
      // nudge the player to reload (increment signal)
      setReloadSignals(rs => ({ ...rs, [s.id]: (rs[s.id] || 0) + 1 }));
      // ensure server started and history fetched
      setTimeout(() => ensureStartAndFetchHistory(s), 10);
    });
  }, [streams, ensureStartAndFetchHistory]);

  // Ensure server start + fetch history for any streams we haven't started yet.
  useEffect(() => {
    streams.forEach(s => {
      if (!startedStreamsRef.current.has(s.id)) {
        ensureStartAndFetchHistory(s);
      }
    });
  }, [streams, ensureStartAndFetchHistory]);

  // Keep the clock ticking so the chart's timeDomain can be computed from `currentTime` and remain live.
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("streams", JSON.stringify(streams));
    } catch (error) {
      console.error("Failed to save streams to localStorage", error);
    }
  }, [streams]);

  const removeStream = useCallback((streamId: string) => {
    setStreams(prev => prev.filter(stream => stream.id !== streamId));
    setAllBitrateHistory(prev => {
      const newHistory = prev.map(point => {
        const newPoint = { ...point };
        delete newPoint[streamId];
        return newPoint;
      });
      return newHistory.filter(point => Object.keys(point).length > 1);
    });
  startedStreamsRef.current.delete(streamId);
  }, []);

  const handleBitrateUpdate = useCallback((streamId: string, bitrate: number | null) => {
  console.debug(`handleBitrateUpdate: ${streamId} -> ${bitrate} Mbps`);
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    setAllBitrateHistory(prev => {
      const lastPoint = prev.length > 0 ? prev[prev.length - 1] : null;
      
      const newPoint: AllBitrateDataPoint = {
        time: now,
      };

      streams.forEach(stream => {
        if (stream.id === streamId) {
          if (typeof bitrate === 'number') {
            // explicit numeric measurement
            newPoint[stream.id] = bitrate;
            (newPoint as Record<string, number | null | boolean>)[`${stream.id}__est`] = false;
          } else {
            // No recent measurement -> treat as 0 so the chart falls to zero and continues plotting
            newPoint[stream.id] = 0;
            (newPoint as Record<string, number | null | boolean>)[`${stream.id}__est`] = false;
          }
        } else if (lastPoint && lastPoint[stream.id] !== undefined) {
          newPoint[stream.id] = lastPoint[stream.id];
          // copy the estimated flag from lastPoint if present
          const lastRec = lastPoint as Record<string, number | null | boolean>;
          (newPoint as Record<string, number | null | boolean>)[`${stream.id}__est`] = !!lastRec[`${stream.id}__est`];
        } else {
          // If we have no previous value for this stream at this timestamp, record 0
          // so the chart continues to plot a line down to zero instead of breaking.
          newPoint[stream.id] = 0;
          (newPoint as Record<string, number | null | boolean>)[`${stream.id}__est`] = false;
        }
      });

      // Add the new point and filter out data older than 24 hours
      const newHistory = [...prev, newPoint];
      return newHistory.filter(p => p.time >= twentyFourHoursAgo);
    });
  }, [streams]);

  // Real-time updates via Server-Sent Events (SSE)
  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/+$/, '')) || `${window.location.protocol}//${window.location.hostname}:3001`;
    const eventsUrl = `${API_BASE.replace(/\/+$/, '')}/events`;
    const evtSource = new EventSource(eventsUrl);

    const handleEvent = (e) => {
      try {
        const payload = JSON.parse(e.data);
    if (payload.type === 'bitrate') {
            // Try to find the matching stream by original URL first (server now includes sourceUrl or streamUrl)
            let targetStreamId = payload.streamId;
            const serverUrl = payload.sourceUrl || payload.streamUrl || payload.source_url || null;
            if (serverUrl) {
              const normalized = normalizeUrl(serverUrl);
              const match = streams.find(s => normalizeUrl(s.url) === normalized);
              if (match) targetStreamId = match.id;
            }
          // update history
          // If server reports null (no measurement), treat it as 0 so the graph drops to zero when stream is down.
          const reported = typeof payload.bitrate === 'number' ? payload.bitrate : 0;
          handleBitrateUpdate(targetStreamId, reported);
          setFailureCounts(prev => {
            const cur = prev[targetStreamId] || 0;
            if (typeof reported === 'number' && reported > 0) {
              return { ...prev, [targetStreamId]: 0 };
            } else {
              return { ...prev, [targetStreamId]: cur + 1 };
            }
          });
        } else if (payload.type === 'bitrate-history') {
          // Merge history array of {time, bitrate, estimated?}
          const hist = Array.isArray(payload.history) ? payload.history : [];
          if (hist.length > 0) {
            // payload may include sourceUrl; find matching local stream id
            const serverUrl = payload.sourceUrl || payload.streamUrl || payload.source_url || null;
            let targetId = payload.streamId;
            if (serverUrl) {
              const normalized = normalizeUrl(serverUrl);
              const match = streams.find(s => normalizeUrl(s.url) === normalized);
              if (match) targetId = match.id;
            }
            const added = mergeHistoryToPoints(hist, targetId);
            setAllBitrateHistory(prev => {
              const merged = [...prev, ...added];
              const mapByTime: Record<number, AllBitrateDataPoint> = {};
              merged.forEach(m => { mapByTime[m.time] = { ...(mapByTime[m.time]||{}), ...m }; });
              const out = Object.values(mapByTime).sort((a,b)=>a.time-b.time);
              const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
              return out.filter(p=>p.time >= twentyFourHoursAgo);
            });
          }
        } else if (payload.type === 'started') {
          let targetStreamId = payload.streamId;
          const serverUrl = payload.sourceUrl || payload.streamUrl || payload.source_url || null;
          if (serverUrl) {
            const normalized = normalizeUrl(serverUrl);
            const match = streams.find(s => normalizeUrl(s.url) === normalized);
            if (match) targetStreamId = match.id;
          }
          setReloadSignals(rs => ({ ...rs, [targetStreamId]: (rs[targetStreamId] || 0) + 1 }));
          setFailureCounts(prev => ({ ...prev, [targetStreamId]: 0 }));
        } else if (payload.type === 'stopped') {
          let targetStreamId = payload.streamId;
          const serverUrl = payload.sourceUrl || payload.streamUrl || payload.source_url || null;
          if (serverUrl) {
            const normalized = normalizeUrl(serverUrl);
            const match = streams.find(s => normalizeUrl(s.url) === normalized);
            if (match) targetStreamId = match.id;
          }
          // mark a zero bitrate immediately when server signals stopped
          try { handleBitrateUpdate(targetStreamId, 0); } catch (e) { console.debug('handleBitrateUpdate failed', e); }
          setFailureCounts(prev => ({ ...prev, [targetStreamId]: (prev[targetStreamId] || 0) + 1 }));
        }
      } catch (err) {
        console.debug('SSE parse error', err);
      }
    };

    evtSource.addEventListener('message', handleEvent);
    evtSource.addEventListener('error', (err) => console.debug('SSE error', err));

    return () => {
      evtSource.removeEventListener('message', handleEvent);
      evtSource.close();
    };
  }, [handleBitrateUpdate, streams, mergeHistoryToPoints]);

  const normalizeUrl = (url: string) => url.trim().toLowerCase().replace(/\/$/, "");

  const isValidStreamUrl = (url: string): boolean => {
  try {
    const lowerUrl = url.trim().toLowerCase();

    return (
      lowerUrl.startsWith("http://") ||
      lowerUrl.startsWith("https://") ||
      lowerUrl.startsWith("rtmp://") ||
      lowerUrl.startsWith("rtsp://") ||
      lowerUrl.startsWith("udp://") || // ✅ UDP support
      lowerUrl.includes(".m3u8")
    );
  } catch {
    return false;
  }
};

  const addStream = () => {
    const urlToAdd = streamUrl.trim();
    if (!urlToAdd || !isValidStreamUrl(urlToAdd)) {
      toast({
        title: "Invalid Stream URL",
        description: "Enter a valid HLS (.m3u8), RTMP, RTSP, HTTP, or UDP URL",
        variant: "destructive",
      });
      return;
    }

    if (streams.length >= 12) {
      toast({
        title: "Limit Reached",
        description: "You can add up to 12 streams",
        variant: "destructive",
      });
      return;
    }

    const normalized = normalizeUrl(urlToAdd);
    if (streams.some(s => normalizeUrl(s.url) === normalized)) {
      toast({
        title: "Duplicate Stream",
        description: "This stream URL is already added",
        variant: "destructive",
      });
      return;
    }

    const nameToAdd = streamName.trim() || `Stream ${streams.length + 1}`;

    if (!history.includes(urlToAdd)) {
      setHistory(prev => [urlToAdd, ...prev].slice(0, 20));
    }

    const newStream: Stream = {
      id: `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: nameToAdd,
      url: urlToAdd,
      color: streamColors[streams.length % streamColors.length],
    };
    setStreams((prev) => {
      const next = [...prev, newStream];
      // kick off server start + history fetch for the new stream
      setTimeout(() => ensureStartAndFetchHistory(newStream), 10);
      return next;
    });
    setStreamName("");
    setStreamUrl("");
    toast({
      title: "Stream Added",
      description: `Stream added successfully (${streams.length + 1}/12)`,
    });
  };

  const clearAllStreams = () => {
    if (streams.length > 0 && window.confirm("Are you sure you want to remove all streams?")) {
      setStreams([]);
  startedStreamsRef.current.clear();
      toast({
        title: "All Streams Cleared",
        description: "All streams have been removed from the wall.",
      });
    }
  };

  const removeHistoryItem = (urlToRemove: string) => {
    setHistory(prev => prev.filter(url => url !== urlToRemove));
  };

  const saveListToFile = () => {
  const listName = prompt("Enter a name for your stream list:");
  if (listName && listName.trim() !== "") {
    // Prepare content with list name on the first line
    const content =
      `ListName:${listName.trim()}\n` +
      streams.map(s => `${s.name};${s.url}`).join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${listName.trim()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "List Saved to File",
      description: `Stream list '${listName.trim()}' saved successfully.`,
    });
  }
};

const loadListFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    if (text) {
      const lines = text.split(/\r?\n/).filter(Boolean);
      let listName = "";
      let streamLines = lines;

      if (lines[0].startsWith("ListName:")) {
        listName = lines[0].substring("ListName:".length).trim();
        streamLines = lines.slice(1);
        toast({
          title: "Loaded List Name",
          description: `Stream list: ${listName}`,
        });
      }

      const newStreams = streamLines
        .map((line, index) => {
          const parts = line.split(";");
          const name = parts.length === 2 ? parts[0].trim() : `Stream ${index + 1}`;
          const url = parts.length === 2 ? parts[1].trim() : parts[0].trim();

          if (!url) return null;

          return {
            id: `stream-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}-${index}`,
            name,
            url,
            color: streamColors[index % streamColors.length],
          };
        })
        .filter(Boolean)
        .slice(0, 12);

  setStreams(newStreams);
  // start and fetch history for loaded streams
  setTimeout(() => newStreams.forEach(s => ensureStartAndFetchHistory(s)), 20);
      toast({
        title: "List Loaded from File",
        description: `Loaded ${newStreams.length} stream(s) from file.`,
      });
    }
  };
  reader.readAsText(file);
  event.target.value = "";
};

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addStream();
  };

  const gridClass =
    gridLayout === "3-2"
      ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
      : gridLayout === "4-2"
      ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-3 xl:grid-cols-4";

  return (
  <div className="space-y-6 p-2">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
      {/* Header */}
      <div className="space-y-6 mt-[-10px]">
        {/* Logo and Info Section */}
        <div className="flex items-center justify-start space-x-3 mb-2">
          <img src="/logo.png" alt="StreamWall Logo" className="h-14 w-14 mt-[-8px]" />
          <div>
            <h1 className="text-4xl font-bold bg-gradient-primary text-justify bg-clip-text text-white">
              StreamWall
            </h1>
            <p className="text-muted-foreground text-justify">All Streams. One Wall.</p>
            <p className="text-xs text-muted-foreground text-justify">Dev. By TMC MCR</p>
          </div>
        </div>
          </div>
        <p className="text-4xl font-semibold text-foreground mt-[-15px]">
          {currentTime.toLocaleTimeString([], { hour12: false })}
          <p>{currentTime.toISOString().slice(0, 10)}</p>
        </p>
      {/* Add Stream Form */}
      <div className="lg:w-3/5 pt-3">
        <Card className="bg-transparent-card border-none shadow-none w-full lg:w-auto">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {/* Stream Name and URL inputs in same line */}
              <div className="flex gap-2">
                {/* Stream Name: smaller width */}
                <Input
                  id="stream-name"
                  type="text"
                  placeholder="Stream Name"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  className="w-1/4 bg-input border-stream-border focus:ring-primary"
                />

                {/* Stream URL: larger width */}
                <Input
                  id="stream-url"
                  type="url"
                  placeholder="Enter a stream URL that supports HTTP HLS (.m3u8), RTMP, RTSP or UDP."
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="w-3/4 bg-input border-stream-border focus:ring-primary"
                />
              </div>
            </div>

            {/* Stream actions */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={history.length === 0}>
                    <History className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {history.map((url, index) => (
                    <DropdownMenuItem key={index} onSelect={() => setStreamUrl(url)}>
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate pr-2">{url}</span>
                        <Trash2
                          className="h-4 w-4 text-destructive cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeHistoryItem(url);
                          }}
                        />
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {history.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => setHistory([])}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear History
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Add Stream Button */}
              <Button
                onClick={addStream}
                disabled={streams.length >= 12}
                className="bg-gradient-primary hover:shadow-glow transition-all"
              >
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>

              {/* Remove All Streams Button */}
              <Button
                onClick={clearAllStreams}
                variant="destructive"
                size="icon"
                disabled={streams.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              {/* Save List Button */}
              <Button onClick={saveListToFile} variant="outline" disabled={streams.length === 0}>
                <Save className="h-4 w-4 mr-2" /> Save List
              </Button>

              {/* Load List Button */}
              <label htmlFor="load-list-file" className="inline-block">
                <input
                  id="load-list-file"
                  type="file"
                  accept=".txt"
                  style={{ display: "none" }}
                  onChange={loadListFromFile}
                />
                <Button asChild variant="outline">
                  <span>Load File</span>
                </Button>
              </label>

              {/* Moved Grid Layout Toggle */}
              <div className="flex gap-2 items-center ml-auto">
                <Button
                  variant={gridLayout === "3-2" ? "default" : "outline"}
                  onClick={() => setGridLayout("3-2")}
                >
                  3-2
                </Button>
                <Button
                  variant={gridLayout === "4-2" ? "default" : "outline"}
                  onClick={() => setGridLayout("4-2")}
                >
                  4-2
                </Button>
                <Button
                  variant={gridLayout === "4-3" ? "default" : "outline"}
                  onClick={() => setGridLayout("4-3")}
                >
                  4-3
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={logDates.length === 0}>
                    <History className="h-4 w-4 mr-2" /> Download Logs
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {logDates.map((date) => (
                    <React.Fragment key={date}>
                      <DropdownMenuItem onSelect={() => window.open(`${API_BASE}/download-log/${date}/bitrate`, '_blank')}>
                        {date} - Bitrate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => window.open(`${API_BASE}/download-log/${date}/issues`, '_blank')}>
                        {date} - Issues
                      </DropdownMenuItem>
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Stream Grid */}
    <div className="lg:col-span-3">
      {streams.length === 0 ? (
        <Card className="bg-gradient-card border-stream-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No streams active</h3>
            <p className="text-muted-foreground max-w-md">
              Add your first stream URL above to start monitoring. Supports up to 12 concurrent streams.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid ${gridClass} gap-2`}>
          {streams.map((stream) => {
            const bitrateHistory = allBitrateHistory
              .filter(point => typeof point[stream.id] === 'number')
              .map(point => ({ time: point.time, bitrate: point[stream.id] as number }));
            return (
              <div key={stream.id} className="relative">
                {/* Restart button positioned before stream card */}
                <div className="absolute bottom-2 right-2 z-20 flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      try {
                        const body = { streamUrl: stream.url, streamName: stream.name };
                        const res = await fetch(`${API_BASE}/restart-stream`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                        });
                        if (!res.ok) {
                          const txt = await res.text().catch(() => 'restart failed');
                          toast({ title: 'Restart Failed', description: txt, variant: 'destructive' });
                        } else {
                          const json = await res.json().catch(() => ({}));
                          // try to prime the server HLS by requesting start-stream (server will be idempotent)
                          try {
                            await fetch(`${API_BASE}/start-stream`, {
                              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ streamUrl: stream.url, streamName: stream.name })
                            }).catch(() => null);
                          } catch (e) { void e; }

                          // nudge the player to reload by bumping reloadSignals
                          setReloadSignals(rs => ({ ...rs, [stream.id]: (rs[stream.id] || 0) + 1 }));
                          // reset failure count so status shows retrying/online
                          setFailureCounts(fc => ({ ...fc, [stream.id]: 0 }));
                          toast({ title: 'Restarted', description: `Restart requested for ${stream.name}` });
                        }
                      } catch (err) {
                        console.error('Restart request failed', err);
                        toast({ title: 'Restart Error', description: String(err), variant: 'destructive' });
                      }
                    }}
                  >
                   <RotateCcw className="h-4 w-4" />

                  </Button>
                </div>
                <VideoPlayer
                  streamId={stream.id}
                  streamName={stream.name}
                  streamUrl={stream.url}
                  onRemove={() => removeStream(stream.id)}
                  reloadSignal={reloadSignals[stream.id] || 0}
                  onBitrateUpdate={handleBitrateUpdate}
                  status={
                    (failureCounts[stream.id] || 0) === 0
                      ? 'online'
                      : (failureCounts[stream.id] || 0) < 3
                      ? 'offline'
                      : 'offline'
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* All Streams Bitrate Graph */}
    {streams.length > 0 && (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold text-white">Real-time Bitrate Monitor: </h2>
            <span className="text-lg font-semibold text-blue-500">{latestTotalBitrate} Mbps</span>
          </div>
          <Select
            value={selectedGraphStream}
            onValueChange={setSelectedGraphStream}
          >
            <SelectTrigger className="w-[240px] bg-input border-stream-border">
              <SelectValue placeholder="Select a stream to display" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Streams</SelectItem>
              {streams.map((stream) => (
                <SelectItem key={stream.id}  value={stream.id}>
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: stream.color }}
                    />
                    {stream.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card className="bg-gradient-card border-stream-border">
          <CardContent className="pt-2">
            <AllBitrateGraph
              data={allBitrateHistory}
              streams={
                selectedGraphStream === "all"
                  ? streams
                  : streams.filter((s) => s.id === selectedGraphStream)
              }
              timeDomain={[currentTime.getTime() - 24 * 60 * 60 * 1000, currentTime.getTime()]}
              height={600}
            />
          </CardContent>
        </Card>
      </div>
    )}
  </div>
);
};

