import { supabase } from '@/integrations/supabase/client';

export interface UserPayload {
    id: string;
    email?: string;
    username: string;
    roles: string[];
}

// Clear per-user localStorage keys when a user logs in to avoid mixing saved lists
function clearLocalStreamCacheForUser(username?: string) {
    try {
        const key = `sm_saved_streams_v1_${username || 'anon'}`;
        localStorage.removeItem(key);
    } catch (e) {
        // ignore
    }
}

export const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw new Error(error.message || 'Failed to login');
    }

    if (data.user) {
        // Get user profile and roles
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', data.user.id)
            .single();

        const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', data.user.id);

        const username = profile?.username || data.user.email || 'user';
        clearLocalStreamCacheForUser(username);
    }

    return data;
};

export const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw new Error(error.message);
    }
};

export const isAuthenticated = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
};

export const getUser = async (): Promise<UserPayload | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) return null;

        // Get user profile and roles
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', session.user.id)
            .single();

        const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id);

        return {
            id: session.user.id,
            email: session.user.email,
            username: profile?.username || session.user.email || 'user',
            roles: userRoles?.map(r => r.role) || []
        };
    } catch (e) {
        return null;
    }
};

export const getToken = (): Promise<string | null> => {
    try {
        return supabase.auth.getSession().then(({ data: { session } }) => 
            session?.access_token || null
        );
    } catch {
        return Promise.resolve(null);
    }
};