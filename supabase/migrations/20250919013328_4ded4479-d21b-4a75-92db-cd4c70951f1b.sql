-- Create admin user account
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@admin.com',
  crypt('123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

-- Create admin profile
INSERT INTO public.profiles (user_id, username)
SELECT u.id, 'admin'
FROM auth.users u
WHERE u.email = 'admin@admin.com'
ON CONFLICT (user_id) DO NOTHING;

-- Grant admin role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE u.email = 'admin@admin.com'
ON CONFLICT (user_id, role) DO NOTHING;