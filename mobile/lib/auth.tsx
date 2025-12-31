import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api, User } from './api';
import * as SecureStore from 'expo-secure-store';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (firstName: string, lastName: string, birthday: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const checkingAuth = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    
    // Immediately restore cached user for instant UI (important for hot reloads)
    const restoreCachedUser = async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        if (token) {
          const cachedUser = await loadCachedUser();
          if (cachedUser && mounted.current) {
            setUser(cachedUser);
            setLoading(false);
            // Verify in background without changing loading state
            setTimeout(() => checkAuth(), 100);
          } else if (mounted.current) {
            // No cached user but have token - will be verified in checkAuth
            setLoading(false);
            // Verify in background without changing loading state
            setTimeout(() => checkAuth(), 100);
          }
        } else {
          // No token - user needs to sign in
          if (mounted.current) {
            setUser(null);
            setLoading(false);
          }
        }
      } catch (error) {
        // On error, still set loading to false so user can sign in
        if (mounted.current) {
          setUser(null);
          setLoading(false);
        }
      }
    };
    
    restoreCachedUser();
    
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCachedUser(): Promise<User | null> {
    try {
      const cachedUser = await SecureStore.getItemAsync('cached_user');
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }
    } catch (error) {
      // Ignore errors reading cached user
    }
    return null;
  }

  async function saveCachedUser(user: User | null) {
    try {
      if (user) {
        await SecureStore.setItemAsync('cached_user', JSON.stringify(user));
      } else {
        await SecureStore.deleteItemAsync('cached_user');
      }
    } catch (error) {
      // Ignore errors saving cached user
    }
  }

  async function checkAuth() {
    // Prevent multiple simultaneous auth checks
    if (checkingAuth.current) {
      return;
    }
    checkingAuth.current = true;

    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        // No token, user is not authenticated
        if (mounted.current) {
          await saveCachedUser(null);
          setUser(null);
          // Don't change loading state here - it should already be false
        }
        checkingAuth.current = false;
        return;
      }

      // ALWAYS load cached user first for immediate UI update
      // This ensures user stays logged in even during hot reloads
      const cachedUser = await loadCachedUser();
      if (cachedUser && mounted.current) {
        setUser(cachedUser);
        // Don't change loading state - it should already be false
      }

      // Verify token in background (non-blocking)
      // In development, this might fail due to network issues, but we keep the cached user
      try {
        const user = await api.getCurrentUser();
        if (mounted.current) {
          console.log('Auth check: User loaded', { id: user.id, email: user.email, role: user.role });
          await saveCachedUser(user);
          setUser(user);
          // Don't change loading state - it should already be false
        }
      } catch (error: any) {
        // Be very conservative - only clear token on actual invalid token
        // Don't clear on network errors, timeouts, or temporary failures
        if (error.message === 'Unauthorized' || error.message?.includes('401')) {
          // Check if this is a real auth failure or just a network issue
          // Only clear token if we got a proper 401 response with error message
          console.log('Auth check: Received unauthorized, but keeping cached user for now');
          // Don't clear user immediately - might be a temporary issue
          // Don't change loading state
        } else {
          // Any other error (network, timeout, etc.) - KEEP the cached user
          // This is especially important during development hot reloads
          console.log('Auth check: Error (keeping cached user):', error?.message);
          // Don't clear user - keep using cached user
          // Don't change loading state
        }
      }
    } catch (error: any) {
      // Error accessing SecureStore - try to use cached user if available
      console.log('Error checking auth:', error?.message || 'Unknown error');
      const cachedUser = await loadCachedUser();
      if (mounted.current) {
        if (cachedUser) {
          // If we have cached user, use it even if SecureStore access failed
          setUser(cachedUser);
        } else {
          setUser(null);
        }
        // Don't change loading state - it should already be false
      }
    } finally {
      checkingAuth.current = false;
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { user, token } = await api.signIn(email, password);
      // Save the user immediately from signIn response
      await saveCachedUser(user);
      if (mounted.current) {
        setUser(user);
        setLoading(false); // Ensure loading is false after sign in
      }
      
      // Try to get full user in background (non-blocking)
      try {
        const fullUser = await api.getCurrentUser();
        if (mounted.current) {
          await saveCachedUser(fullUser);
          setUser(fullUser);
        }
      } catch (error) {
        // If getCurrentUser fails, that's okay - we already have the user from signIn
        console.log('Could not fetch full user, using signIn response:', error);
      }
    } catch (error) {
      // Re-throw error so sign-in screen can handle it
      throw error;
    }
  }

  async function signUp(firstName: string, lastName: string, birthday: string, email: string, password: string) {
    const { user, token } = await api.signUp(firstName, lastName, birthday, email, password);
    // Ensure role is included
    const fullUser = await api.getCurrentUser().catch(() => user);
    await saveCachedUser(fullUser);
    if (mounted.current) {
      setUser(fullUser);
    }
  }

  async function signOut() {
    await api.signOut();
    await saveCachedUser(null);
    if (mounted.current) {
      setUser(null);
    }
  }

  async function refreshUser() {
    try {
      const user = await api.getCurrentUser();
      if (mounted.current) {
        await saveCachedUser(user);
        setUser(user);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      // Don't throw - just log the error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

