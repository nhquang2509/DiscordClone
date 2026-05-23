'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Hash, Volume2, Video, User } from 'lucide-react';
import type { Channel } from '@/types';
import type { ServerMember } from '../../hooks/useServerMembers';
import { useTheme } from '@/lib/theme-context';

interface SearchChannelMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  members: ServerMember[];
  currentUserId: string;
  onSelectChannel: (id: string) => void;
  onSelectMember: (member: ServerMember) => void;
}

export function SearchChannelMemberModal({
  isOpen,
  onClose,
  channels,
  members,
  currentUserId,
  onSelectChannel,
  onSelectMember,
}: SearchChannelMemberModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.toLowerCase();
  const textChannels   = channels.filter(c => c.type === 'text'  && c.name.toLowerCase().includes(q));
  const voiceChannels  = channels.filter(c => c.type === 'audio' && c.name.toLowerCase().includes(q));
  const videoChannels  = channels.filter(c => c.type === 'video' && c.name.toLowerCase().includes(q));
  const filteredMembers = members.filter(
    m => m.userId !== currentUserId && m.username.toLowerCase().includes(q),
  );

  const bgCard     = isDark ? 'bg-[#2b2d31]'  : 'bg-white';
  const border     = isDark ? 'border-[#1e1f22]' : 'border-[#e3e5e8]';
  const textPrimary = isDark ? 'text-white'    : 'text-[#2e3338]';
  const textMuted  = isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]';
  const inputBg    = isDark ? 'bg-[#1e1f22]'  : 'bg-[#f2f3f5]';
  const hoverBg    = isDark ? 'hover:bg-[#35363c]' : 'hover:bg-[#f2f3f5]';

  const hasResults =
    textChannels.length > 0 ||
    voiceChannels.length > 0 ||
    videoChannels.length > 0 ||
    filteredMembers.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40"
      onClick={onClose}
    >
      <div
        className={`${bgCard} rounded-lg shadow-2xl w-[440px] max-h-[70vh] flex flex-col border ${border}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${border}`}>
          <h2 className={`text-sm font-semibold ${textPrimary}`}>
            Search all channels and members
          </h2>
          <button
            onClick={onClose}
            className={`${textMuted} hover:text-white transition-colors`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className={`px-4 py-2 border-b ${border}`}>
          <div className={`flex items-center gap-2 ${inputBg} rounded px-3 py-2`}>
            <Search className={`w-4 h-4 ${textMuted} flex-shrink-0`} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className={`flex-1 bg-transparent outline-none text-sm ${textPrimary}`}
            />
            {query && (
              <button onClick={() => setQuery('')} className={textMuted}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-2">
          {textChannels.length > 0 && (
            <Section label="Text Channels" textMuted={textMuted}>
              {textChannels.map(ch => (
                <ResultItem
                  key={ch.id}
                  icon={Hash}
                  label={ch.name}
                  onClick={() => { onSelectChannel(ch.id); onClose(); }}
                  hoverBg={hoverBg}
                  textPrimary={textPrimary}
                  textMuted={textMuted}
                />
              ))}
            </Section>
          )}

          {voiceChannels.length > 0 && (
            <Section label="Voice Channels" textMuted={textMuted}>
              {voiceChannels.map(ch => (
                <ResultItem
                  key={ch.id}
                  icon={Volume2}
                  label={ch.name}
                  onClick={() => { onSelectChannel(ch.id); onClose(); }}
                  hoverBg={hoverBg}
                  textPrimary={textPrimary}
                  textMuted={textMuted}
                />
              ))}
            </Section>
          )}

          {videoChannels.length > 0 && (
            <Section label="Video Channels" textMuted={textMuted}>
              {videoChannels.map(ch => (
                <ResultItem
                  key={ch.id}
                  icon={Video}
                  label={ch.name}
                  onClick={() => { onSelectChannel(ch.id); onClose(); }}
                  hoverBg={hoverBg}
                  textPrimary={textPrimary}
                  textMuted={textMuted}
                />
              ))}
            </Section>
          )}

          {filteredMembers.length > 0 && (
            <Section label="Members" textMuted={textMuted}>
              {filteredMembers.map(m => (
                <ResultItem
                  key={m.userId}
                  icon={User}
                  label={m.username}
                  subtitle={m.role}
                  onClick={() => { onSelectMember(m); onClose(); }}
                  hoverBg={hoverBg}
                  textPrimary={textPrimary}
                  textMuted={textMuted}
                />
              ))}
            </Section>
          )}

          {!hasResults && (
            <p className={`text-center text-sm ${textMuted} py-8`}>
              {query ? 'No results found' : 'Start typing to search...'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
  textMuted,
}: {
  label: string;
  children: React.ReactNode;
  textMuted: string;
}) {
  return (
    <div className="mb-1">
      <p className={`text-xs font-semibold uppercase tracking-wide ${textMuted} px-4 py-1.5`}>
        {label}
      </p>
      {children}
    </div>
  );
}

function ResultItem({
  icon: Icon,
  label,
  subtitle,
  onClick,
  hoverBg,
  textPrimary,
  textMuted,
}: {
  icon: React.ElementType;
  label: string;
  subtitle?: string;
  onClick: () => void;
  hoverBg: string;
  textPrimary: string;
  textMuted: string;
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2 ${hoverBg} transition-colors text-left`}
      onClick={onClick}
    >
      <Icon className={`w-4 h-4 ${textMuted} flex-shrink-0`} />
      <span className={`text-sm ${textPrimary} flex-1 truncate`}>{label}</span>
      {subtitle && (
        <span className={`text-xs ${textMuted} capitalize`}>{subtitle}</span>
      )}
    </button>
  );
}
