'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface PinnedMessage {
  id: string;
  messageId: string;
  pinnedByName: string;
  content: string;
  authorName: string;
  createdAt: string;
}

export function usePinnedMessages(
  channelId: string | null,
  currentUserId: string,
  currentUsername: string,
) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);

  const fetchPinned = useCallback(async () => {
    if (!channelId) {
      setPinnedMessages([]);
      return;
    }
    const { data } = await supabase
      .from('pinned_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPinnedMessages((data ?? []).map((row: any) => ({
      id: row.id,
      messageId: row.message_id,
      pinnedByName: row.pinned_by_name,
      content: row.content,
      authorName: row.author_name,
      createdAt: new Date(row.created_at).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    })));
  }, [channelId]);

  useEffect(() => {
    fetchPinned();
    if (!channelId) return;

    const ch = supabase
      .channel(`pinned-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pinned_messages', filter: `channel_id=eq.${channelId}` },
        () => fetchPinned(),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'pinned_messages', filter: `channel_id=eq.${channelId}` },
        () => fetchPinned(),
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [channelId, fetchPinned]);

  const pinMessage = async (
    messageId: string,
    content: string,
    authorName: string,
  ) => {
    if (!channelId) return;

    // Insert (or ignore duplicate) into pinned_messages
    const { error } = await supabase.from('pinned_messages').upsert(
      {
        channel_id: channelId,
        message_id: messageId,
        pinned_by_id: currentUserId,
        pinned_by_name: currentUsername,
        content,
        author_name: authorName,
      },
      { onConflict: 'channel_id,message_id' },
    );
    if (error) return;

    // Send an automated system message to the channel
    await supabase.from('messages').insert({
      channel_id: channelId,
      author_id: currentUserId,
      author_name: currentUsername,
      author_color: '#5865f2',
      content: `${currentUsername} pinned a message.`,
      is_system: true,
    });
  };

  return { pinnedMessages, pinMessage };
}
