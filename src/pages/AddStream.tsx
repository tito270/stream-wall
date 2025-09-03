import { useNavigate } from 'react-router-dom'
import { StreamForm } from '@/components/forms/StreamForm'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AddStream() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleAddStream = async (streamData: { name: string; url: string; stream_type: string }) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to add streams',
        variant: 'destructive',
      })
      return
    }

    try {
      const { error } = await supabase.from('streams').insert([
        {
          user_id: user.id,
          name: streamData.name,
          url: streamData.url,
          stream_type: streamData.stream_type,
        },
      ])

      if (error) throw error

      toast({
        title: 'Stream added',
        description: 'Your stream has been added successfully',
      })
      
      navigate('/dashboard')
    } catch (error: any) {
      toast({
        title: 'Failed to add stream',
        description: error.message || 'Please try again',
        variant: 'destructive',
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Add New Stream
            </h1>
            <p className="text-muted-foreground">
              Configure a new video stream for monitoring
            </p>
          </div>
        </div>

        {/* Stream Form */}
        <StreamForm onSubmit={handleAddStream} />
      </div>
    </DashboardLayout>
  )
}