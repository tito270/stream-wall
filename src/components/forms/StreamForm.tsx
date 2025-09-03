import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Stream } from '@/lib/supabase'
import { Plus, Save } from 'lucide-react'

interface StreamFormProps {
  stream?: Stream
  onSubmit: (data: { name: string; url: string; stream_type: string }) => Promise<void>
  onCancel?: () => void
  title?: string
}

export function StreamForm({ stream, onSubmit, onCancel, title = 'Add New Stream' }: StreamFormProps) {
  const [name, setName] = useState(stream?.name || '')
  const [url, setUrl] = useState(stream?.url || '')
  const [streamType, setStreamType] = useState(stream?.stream_type || '')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const detectStreamType = (url: string): string => {
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.includes('.m3u8')) return 'HLS'
    if (lowerUrl.startsWith('rtmp://')) return 'RTMP'
    if (lowerUrl.startsWith('rtsp://')) return 'RTSP'
    if (lowerUrl.startsWith('udp://')) return 'UDP'
    if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) return 'HTTP'
    return 'HTTP' // default
  }

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      const validProtocols = ['http:', 'https:', 'rtmp:', 'rtsp:', 'udp:']
      return validProtocols.includes(urlObj.protocol)
    } catch {
      return false
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    if (value && !streamType) {
      setStreamType(detectStreamType(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a stream name',
        variant: 'destructive',
      })
      return
    }

    if (!url.trim()) {
      toast({
        title: 'URL required',
        description: 'Please enter a stream URL',
        variant: 'destructive',
      })
      return
    }

    if (!validateUrl(url)) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid stream URL with supported protocol',
        variant: 'destructive',
      })
      return
    }

    if (!streamType) {
      toast({
        title: 'Stream type required',
        description: 'Please select a stream type',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        stream_type: streamType,
      })
      
      if (!stream) {
        // Reset form for new streams
        setName('')
        setUrl('')
        setStreamType('')
      }
    } catch (error) {
      // Error handling is done in the parent component
    }
    setLoading(false)
  }

  return (
    <Card className="bg-gradient-card border-stream-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {stream ? <Save className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Stream Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Camera 1, Main Feed"
                required
                className="bg-input border-stream-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Stream Type</Label>
              <Select value={streamType} onValueChange={setStreamType} required>
                <SelectTrigger className="bg-input border-stream-border">
                  <SelectValue placeholder="Select stream type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HLS">HLS (.m3u8)</SelectItem>
                  <SelectItem value="RTMP">RTMP</SelectItem>
                  <SelectItem value="RTSP">RTSP</SelectItem>
                  <SelectItem value="UDP">UDP</SelectItem>
                  <SelectItem value="HTTP">HTTP/HTTPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Stream URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Enter stream URL (e.g. https://example.com/stream.m3u8)"
              required
              className="bg-input border-stream-border"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-primary hover:shadow-glow"
            >
              {loading ? 'Saving...' : (stream ? 'Update Stream' : 'Add Stream')}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}