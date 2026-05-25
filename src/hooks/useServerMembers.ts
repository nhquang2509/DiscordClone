import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export type MemberRole = 'admin' | 'moderator' | 'guest';

export interface ServerNotification {
  id: string;
  username: string;
  type: 'join' | 'leave';
  time: string;
}

export interface ServerMember {
  userId: string;
  username: string;
  role: MemberRole;
}

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  guest: 'Guest',
};

export function useServerMembers(serverId: string | null, currentUserId: string | null) {
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [myRole, setMyRole] = useState<MemberRole>('guest');
  const [serverNotifications, setServerNotifications] = useState<ServerNotification[]>([]);
  // Prevent double-notification if both realtime and polling fire
  const notifiedRef = useRef(false);

  const clearServerNotifications = useCallback(() => setServerNotifications([]), []);

  useEffect(() => {
    if (!serverId || !currentUserId) {
      setMembers([]);
      setMyRole('guest');
      setServerNotifications([]);
      return;
    }

    notifiedRef.current = false;

    // knownRole tracks the role at load time so polling can detect changes
    let knownRole: MemberRole | null = null;

    const notifyRoleChange = (newRole: MemberRole) => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
      setMyRole(newRole);
      setMembers(prev =>
        prev.map(m => (m.userId === currentUserId ? { ...m, role: newRole } : m))
      );
      toast.info(`Your role has been updated to ${ROLE_LABEL[newRole]}`, {
        description: 'Reloading in 5 seconds to apply changes...',
        duration: 5000,
      });
      setTimeout(() => window.location.reload(), 5000);
    };

    // Initial fetch
    supabase
      .from('server_members')
      .select('user_id, username, role')
      .eq('server_id', serverId)
      .then(({ data }) => {
        if (data) {
          const mapped: ServerMember[] = data.map(r => ({
            userId: r.user_id,
            username: r.username ?? 'Unknown',
            role: r.role as MemberRole,
          }));
          setMembers(mapped);
          const me = mapped.find(m => m.userId === currentUserId);
          knownRole = me?.role ?? 'guest';
          setMyRole(knownRole);
        }
      });

    // Realtime: fires instantly when Supabase Realtime is enabled on the table
    const rt = supabase
      .channel(`server_members_rt_${serverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'server_members',
          filter: `server_id=eq.${serverId}`,
        },
        (payload) => {
          const added = payload.new as { user_id: string; role: string; username: string };
          const newMember: ServerMember = {
            userId: added.user_id,
            username: added.username ?? 'Unknown',
            role: added.role as MemberRole,
          };
          // Update member list for all existing members
          setMembers(prev =>
            prev.find(m => m.userId === added.user_id) ? prev : [...prev, newMember]
          );
          // Show join notification to everyone except the joining user
          if (added.user_id !== currentUserId) {
            setServerNotifications(prev => [
              { id: crypto.randomUUID(), username: added.username ?? 'Unknown', type: 'join', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
              ...prev,
            ]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'server_members',
          filter: `server_id=eq.${serverId}`,
        },
        (payload) => {
          const removed = payload.old as { user_id: string; username?: string };
          // Remove from member list
          setMembers(prev => prev.filter(m => m.userId !== removed.user_id));
          // Show leave notification to remaining members
          if (removed.user_id !== currentUserId) {
            setServerNotifications(prev => [
              { id: crypto.randomUUID(), username: removed.username ?? 'Unknown', type: 'leave', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
              ...prev,
            ]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'server_members',
          filter: `server_id=eq.${serverId}`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; role: string; username: string };
          const newRole = updated.role as MemberRole;
          // Always update the member list for admin/moderator views
          setMembers(prev =>
            prev.map(m =>
              m.userId === updated.user_id ? { ...m, role: newRole } : m
            )
          );
          if (updated.user_id === currentUserId) {
            notifyRoleChange(newRole);
          }
        }
      )
      .subscribe();

    // Polling fallback: works even without Supabase Realtime configured
    // Checks every 7 seconds whether the current user's role changed
    const pollInterval = setInterval(async () => {
      if (notifiedRef.current || knownRole === null) return;
      const { data } = await supabase
        .from('server_members')
        .select('role')
        .eq('server_id', serverId)
        .eq('user_id', currentUserId)
        .single();
      if (data && (data.role as MemberRole) !== knownRole) {
        notifyRoleChange(data.role as MemberRole);
      }
    }, 7000);

    return () => {
      supabase.removeChannel(rt);
      clearInterval(pollInterval);
    };
  }, [serverId, currentUserId]);

  const setMemberRole = async (userId: string, role: MemberRole) => {
    if (!serverId) return;
    const { error } = await supabase
      .from('server_members')
      .update({ role })
      .eq('server_id', serverId)
      .eq('user_id', userId);
    if (!error) {
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role } : m));
      if (userId === currentUserId) setMyRole(role);
    }
  };

  const kickMember = async (userId: string) => {
    if (!serverId) return;
    const kicked = members.find(m => m.userId === userId);
    const kickedName = kicked?.username ?? 'Unknown';
    // Insert system message to all text channels
    const { data: channelData } = await supabase
      .from('channels')
      .select('id')
      .eq('server_id', serverId)
      .eq('type', 'text');
    if (channelData && channelData.length > 0) {
      await supabase.from('messages').insert(
        channelData.map(ch => ({
          channel_id: ch.id,
          author_id: userId,
          author_name: kickedName,
          author_color: '#ed4245',
          content: `${kickedName} has left the server`,
          is_system: true,
        }))
      );
    }
    await supabase
      .from('server_members')
      .delete()
      .eq('server_id', serverId)
      .eq('user_id', userId);
    setMembers(prev => prev.filter(m => m.userId !== userId));
  };

  return { members, myRole, setMemberRole, kickMember, serverNotifications, clearServerNotifications };
}
