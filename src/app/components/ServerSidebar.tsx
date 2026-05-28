'use client';

import { Building2, Plus, Moon, Sun, LogOut, Check, User as UserIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreateServerModal } from './CreateServerModal';
import { useTheme } from '@/lib/theme-context';
import type { Server, Theme } from '@/types';
import type { User } from '@supabase/supabase-js';

interface ServerSidebarProps {
  servers: Server[];
  selectedServerId: string | null;
  onSelectServer: (id: string) => void;
  onCreateServer: (name: string, image: string | null) => void;
  user: User | null;
  onSignOut: () => void;
}

export function ServerSidebar({
  servers,
  selectedServerId,
  onSelectServer,
  onCreateServer,
  user,
  onSignOut,
}: ServerSidebarProps) {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  const displayName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'User';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sidebarBg = isDark ? 'bg-[#1e1f22]' : 'bg-[#e3e5e8]';
  const btnInactive = isDark ? 'bg-[#313338] hover:bg-[#5865f2]' : 'bg-[#d4d7dc] hover:bg-[#5865f2]';
  const divider = isDark ? 'bg-[#35363c]' : 'bg-[#b8bcc2]';
  const textMuted = isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]';
  const textPrimary = isDark ? 'text-white' : 'text-[#2e3338]';
  const hoverBg = isDark ? 'hover:bg-[#35363c]' : 'hover:bg-[#e0e1e5]';
  const dropdownBg = isDark ? 'bg-[#111214]' : 'bg-white';
  const dropdownBorder = isDark ? '' : 'border border-[#e3e5e8]';

  const THEMES: { label: string; value: Theme }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  return (
    <>
      <div className={`w-[72px] ${sidebarBg} flex flex-col items-center py-3 gap-2`}>
        {servers.map(server => (
          <button
            key={server.id}
            onClick={() => onSelectServer(server.id)}
            className={`w-12 h-12 rounded-[24px] flex items-center justify-center hover:rounded-[16px] transition-all duration-200 group relative overflow-hidden ${
              selectedServerId === server.id
                ? 'bg-[#5865f2] rounded-[16px]'
                : btnInactive
            }`}
          >
            {server.image ? (
              <img
                src={server.image}
                alt={server.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-white font-semibold text-lg">
                {server.id === 'default' ? (
                  <Building2 className="w-6 h-6" />
                ) : (
                  server.name.charAt(0).toUpperCase()
                )}
              </div>
            )}
            <div
              className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
                selectedServerId === server.id ? 'h-10' : 'h-0 group-hover:h-5'
              }`}
            />
          </button>
        ))}

        <div className={`w-8 h-[2px] ${divider} rounded-full`} />

        <button
          onClick={() => user ? setIsModalOpen(true) : router.push('/auth')}
          className={`w-12 h-12 rounded-[24px] ${btnInactive} flex items-center justify-center hover:rounded-[16px] transition-all duration-200 group`}
          title={user ? 'Create a server' : 'Login to create a server'}
        >
          <Plus className="w-6 h-6 text-[#23a559] group-hover:text-white transition-colors duration-200" />
        </button>

        <div className="flex-1" />

        <div className={`w-8 h-[2px] ${divider} rounded-full`} />

        {/* Theme toggle */}
        <div ref={themeRef} className="relative">
          <button
            onClick={() => setIsThemeOpen(o => !o)}
            className={`w-12 h-12 rounded-[24px] ${btnInactive} flex items-center justify-center hover:rounded-[16px] transition-all duration-200 ${textMuted}`}
            title="Toggle theme"
          >
            {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {isThemeOpen && (
            <div
              className={`absolute bottom-0 left-full ml-3 ${dropdownBg} ${dropdownBorder} rounded-md shadow-lg py-1 z-50 min-w-[130px]`}
            >
              {THEMES.map(t => (
                <button
                  key={t.value}
                  onClick={() => {
                    setTheme(t.value);
                    setIsThemeOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${hoverBg} transition-colors ${
                    theme === t.value ? textPrimary : textMuted
                  }`}
                >
                  <span>{t.label}</span>
                  {theme === t.value && <Check className="w-3.5 h-3.5 text-[#5865f2]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User avatar / Login button */}
        {user ? (
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setIsUserMenuOpen(o => !o)}
              className="w-12 h-12 rounded-full bg-[#5865f2] flex items-center justify-center text-white font-semibold text-base hover:rounded-[16px] transition-all duration-200"
              title={displayName}
            >
              {avatarInitial}
            </button>

            {isUserMenuOpen && (
              <div
                className={`absolute bottom-0 left-full ml-3 ${dropdownBg} ${dropdownBorder} rounded-md shadow-lg py-1 z-50 min-w-[200px]`}
              >
                <div className={`px-3 py-2 border-b ${isDark ? 'border-[#3f4147]' : 'border-[#e3e5e8]'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${textMuted}`}>Logged in as</p>
                  <p className={`text-sm font-semibold ${textPrimary} truncate mt-0.5`}>{displayName}</p>
                  <p className={`text-xs ${textMuted} truncate`}>{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full px-3 py-2 text-left text-[#f23f42] hover:bg-[#f23f42] hover:text-white flex items-center justify-between transition-colors"
                >
                  <span className="text-sm">Sign out</span>
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => router.push('/auth')}
            className={`w-12 h-12 rounded-[24px] ${btnInactive} flex items-center justify-center hover:rounded-[16px] transition-all duration-200 group`}
            title="Login"
          >
            <UserIcon className="w-5 h-5 text-[#23a559] group-hover:text-white transition-colors duration-200" />
          </button>
        )}
      </div>

      <CreateServerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateServer={(name, image) => {
          onCreateServer(name, image);
          setIsModalOpen(false);
        }}
      />
    </>
  );
}
