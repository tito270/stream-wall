import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Monitor, Activity, Shield, Zap, Eye, Database } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  const features = [
    {
      icon: Monitor,
      title: 'Multi-Protocol Support',
      description: 'Support for HLS, RTMP, RTSP, UDP, and HTTP video streams',
    },
    {
      icon: Activity,
      title: 'Real-time Bitrate',
      description: 'Live bitrate calculation and monitoring for all streams',
    },
    {
      icon: Eye,
      title: 'Live Monitoring',
      description: 'Watch up to 6 streams simultaneously with full controls',
    },
    {
      icon: Database,
      title: 'Stream Management',
      description: 'Save, organize, and manage your stream configurations',
    },
    {
      icon: Shield,
      title: 'Secure Access',
      description: 'User authentication and private stream management',
    },
    {
      icon: Zap,
      title: 'High Performance',
      description: 'Optimized for minimal latency and smooth playback',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center space-y-8">
            <div className="flex items-center justify-center mb-8">
              <Monitor className="h-16 w-16 text-primary" />
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              StreamWall
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Professional multi-stream monitoring application with real-time bitrate calculation
              and support for all major streaming protocols.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
              <Button
                size="lg"
                onClick={() => navigate('/signup')}
                className="bg-gradient-primary hover:shadow-glow text-lg px-8 py-6"
              >
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login')}
                className="text-lg px-8 py-6 border-stream-border hover:bg-muted/50"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need for stream monitoring
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive tools and features designed for professional video stream management
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="bg-gradient-card border-stream-border shadow-card hover:shadow-glow/50 transition-all"
            >
              <CardContent className="p-6">
                <feature.icon className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <Card className="bg-gradient-card border-stream-border shadow-card">
          <CardContent className="p-12">
            <h2 className="text-3xl font-bold mb-4">
              Ready to start monitoring?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join StreamWall today and take control of your video streams with 
              professional-grade monitoring tools.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/signup')}
              className="bg-gradient-primary hover:shadow-glow text-lg px-8 py-6"
            >
              Create Your Account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}