import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { setThemeMode } from '../constants/colors';

type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeType;
  isDark: boolean;
  setTheme: (newTheme: ThemeType) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>('light');

  // Load theme preference on mount or user change
  useEffect(() => {
    async function loadThemePreference() {
      // 1. Try local storage first to avoid flashes
      let savedTheme: ThemeType | null = null;
      try {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          savedTheme = localStorage.getItem('ysnap-theme') as ThemeType;
        }
      } catch (e) {
        console.warn('Failed to load local theme preference', e);
      }

      if (savedTheme) {
        setThemeState(savedTheme);
        setThemeMode(resolveIsDark(savedTheme, systemScheme) ? 'dark' : 'light');
      }

      // 2. Fetch from Supabase user_preferences if authenticated
      if (user?.id) {
        try {
          const { data, error } = await (supabase as any)
            .from('user_preferences')
            .select('theme')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!error && data?.theme) {
            const dbTheme = data.theme as ThemeType;
            setThemeState(dbTheme);
            setThemeMode(resolveIsDark(dbTheme, systemScheme) ? 'dark' : 'light');
            
            // Sync to local storage
            if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
              localStorage.setItem('ysnap-theme', dbTheme);
            }
          }
        } catch (err) {
          console.warn('Failed to sync theme preference from db', err);
        }
      }
    }

    loadThemePreference();
  }, [user?.id]);

  // Handle system scheme changes dynamically when theme is set to 'system'
  useEffect(() => {
    if (theme === 'system') {
      setThemeMode(systemScheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemScheme, theme]);

  const isDark = resolveIsDark(theme, systemScheme);

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    const darkResolved = resolveIsDark(newTheme, systemScheme);
    setThemeMode(darkResolved ? 'dark' : 'light');

    // Save to local storage for immediate persistence
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem('ysnap-theme', newTheme);
      }
    } catch (e) {
      console.warn('Failed to save theme to local storage', e);
    }

    // Save to Supabase preferences if online and authenticated
    if (user?.id) {
      try {
        await (supabase as any)
          .from('user_preferences')
          .update({ theme: newTheme })
          .eq('user_id', user.id);
      } catch (err) {
        console.warn('Failed to save theme preference to db', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function resolveIsDark(mode: ThemeType, systemScheme: any): boolean {
  if (mode === 'system') {
    return systemScheme === 'dark';
  }
  return mode === 'dark';
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeStyles<T>(createStyles: (colors: any) => T): T {
  const { isDark } = useTheme();
  return React.useMemo(() => createStyles(colors), [isDark]);
}
