import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Types for our authentication context
interface Profile {
  id: string;
  user_id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'admin';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRoles: UserRole[];
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  createUser: (email: string, password: string, username: string, role?: 'user' | 'admin') => Promise<{ error: any }>;
  updateUserRole: (userId: string, role: 'user' | 'admin') => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user is admin
  const isAdmin = userRoles.some(role => role.role === 'admin');

  // Fetch user profile and roles
  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        setProfile(profileData);
      }

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      } else {
        setUserRoles(rolesData || []);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer data fetching to avoid auth callback issues
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setUserRoles([]);
        }
        
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserData(session.user.id);
        }, 0);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // Sign up function
  const signUp = async (email: string, password: string, username: string) => {
    // Check if username already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingProfile) {
      return { error: { message: 'Username already exists' } };
    }

    // Password strength validation
    if (password.length < 6) {
      return { error: { message: 'Password must be at least 6 characters long' } };
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username
        }
      }
    });

    // Update the profile with the custom username after signup
    if (!error) {
      setTimeout(async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await supabase
            .from('profiles')
            .update({ username })
            .eq('user_id', userData.user.id);
        }
      }, 1000);
    }

    return { error };
  };

  // Sign out function
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Admin function to create user with role assignment
  const createUser = async (email: string, password: string, username: string, role: 'user' | 'admin' = 'user') => {
    if (!isAdmin) {
      return { error: { message: 'Unauthorized: Admin access required' } };
    }

    // Check if username already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingProfile) {
      return { error: { message: 'Username already exists' } };
    }

    // Password strength validation
    if (password.length < 6) {
      return { error: { message: 'Password must be at least 6 characters long' } };
    }

    // Create user via admin API (this would typically be done server-side)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: username
      }
    });

    if (error) {
      return { error };
    }

    // Update profile with custom username and assign role
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ username })
        .eq('user_id', data.user.id);

      if (role === 'admin') {
        await supabase
          .from('user_roles')
          .insert({ user_id: data.user.id, role: 'admin' });
      }
    }

    return { error: null };
  };

  // Admin function to update user role
  const updateUserRole = async (userId: string, role: 'user' | 'admin') => {
    if (!isAdmin) {
      return { error: { message: 'Unauthorized: Admin access required' } };
    }

    // Remove existing admin role if downgrading
    if (role === 'user') {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');
    } else {
      // Add admin role if upgrading
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: 'admin' });
      
      if (error) {
        return { error };
      }
    }

    return { error: null };
  };

  const value = {
    user,
    session,
    profile,
    userRoles,
    isAdmin,
    loading,
    signIn,
    signUp,
    signOut,
    createUser,
    updateUserRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};