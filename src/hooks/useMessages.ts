import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Message, FileAttachment } from '@/types';

const PAGE_SIZE = 20;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Message {
  const files: FileAttachment[] = (row.file_attachments ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    fileType: f.file_type as 'image' | 'pdf',
    url: f.url,
  }));
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: (row.author_name as string).charAt(0).toUpperCase(),
    authorColor: row.author_color,
    timestamp: formatTimestamp(row.created_at),
    content: row.content,
    deleted: row.deleted,
    edited: row.edited,
    isSystem: row.is_system ?? false,
    files,
  };
}

export function useMessages(channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Cursor: created_at of the oldest message currently loaded (for pagination)
  const oldestCreatedAtRef = useRef<string | null>(null);
  // Guard against concurrent loadMore calls
  const isLoadingMoreRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (!channelId) {
      setMessages([]);
      setHasMore(false);
      oldestCreatedAtRef.current = null;
      return;
    }
    // Fetch most recent PAGE_SIZE messages (DESC so newest first, then reverse for display)
    const { data } = await supabase
      .from('messages')
      .select('*, file_attachments(*)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    const rows = (data ?? []).map(mapRow).reverse();
    setMessages(rows);
    // data[data.length - 1] is the oldest when sorted DESC
    oldestCreatedAtRef.current = (data && data.length > 0) ? data[data.length - 1].created_at : null;
    setHasMore((data ?? []).length === PAGE_SIZE);
  }, [channelId]);

  // Load the next (older) page of messages
  const loadMore = useCallback(async () => {
    if (!channelId || !oldestCreatedAtRef.current || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const cursor = oldestCreatedAtRef.current;
    const { data } = await supabase
      .from('messages')
      .select('*, file_attachments(*)')
      .eq('channel_id', channelId)
      .lt('created_at', cursor)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    const rows = (data ?? []).map(mapRow).reverse(); // oldest first
    if (rows.length > 0) {
      oldestCreatedAtRef.current = data![data!.length - 1].created_at;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newRows = rows.filter(m => !existingIds.has(m.id));
        return [...newRows, ...prev];
      });
    }
    setHasMore((data ?? []).length === PAGE_SIZE);
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
    if (!channelId) return;

    const realtimeChannel = supabase
      .channel(`messages-${channelId}`)
      // New message: fetch it (with attachments) and append
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select('*, file_attachments(*)')
            .eq('id', (payload.new as { id: string }).id)
            .single();
          if (data) setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, mapRow(data)];
          });
        },
      )
      // Edit / soft-delete: update in place
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const row = payload.new as { id: string; content: string; deleted: boolean; edited: boolean };
          setMessages(prev =>
            prev.map(m =>
              m.id === row.id
                ? { ...m, content: row.content, deleted: row.deleted, edited: row.edited }
                : m,
            ),
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(realtimeChannel); };
  }, [channelId, fetchMessages]);

  const sendMessage = async (
    authorId: string,
    authorName: string,
    authorColor: string,
    content: string,
    files: FileAttachment[],
  ): Promise<boolean> => {
    if (!channelId) return false;
    const { data, error } = await supabase
      .from('messages')
      .insert({ channel_id: channelId, author_id: authorId, author_name: authorName, author_color: authorColor, content })
      .select()
      .single();
    if (error) return false;
    if (data && files.length > 0) {
      const { error: fileError } = await supabase.from('file_attachments').insert(
        files.map(f => ({ message_id: data.id, name: f.name, file_type: f.fileType, url: f.url })),
      );
      if (fileError) return false;
      // Reload to get the message with its attachments properly
      fetchMessages();
    }
    // Text-only messages are handled by the realtime INSERT handler
    return true;
  };

  const deleteMessage = async (messageId: string) => {
    await supabase.from('messages').update({ deleted: true }).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted: true } : m));
  };

  const editMessage = async (messageId: string, content: string) => {
    await supabase.from('messages').update({ content, edited: true }).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, edited: true } : m));
  };

  return { messages, sendMessage, deleteMessage, editMessage, loadMore, hasMore, isLoadingMore };
}
