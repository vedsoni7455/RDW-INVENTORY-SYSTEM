import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole, UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  login: (name: string, email: string, role: UserRole) => Promise<void>;
  signup: (name: string, email: string, role: UserRole, restaurantName?: string) => Promise<void>;
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

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const stored = await AsyncStorage.getItem('rdw_user');
      if (stored) {
        const parsed: UserProfile = JSON.parse(stored);
        setUser(parsed);
        setRoleState(parsed.role || 'owner');
      }
    } catch (e) {
      console.warn('Failed to load user session:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (user) {
      const updated = { ...user, role: newRole };
      setUser(updated);
      AsyncStorage.setItem('rdw_user', JSON.stringify(updated));
    }
  };

  const login = async (name: string, email: string, newRole: UserRole) => {
    setIsLoading(true);
    const newUser: UserProfile = {
      id: Date.now().toString(),
      name: name || (newRole === 'owner' ? 'Restaurant Owner' : newRole === 'manager' ? 'Store Manager' : 'Kitchen Staff'),
      email: email || `${newRole}@rdwrestaurant.com`,
      role: newRole,
    };
    setUser(newUser);
    setRoleState(newRole);
    await AsyncStorage.setItem('rdw_user', JSON.stringify(newUser));
    setIsLoading(false);
  };

  const signup = async (name: string, email: string, newRole: UserRole, restaurantName?: string) => {
    setIsLoading(true);
    const newUser: UserProfile = {
      id: Date.now().toString(),
      name,
      email,
      role: newRole,
    };
    setUser(newUser);
    setRoleState(newRole);
    await AsyncStorage.setItem('rdw_user', JSON.stringify(newUser));
    setIsLoading(false);
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('rdw_user');
  };

  return (
    <AuthContext.Provider value={{ user, role, setRole, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
