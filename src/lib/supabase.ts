import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Stream {
  id: string
  user_id: string
  name: string
  url: string
  stream_type: 'HLS' | 'RTMP' | 'RTSP' | 'UDP' | 'HTTP'
  created_at: string
  updated_at: string
  bitrate?: number
}

export interface Profile {
  id: string
  email: string
  created_at: string
}