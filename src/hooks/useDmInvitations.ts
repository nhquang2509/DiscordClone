import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface DmInvitation {
  id: string;
  serverId: string;
  channelId: string;
  inviterId: string;
  inviterName: string;
  inviteeId: string;
  inviteeName: string;
  status: 'pending' | 'accepted';
}

export interface DmChannelInfo {
  partnerName: string;
  invitationId: string;
  status: 'pending' | 'accepted';
}

function mapRow(r: Record<string, unknown>): DmInvitation {
  return {
    id: r.id as string,
    serverId: r.server_id as string,
    channelId: r.channel_id as string,
    inviterId: r.inviter_id as string,
    inviterName: r.inviter_name as string,
    inviteeId: r.invitee_id as string,
    inviteeName: r.invitee_name as string,
    status: r.status as 'pending' | 'accepted',
  };
}

export function useDmInvitations(serverId: string | null, currentUserId: string | null) {
  const [allInvitations, setAllInvitations] = useState<DmInvitation[]>([]);

  const fetchInvitations = useCallback(async () => {
    if (!serverId || !currentUserId) {
      setAllInvitations([]);
      return;
    }
    const [{ data: asInviter }, { data: asInvitee }] = await Promise.all([
      supabase
        .from('dm_invitations')
        .select('*')
        .eq('server_id', serverId)
        .eq('inviter_id', currentUserId),
      supabase
        .from('dm_invitations')
        .select('*')
        .eq('server_id', serverId)
        .eq('invitee_id', currentUserId),
    ]);
    const combined = [...(asInviter ?? []), ...(asInvitee ?? [])];
    setAllInvitations(combined.map(r => mapRow(r as Record<string, unknown>)));
  }, [serverId, currentUserId]);

  useEffect(() => {
    fetchInvitations();
    if (!serverId || !currentUserId) return;

    const rt = supabase
      .channel(`dm_invitations_${serverId}_${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_invitations' }, fetchInvitations)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dm_invitations' }, fetchInvitations)
      .subscribe();

    return () => { supabase.removeChannel(rt); };
  }, [serverId, currentUserId, fetchInvitations]);

  // Map channelId → display info for Members section in sidebar
  const dmChannelMap: Record<string, DmChannelInfo> = {};
  for (const inv of allInvitations) {
    const isInviter = inv.inviterId === currentUserId;
    const isInvitee = inv.inviteeId === currentUserId;
    // Inviter sees it immediately; invitee sees it only after accepting
    if (isInviter || (isInvitee && inv.status === 'accepted')) {
      dmChannelMap[inv.channelId] = {
        partnerName: isInviter ? inv.inviteeName : inv.inviterName,
        invitationId: inv.id,
        status: inv.status,
      };
    }
  }

  // Pending invitations where current user is the invitee (drives bell notification)
  const pendingInvitations = allInvitations.filter(
    inv => inv.inviteeId === currentUserId && inv.status === 'pending',
  );

  /**
   * Create a DM channel between two users in the server.
   * Returns the channel ID (new or existing).
   */
  const createDmChannel = async (params: {
    serverId: string;
    inviterId: string;
    inviterName: string;
    inviteeId: string;
    inviteeName: string;
  }): Promise<string | null> => {
    // If a DM already exists between these two users, reuse it
    const existing = allInvitations.find(
      inv =>
        (inv.inviterId === params.inviterId && inv.inviteeId === params.inviteeId) ||
        (inv.inviterId === params.inviteeId && inv.inviteeId === params.inviterId),
    );
    if (existing) return existing.channelId;

    // Create the channel (name = invitee's username, shown to inviter)
    const { data: channel, error: channelErr } = await supabase
      .from('channels')
      .insert({ server_id: params.serverId, name: params.inviteeName, type: 'members' })
      .select('id, name, type')
      .single();

    if (channelErr || !channel) return null;

    // Create invitation record
    const { error: invErr } = await supabase.from('dm_invitations').insert({
      server_id: params.serverId,
      channel_id: channel.id,
      inviter_id: params.inviterId,
      inviter_name: params.inviterName,
      invitee_id: params.inviteeId,
      invitee_name: params.inviteeName,
      status: 'pending',
    });

    if (invErr) {
      await supabase.from('channels').delete().eq('id', channel.id);
      return null;
    }

    return channel.id;
  };

  /**
   * Accept a pending DM invitation.
   * Returns the channel ID to navigate to.
   */
  const acceptInvitation = async (invitationId: string): Promise<string | null> => {
    const inv = allInvitations.find(i => i.id === invitationId);
    if (!inv) return null;

    await supabase.from('dm_invitations').update({ status: 'accepted' }).eq('id', invitationId);
    // Optimistic local update so UI reflects immediately
    setAllInvitations(prev =>
      prev.map(i => (i.id === invitationId ? { ...i, status: 'accepted' as const } : i)),
    );
    return inv.channelId;
  };

  return { dmChannelMap, pendingInvitations, createDmChannel, acceptInvitation };
}
