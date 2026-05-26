import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Channel } from '@/types';

/**
 * Tracks which channels have unread messages for the current user.
 * A channel is considered "unread" when a new message arrives in it
 * while the user is viewing a different channel.
 * The unread state is session-only (resets on page reload).
 */
export function useUnreadChannels(
  channels: Channel[],
  selectedChannelId: string | null,
  currentUserId: string | null,
) {
  const [unreadChannelIds, setUnreadChannelIds] = useState<Set<string>>(new Set());

  // Keep a ref so the realtime callback always has the latest selectedChannelId
  const selectedChannelIdRef = useRef(selectedChannelId);
  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
    // Mark the newly selected channel as read
    if (selectedChannelId) {
      setUnreadChannelIds(prev => {
        if (!prev.has(selectedChannelId)) return prev;
        const next = new Set(prev);
        next.delete(selectedChannelId);
        return next;
      });
    }
  }, [selectedChannelId]);

  useEffect(() => {
    if (!channels.length || !currentUserId) return;

    const channelIdSet = new Set(channels.map(c => c.id));

    const sub = supabase
      .channel(`unread-tracker-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as { channel_id: string; author_id: string };

          // Only care about channels belonging to the current server
          if (!channelIdSet.has(row.channel_id)) return;
          // Don't mark as unread if it's already the active channel
          if (row.channel_id === selectedChannelIdRef.current) return;
          // Don't mark own messages as unread
          if (row.author_id === currentUserId) return;

          setUnreadChannelIds(prev => {
            if (prev.has(row.channel_id)) return prev;
            const next = new Set(prev);
            next.add(row.channel_id);
            return next;
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [channels, currentUserId]);

  return { unreadChannelIds };
}
