import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Server } from '@/types';

export function useServers(user: User | null) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setServers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchServers() {
      // Lấy tất cả server mà user là member
      const { data: memberships } = await supabase
        .from('server_members')
        .select('server_id')
        .eq('user_id', user!.id);

      if (cancelled) return;

      if (!memberships?.length) {
        setServers([]);
        setLoading(false);
        return;
      }

      const serverIds = memberships.map(m => m.server_id);
      const { data } = await supabase
        .from('servers')
        .select('id, name, image, invite_code')
        .in('id', serverIds)
        .order('created_at', { ascending: true });

      if (!cancelled) {
        setServers((data as Server[]) ?? []);
        setLoading(false);
      }
    }
    fetchServers();
    return () => { cancelled = true; };
  }, [user]);

  const createServer = async (name: string, image: string | null): Promise<Server | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('servers')
      .insert({ name, image, owner_id: user.id })
      .select('id, name, image, invite_code')
      .single();
    if (error || !data) return null;
    const server = data as Server;
    setServers(prev => [...prev, server]);
    return server;
  };

  const deleteServer = async (serverId: string) => {
    await supabase.from('servers').delete().eq('id', serverId);
    setServers(prev => prev.filter(s => s.id !== serverId));
  };

  const generateInviteCode = async (serverId: string): Promise<string | null> => {
    const newCode = crypto.randomUUID();
    const { error } = await supabase
      .from('servers')
      .update({ invite_code: newCode })
      .eq('id', serverId);
    if (!error) {
      setServers(prev =>
        prev.map(s => s.id === serverId ? { ...s, invite_code: newCode } : s)
      );
      return newCode;
    }
    return null;
  };

  const joinServerByInvite = async (inviteCode: string): Promise<Server | null> => {
    if (!user) return null;
    const { data: serverData, error } = await supabase
      .from('servers')
      .select('id, name, image, invite_code')
      .eq('invite_code', inviteCode)
      .single();
    if (error || !serverData) return null;
    const server = serverData as Server;

    // Kiểm tra xem đã là member chưa
    const { data: existing } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', server.id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      const displayName =
        user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'User';
      await supabase.from('server_members').insert({
        server_id: server.id,
        user_id: user.id,
        username: displayName,
        role: 'guest',
      });

      // Insert system message "X has joined the server" into all text channels
      const { data: channelData } = await supabase
        .from('channels')
        .select('id')
        .eq('server_id', server.id)
        .eq('type', 'text');
      if (channelData && channelData.length > 0) {
        await supabase.from('messages').insert(
          channelData.map(ch => ({
            channel_id: ch.id,
            author_id: user.id,
            author_name: displayName,
            author_color: '#5865f2',
            content: `${displayName} has joined the server`,
            is_system: true,
          }))
        );
      }
    }

    setServers(prev =>
      prev.find(s => s.id === server.id) ? prev : [...prev, server]
    );
    return server;
  };

  const quitServer = async (serverId: string, userId: string) => {
    // Insert system message to all text channels before deleting membership
    const displayName =
      user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'User';
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
          author_name: displayName,
          author_color: '#ed4245',
          content: `${displayName} has left the server`,
          is_system: true,
        }))
      );
    }
    await supabase
      .from('server_members')
      .delete()
      .eq('server_id', serverId)
      .eq('user_id', userId);
    setServers(prev => prev.filter(s => s.id !== serverId));
  };

  return {
    servers,
    loading,
    createServer,
    deleteServer,
    generateInviteCode,
    joinServerByInvite,
    quitServer,
  };
}
