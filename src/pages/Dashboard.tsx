import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EnhancedVideoPlayer } from '@/components/enhanced/EnhancedVideoPlayer'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { StreamForm } from '@/components/forms/StreamForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase, Stream } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Monitor, Plus, Activity } from 'lucide-react'

export default function Dashboard() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStream, setEditingStream] = useState<Stream | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Load streams from Supabase
  useEffect(() => {
    loadStreams()
  }, [user])

  const loadStreams = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setStreams(data || [])
    } catch (error) {
      toast({
        title: 'Error loading streams',
        description: 'Failed to load your streams',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStream = async (streamData: { name: string; url: string; stream_type: string }) => {
    if (!editingStream || !user) return

    try {
      const { error } = await supabase
        .from('streams')
        .update({
          name: streamData.name,
          url: streamData.url,
          stream_type: streamData.stream_type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingStream.id)
        .eq('user_id', user.id)

      if (error) throw error

      setEditingStream(null)
      loadStreams()
      toast({
        title: 'Stream updated',
        description: 'Stream has been updated successfully',
      })
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to update stream',
        variant: 'destructive',
      })
    }
  }

  const handleRemoveStream = async (streamId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('streams')
        .delete()
        .eq('id', streamId)
        .eq('user_id', user.id)

      if (error) throw error

      setStreams(prev => prev.filter(s => s.id !== streamId))
      toast({
        title: 'Stream removed',
        description: 'Stream has been removed successfully',
      })
    } catch (error) {
      toast({
        title: 'Remove failed',
        description: 'Failed to remove stream',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Stream Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor your video streams with real-time bitrate calculation
            </p>
          </div>
          
          <Button
            onClick={() => navigate('/dashboard/add-stream')}
            className="bg-gradient-primary hover:shadow-glow"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Stream
          </Button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-stream-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Monitor className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Streams</p>
                  <p className="text-2xl font-bold">{streams.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-stream-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-stream-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Streams</p>
                  <p className="text-2xl font-bold text-stream-success">{streams.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-stream-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-gradient-primary rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-foreground">6</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Streams</p>
                  <p className="text-2xl font-bold">{6 - streams.length}</p>
                  <p className="text-xs text-muted-foreground">remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Streams Grid */}
        {streams.length === 0 ? (
          <Card className="bg-gradient-card border-stream-border">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Monitor className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No streams configured</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Get started by adding your first video stream. Support for HLS, RTMP, RTSP, UDP, and HTTP streams.
              </p>
              <Button
                onClick={() => navigate('/dashboard/add-stream')}
                className="bg-gradient-primary hover:shadow-glow"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Stream
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <EnhancedVideoPlayer
                key={stream.id}
                stream={stream}
                onRemove={() => handleRemoveStream(stream.id)}
                onEdit={() => setEditingStream(stream)}
                className="w-full"
              />
            ))}
          </div>
        )}

        {/* Edit Stream Dialog */}
        <Dialog open={!!editingStream} onOpenChange={() => setEditingStream(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Stream</DialogTitle>
            </DialogHeader>
            {editingStream && (
              <StreamForm
                stream={editingStream}
                onSubmit={handleUpdateStream}
                onCancel={() => setEditingStream(null)}
                title="Update Stream"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}