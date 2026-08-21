import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserRole, UserProfile } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    restaurantName?: string,
    restaurantId?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'owner',
  setRole: () => {},
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  isLoading: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRoleState] = useState<UserRole>('owner');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Synchronize context state with Supabase Session
  const syncSession = async (session: Session | null) => {
    if (!session || !session.user) {
      setUser(null);
      setRoleState('staff');
      setIsLoading(false);
      return;
    }

    try {
      // Fetch user profile from database to get tenant details and role
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        const profileUser: UserProfile = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as UserRole,
          restaurant_id: profile.restaurant_id,
          phone_number: profile.phone_number,
        };
        setUser(profileUser);
        setRoleState(profile.role as UserRole);
      } else {
        // Fallback context if trigger profile row is not yet completed
        const fallbackUser: UserProfile = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || '',
          email: session.user.email || '',
          role: (session.user.user_metadata?.role || 'staff') as UserRole,
          restaurant_id: session.user.user_metadata?.restaurant_id || '',
        };
        setUser(fallbackUser);
        setRoleState(fallbackUser.role);
      }
    } catch (err) {
      console.warn('[AuthContext syncSession] Error fetching user profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Get initial session on app mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session);
    });

    // 2. Listen for auth changes throughout app runtime
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    restaurantName?: string,
    restaurantId?: string
  ) => {
    setIsLoading(true);
    try {
      // Import API base URL dynamically to avoid circular references if any
      const { API_BASE_URL } = require('../services/api');

      // Call registration route to handle multi-tenant settings
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: name,
          role,
          restaurant_name: restaurantName,
          restaurant_id: restaurantId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign up.');
      }

      // Automatically sign in locally after registration succeeds
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, setRole, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
