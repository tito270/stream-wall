# Supabase Setup for StreamWall

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (usually 2-3 minutes)

## 2. Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy your **Project URL** and **anon public key**
3. Update `src/lib/supabase.ts` with your credentials:

```typescript
const supabaseUrl = 'YOUR_PROJECT_URL_HERE'
const supabaseAnonKey = 'YOUR_ANON_KEY_HERE'
```

## 3. Create Database Tables

In your Supabase dashboard, go to **SQL Editor** and run this SQL:

```sql
-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create streams table
CREATE TABLE streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  stream_type TEXT NOT NULL CHECK (stream_type IN ('HLS', 'RTMP', 'RTSP', 'UDP', 'HTTP')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on streams table
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for streams
CREATE POLICY "Users can view own streams" ON streams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streams" ON streams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streams" ON streams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own streams" ON streams FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_streams_updated_at 
    BEFORE UPDATE ON streams 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## 4. Configure Authentication

1. In Supabase dashboard, go to **Authentication** > **Settings**
2. Under **Auth Providers**, make sure **Email** is enabled
3. Optionally configure email templates and other providers as needed

## 5. Test Your Setup

1. Start your application: `npm run dev`
2. Navigate to the signup page and create a test account
3. Check your Supabase dashboard to see if the user was created
4. Try adding a stream to verify the database integration works

## Security Notes

- Row Level Security (RLS) is enabled to ensure users can only access their own streams
- All database operations are automatically filtered by user ID
- Authentication is handled by Supabase Auth with secure JWT tokens

## Troubleshooting

- If you get "Invalid API key" errors, double-check your credentials in `src/lib/supabase.ts`
- If streams don't save, verify the database schema was created correctly
- Check the Supabase logs in your dashboard for detailed error messages