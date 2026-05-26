'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useServers } from '@/hooks/useServers';
import { supabase } from '@/lib/supabase/client';
import { ThemeContext } from '@/lib/theme-context';
import type { Server, Theme } from '@/types';
import type { User } from '@supabase/supabase-js';

interface DiscordContextType {
  user: User | null;
  authLoading: boolean;
  servers: Server[];
  serversLoading: boolean;
  displayName: string;
  signOut: () => Promise<void>;
  createServer: (name: string, image: string | null) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  generateInviteCode: (serverId: string) => Promise<string | null>;
  joinServerByInvite: (code: string) => Promise<Server | null>;
  quitServer: (serverId: string) => Promise<void>;
  updateServer: (id: string, name: string, image: string | null) => Promise<boolean>;
}

const DiscordContext = createContext<DiscordContextType | null>(null);

function DiscordProviderInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading, signOut: _signOut } = useAuth();

  const signOut = async () => {
    await _signOut();
    router.push('/auth');
  };
  const [theme, setTheme] = useState<Theme>('dark');
  const {
    servers,
    loading: serversLoading,
    createServer: _createServer,
    deleteServer: _deleteServer,
    generateInviteCode,
    joinServerByInvite: _joinServerByInvite,
    quitServer: _quitServer,
    updateServer,
  } = useServers(user);

  const displayName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'User';

  const resolvedTheme: 'dark' | 'light' =
    theme === 'system'
      ? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  // Store invite code before redirect
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('invite');
    if (code) {
      sessionStorage.setItem('pendingInvite', code);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Handle invite after login
  useEffect(() => {
    if (!user) return;
    const code =
      sessionStorage.getItem('pendingInvite') ||
      new URLSearchParams(window.location.search).get('invite');
    if (!code) return;
    sessionStorage.removeItem('pendingInvite');
    window.history.replaceState({}, '', window.location.pathname);
    _joinServerByInvite(code).then((server) => {
      if (server) router.push(`/channels/${server.id}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const createServer = async (name: string, image: string | null) => {
    const server = await _createServer(name, image);
    if (!server) return;
    const { data: generalChannel } = await supabase
      .from('channels')
      .insert({ server_id: server.id, name: 'general', type: 'text' })
      .select('id, name, type')
      .single();
    await supabase
      .from('server_members')
      .insert({ server_id: server.id, user_id: user!.id, username: displayName, role: 'admin' });
    if (generalChannel) {
      router.push(`/channels/${server.id}/${generalChannel.id}`);
    } else {
      router.push(`/channels/${server.id}`);
    }
  };

  const deleteServer = async (serverId: string) => {
    const remaining = servers.filter((s) => s.id !== serverId);
    await _deleteServer(serverId);
    if (remaining.length > 0) {
      router.push(`/channels/${remaining[remaining.length - 1].id}`);
    } else {
      router.push('/channels');
    }
  };

  const quitServer = async (serverId: string) => {
    const remaining = servers.filter((s) => s.id !== serverId);
    await _quitServer(serverId, user!.id);
    if (remaining.length > 0) {
      router.push(`/channels/${remaining[remaining.length - 1].id}`);
    } else {
      router.push('/channels');
    }
  };

  const joinServerByInvite = async (code: string) => {
    return _joinServerByInvite(code);
  };

  return (
    <ThemeContext.Provider value={{ resolvedTheme, theme, setTheme }}>
      <DiscordContext.Provider
        value={{
          user,
          authLoading,
          servers,
          serversLoading,
          displayName,
          signOut,
          createServer,
          deleteServer,
          generateInviteCode,
          joinServerByInvite,
          quitServer,
          updateServer,
        }}
      >
        {children}
      </DiscordContext.Provider>
    </ThemeContext.Provider>
  );
}

export function DiscordProvider({ children }: { children: React.ReactNode }) {
  return <DiscordProviderInner>{children}</DiscordProviderInner>;
}

export function useDiscord() {
  const ctx = useContext(DiscordContext);
  if (!ctx) throw new Error('useDiscord must be used within DiscordProvider');
  return ctx;
}
