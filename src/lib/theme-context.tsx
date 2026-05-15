'use client';

import { createContext, useContext } from 'react';
import type { Theme } from '@/types';

interface ThemeCtx {
  resolvedTheme: 'dark' | 'light';
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const ThemeContext = createContext<ThemeCtx>({
  resolvedTheme: 'dark',
  theme: 'dark',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);
