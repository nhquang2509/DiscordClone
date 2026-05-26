'use client';

import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChannels } from '@/hooks/useChannels';
import { useServerMembers } from '@/hooks/useServerMembers';
import { useDmInvitations } from '@/hooks/useDmInvitations';
import { useUnreadChannels } from '@/hooks/useUnreadChannels';
import { useDiscord } from '@/lib/discord-context';
import type { Channel } from '@/types';
import type { MemberRole, ServerMember, ServerNotification } from '@/hooks/useServerMembers';
import type { DmChannelInfo, DmInvitation } from '@/hooks/useDmInvitations';

interface ServerContextType {
  channels: Channel[];
  members: ServerMember[];
  myRole: MemberRole;
  dmChannelMap: Record<string, DmChannelInfo>;
  pendingInvitations: DmInvitation[];
  unreadChannelIds: Set<string>;
  serverNotifications: ServerNotification[];
  clearServerNotifications: () => void;
  isManageMembersOpen: boolean;
  manageMembersReadOnly: boolean;
  isServerSettingsOpen: boolean;
  setIsManageMembersOpen: (v: boolean) => void;
  setManageMembersReadOnly: (v: boolean) => void;
  setIsServerSettingsOpen: (v: boolean) => void;
  setMemberRole: (userId: string, role: MemberRole) => Promise<void>;
  kickMember: (userId: string) => Promise<void>;
  createChannel: (name: string, type: Channel['type']) => Promise<Channel | null>;
  deleteChannel: (channelId: string) => Promise<void>;
  renameChannel: (channelId: string, newName: string) => Promise<void>;
  createDmChannel: (params: {
    serverId: string;
    inviterId: string;
    inviterName: string;
    inviteeId: string;
    inviteeName: string;
  }) => Promise<string | null>;
  acceptInvitation: (invitationId: string) => Promise<string | null>;
  onCreateDm: (member: ServerMember) => Promise<void>;
}

const ServerContext = createContext<ServerContextType | null>(null);

export function ServerProvider({
  serverId,
  currentChannelId,
  children,
}: {
  serverId: string;
  currentChannelId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, displayName } = useDiscord();
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [manageMembersReadOnly, setManageMembersReadOnly] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);

  const {
    channels,
    createChannel: _createChannel,
    deleteChannel: _deleteChannel,
    renameChannel,
  } = useChannels(serverId);

  const { members, myRole, setMemberRole, kickMember, serverNotifications, clearServerNotifications } =
    useServerMembers(serverId, user?.id ?? null);

  const { dmChannelMap, pendingInvitations, createDmChannel, acceptInvitation: _acceptInvitation } =
    useDmInvitations(serverId, user?.id ?? null);

  const { unreadChannelIds } = useUnreadChannels(channels, currentChannelId, user?.id ?? null);

  const createChannel = async (name: string, type: Channel['type']) => {
    const channel = await _createChannel(name, type);
    if (channel) {
      router.push(`/channels/${serverId}/${channel.id}`);
    }
    return channel;
  };

  const deleteChannel = async (channelId: string) => {
    const remaining = channels.filter((c) => c.id !== channelId);
    await _deleteChannel(channelId);
    if (currentChannelId === channelId) {
      if (remaining.length > 0) {
        router.push(`/channels/${serverId}/${remaining[0].id}`);
      } else {
        router.push(`/channels/${serverId}`);
      }
    }
  };

  const acceptInvitation = async (invitationId: string) => {
    const channelId = await _acceptInvitation(invitationId);
    if (channelId) {
      router.push(`/channels/${serverId}/${channelId}`);
    }
    return channelId;
  };

  const onCreateDm = async (member: ServerMember) => {
    if (!user) return;
    const channelId = await createDmChannel({
      serverId,
      inviterId: user.id,
      inviterName: displayName,
      inviteeId: member.userId,
      inviteeName: member.username,
    });
    if (channelId) {
      router.push(`/channels/${serverId}/${channelId}`);
    }
  };

  return (
    <ServerContext.Provider
      value={{
        channels,
        members,
        myRole,
        dmChannelMap,
        pendingInvitations,
        unreadChannelIds,
        serverNotifications,
        clearServerNotifications,
        isManageMembersOpen,
        manageMembersReadOnly,
        isServerSettingsOpen,
        setIsManageMembersOpen,
        setManageMembersReadOnly,
        setIsServerSettingsOpen,
        setMemberRole,
        kickMember,
        createChannel,
        deleteChannel,
        renameChannel,
        createDmChannel,
        acceptInvitation,
        onCreateDm,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServerContext() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServerContext must be used within ServerProvider');
  return ctx;
}
