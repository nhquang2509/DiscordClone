import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Channel } from '@/types';

export function useChannels(serverId: string | null) {
  const [channels, setChannels] = useState<Channel[]>([]);

  const fetchChannels = useCallback(async () => {
    if (!serverId) {
      setChannels([]);
      return;
    }
    const { data } = await supabase
      .from('channels')
      .select('id, name, type')
      .eq('server_id', serverId)
      .order('created_at', { ascending: true });
    setChannels((data as Channel[]) ?? []);
  }, [serverId]);

  useEffect(() => {
    fetchChannels();
    if (!serverId) return;

    const realtimeChannel = supabase
      .channel(`channels-${serverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `server_id=eq.${serverId}`,
        },
        fetchChannels,
      )
      .subscribe();

    return () => { supabase.removeChannel(realtimeChannel); };
  }, [serverId, fetchChannels]);

  const createChannel = async (name: string, type: Channel['type']): Promise<Channel | null> => {
    if (!serverId) return null;
    const { data, error } = await supabase
      .from('channels')
      .insert({ server_id: serverId, name, type })
      .select('id, name, type')
      .single();
    if (error || !data) return null;
    // Realtime sẽ tự cập nhật cho các client khác;
    // cập nhật local ngay để UX mượt cho người tạo
    const channel = data as Channel;
    setChannels(prev =>
      prev.some(c => c.id === channel.id) ? prev : [...prev, channel]
    );
    return channel;
  };

  const deleteChannel = async (channelId: string) => {
    await supabase.from('channels').delete().eq('id', channelId);
    setChannels(prev => prev.filter(c => c.id !== channelId));
  };

  const renameChannel = async (channelId: string, name: string) => {
    await supabase.from('channels').update({ name }).eq('id', channelId);
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, name } : c));
  };

  return { channels, createChannel, deleteChannel, renameChannel };
}
