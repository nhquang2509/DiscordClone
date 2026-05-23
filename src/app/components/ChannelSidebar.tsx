'use client';

import {
  ChevronDown,
  Hash,
  Volume2,
  Video,
  Plus,
  UserPlus,
  Settings,
  Users,
  Trash2,
  UserCircle2,
  Lock,
  Pencil,
  Check,
  X,
  LogOut,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { InvitePeopleModal } from './InvitePeopleModal';
import { CreateChannelModal } from './CreateChannelModal';
import { useTheme } from '@/lib/theme-context';
import type { Channel } from '@/types';
import type { MemberRole } from '../../hooks/useServerMembers';
import type { VoicePresenceUser } from '../../hooks/voiceChannelStore';
import { useVoiceChannelStore } from '../../hooks/voiceChannelStore';

interface ChannelSidebarProps {
  serverName: string;
  channels: Channel[];
  selectedChannelId: string | null;
  onSelectChannel: (id: string) => void;
  onCreateChannel: (name: string, type: Channel['type']) => void;
  onDeleteChannel: (id: string) => void;
  onRenameChannel: (id: string, name: string) => void;
  onDeleteServer: () => void;
  myRole: MemberRole;
  onQuitServer: () => void;
  inviteCode: string | null;
  onGenerateInviteCode: () => Promise<string | null>;
  onManageMembers: () => void;
  onMemberList: () => void;
}

export function ChannelSidebar({
  serverName,
  channels,
  selectedChannelId,
  onSelectChannel,
  onCreateChannel,
  onDeleteChannel,
  onRenameChannel,
  onDeleteServer,
  myRole,
  onQuitServer,
  inviteCode,
  onGenerateInviteCode,
  onManageMembers,
  onMemberList,
}: ChannelSidebarProps) {
  // Local store fed by ActiveCallView — always up-to-date, no Supabase timing issues.
  const mergedVoicePresence = useVoiceChannelStore();

  const { resolvedTheme, theme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [createChannelDefaultType, setCreateChannelDefaultType] = useState<Channel['type']>('text');
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const textChannels = channels.filter(c => c.type === 'text');
  const audioChannels = channels.filter(c => c.type === 'audio');
  const videoChannels = channels.filter(c => c.type === 'video');

  const openCreate = (type: Channel['type']) => {
    setCreateChannelDefaultType(type);
    setIsCreateChannelOpen(true);
    setIsDropdownOpen(false);
  };

  const handleStartEdit = (ch: Channel) => {
    setEditingChannelId(ch.id);
    setEditingName(ch.name);
  };

  const handleSaveEdit = (channelId: string) => {
    if (editingName.trim()) {
      onRenameChannel(channelId, editingName.trim());
    }
    setEditingChannelId(null);
  };

  // Colors
  const sidebarBg = isDark ? 'bg-[#2b2d31]' : 'bg-[#f2f3f5]';
  const headerBorder = isDark ? 'border-[#1e1f22]' : 'border-[#e3e5e8]';
  const textPrimary = isDark ? 'text-white' : 'text-[#2e3338]';
  const textMuted = isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]';
  const hoverBg = isDark ? 'hover:bg-[#35363c]' : 'hover:bg-[#e0e1e5]';
  const activeBg = isDark ? 'bg-[#404249]' : 'bg-[#d5d7db]';
  const dropdownBg = isDark ? 'bg-[#111214]' : 'bg-white';
  const dropdownBorder = isDark ? '' : 'border border-[#e3e5e8]';
  const inputBg = isDark ? 'bg-[#1e1f22] text-[#949ba4] placeholder:text-[#949ba4]' : 'bg-[#e3e5e8] text-[#4f5660] placeholder:text-[#747f8d]';
  const editInputBorder = isDark ? 'border-white text-white' : 'border-[#2e3338] text-[#2e3338]';
  const hoverText = isDark ? 'hover:text-white' : 'hover:text-[#2e3338]';
  const channelHoverText = isDark ? 'hover:text-[#dbdee1]' : 'hover:text-[#1e1f22]';

  const renderSection = (
    sectionChannels: Channel[],
    type: Channel['type'],
    label: string,
    Icon: React.ElementType
  ) => (
    <div className="mt-4">
      <div className={`px-2 mb-1 flex items-center justify-between group`}>
        <span className={`${textMuted} text-xs font-semibold uppercase tracking-wide`}>{label}</span>
        {myRole !== 'guest' && (
          <button
            onClick={() => openCreate(type)}
            className={`${textMuted} ${hoverText} opacity-0 group-hover:opacity-100 transition-opacity`}
            title={`Create ${label}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {sectionChannels.map(channel => {
        const isActive = channel.id === selectedChannelId;
        const isGeneral = channel.name === 'general' && channel.type === 'text';
        const isEditing = editingChannelId === channel.id;
        const channelUsers = mergedVoicePresence[channel.id] ?? [];

        return (
          <div key={channel.id}>
            <div
              onClick={() => !isEditing && onSelectChannel(channel.id)}
              className={`px-2 py-1.5 mx-2 rounded flex items-center gap-1.5 cursor-pointer group/ch ${
                isActive
                  ? `${activeBg} ${textPrimary}`
                  : `${textMuted} ${hoverBg} ${channelHoverText}`
              }`}
            >
            <Icon className="w-5 h-5 flex-shrink-0" />

            {isEditing ? (
              <div
                className="flex-1 flex items-center gap-1"
                onClick={e => e.stopPropagation()}
              >
                <input
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEdit(channel.id);
                    if (e.key === 'Escape') setEditingChannelId(null);
                  }}
                  className={`flex-1 bg-transparent border-b ${editInputBorder} outline-none text-[15px]`}
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(channel.id)}
                  className="text-green-400 hover:text-green-300"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingChannelId(null)}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-[15px] font-medium flex-1 truncate">{channel.name}</span>
                <div className="flex items-center gap-1">
                  {isGeneral ? (
                    <Lock className={`w-3.5 h-3.5 ${textMuted} flex-shrink-0`} />
                  ) : myRole !== 'guest' ? (
                    <div className="flex items-center gap-1 opacity-0 group-hover/ch:opacity-100 transition-opacity">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleStartEdit(channel);
                        }}
                        className={`p-0.5 rounded ${isDark ? 'hover:bg-[#5a5d68] hover:text-white' : 'hover:bg-[#c5c8cc] hover:text-[#2e3338]'} transition-colors`}
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {myRole === 'admin' && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onDeleteChannel(channel.id);
                          }}
                          className="p-0.5 rounded hover:bg-[#f23f42]/20 hover:text-[#f23f42] transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}
            </div>

            {/* Real-time participant list — voice/video channels only */}
            {channelUsers.length > 0 && (
              <div className="ml-4 mt-0.5 mb-1 space-y-0.5">
                {channelUsers.map(u => (
                  <div
                    key={u.userId}
                    className={`flex items-center gap-2 px-2 py-0.5 mx-2 rounded ${hoverBg}`}
                  >
                    <div
                      className="w-5 h-5 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={`text-xs ${textMuted} truncate`}>{u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`w-60 ${sidebarBg} flex flex-col`}>
      {/* Server header */}
      <div
        className={`h-12 px-4 flex items-center border-b ${headerBorder} shadow-sm relative`}
        ref={dropdownRef}
      >
        <div
          className={`flex items-center gap-1 cursor-pointer ${hoverBg} px-2 py-1 rounded flex-1`}
          onClick={() => setIsDropdownOpen(o => !o)}
        >
          <span className={`${textPrimary} font-semibold text-[15px] flex-1 truncate`}>
            {serverName}
          </span>
          <ChevronDown className={`w-4 h-4 ${textPrimary} flex-shrink-0`} />
        </div>

        {isDropdownOpen && (
          <div
            className={`absolute top-full left-0 right-0 mt-1 mx-2 ${dropdownBg} ${dropdownBorder} rounded-md shadow-lg py-2 z-50`}
          >
            <DropdownItem
              icon={UserPlus}
              label="Invite People"
              onClick={() => {
                setIsInviteOpen(true);
                setIsDropdownOpen(false);
              }}
            />
            {myRole !== 'guest' && (
              <>
                <DropdownItem icon={Settings} label="Server Settings" onClick={() => setIsDropdownOpen(false)} />
                <DropdownItem icon={Users} label="Manage Members" onClick={() => { onManageMembers(); setIsDropdownOpen(false); }} />
                <DropdownItem icon={Plus} label="Create Channel" onClick={() => openCreate('text')} />
              </>
            )}
            {myRole === 'guest' && (
              <DropdownItem icon={Users} label="Member List" onClick={() => { onMemberList(); setIsDropdownOpen(false); }} />
            )}
            <div className={`h-[1px] ${isDark ? 'bg-[#3f4147]' : 'bg-[#e3e5e8]'} my-1`} />
            {myRole === 'admin' ? (
              <button
                onClick={() => {
                  onDeleteServer();
                  setIsDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-[#f23f42] hover:bg-[#f23f42] hover:text-white flex items-center justify-between transition-colors"
              >
                <span className="text-sm">Delete Server</span>
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  onQuitServer();
                  setIsDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-[#f23f42] hover:bg-[#f23f42] hover:text-white flex items-center justify-between transition-colors"
              >
                <span className="text-sm">Quit Server</span>
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="px-2 py-1.5">
          <input
            type="text"
            placeholder="Search"
            className={`${inputBg} text-sm px-2 py-1 rounded w-full outline-none`}
          />
        </div>

        {renderSection(textChannels, 'text', 'Text Channels', Hash)}
        {renderSection(audioChannels, 'audio', 'Voice Channels', Volume2)}
        {renderSection(videoChannels, 'video', 'Video Channels', Video)}

        {channels.length === 0 && (
          <div className={`text-center ${textMuted} text-xs mt-8 px-4 leading-relaxed`}>
            <p>No channels yet.</p>
            <p className="mt-1">Click the server name above → Create Channel.</p>
          </div>
        )}
      </div>

      <InvitePeopleModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        serverName={serverName}
        inviteCode={inviteCode}
        myRole={myRole}
        onGenerateInviteCode={onGenerateInviteCode}
      />
      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        onCreate={onCreateChannel}
        defaultType={createChannelDefaultType}
      />
    </div>
  );
}

function DropdownItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2 text-left text-[#b5bac1] hover:bg-[#5865f2] hover:text-white flex items-center justify-between group transition-colors"
    >
      <span className="text-sm">{label}</span>
      <Icon className="w-4 h-4" />
    </button>
  );
}

function MemberItem({ name, status }: { name: string; status: 'online' | 'offline' }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <div className={`px-2 py-1.5 mx-2 rounded flex items-center gap-2 cursor-pointer group ${isDark ? 'hover:bg-[#35363c]' : 'hover:bg-[#e0e1e5]'}`}>
      <div className="relative">
        <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center">
          <UserCircle2 className="w-6 h-6 text-white" />
        </div>
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${isDark ? 'border-[#2b2d31]' : 'border-[#f2f3f5]'} ${
            status === 'online' ? 'bg-[#23a559]' : 'bg-[#80848e]'
          }`}
        />
      </div>
      <span className={`text-sm font-medium ${isDark ? 'text-[#949ba4] group-hover:text-[#dbdee1]' : 'text-[#5c5f66] group-hover:text-[#1e1f22]'}`}>{name}</span>
    </div>
  );
}
