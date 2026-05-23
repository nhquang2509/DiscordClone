import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface IncomingDmCall {
  callerId: string;
  callerName: string;
  type: 'audio' | 'video';
}

/**
 * Broadcast & receive call signals for a DM (members) channel.
 * Pass `channelId = null` to disable (for non-members channels).
 */
export function useDmCallSignal(
  channelId: string | null,
  currentUserId: string,
  currentUsername: string,
) {
  const [incomingCall, setIncomingCall] = useState<IncomingDmCall | null>(null);
  const chRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!channelId) return;

    const ch = supabase.channel(`dm-call-signal-${channelId}`);
    chRef.current = ch;

    ch.on('broadcast', { event: 'call-started' }, ({ payload }) => {
      if (payload.callerId !== currentUserId) {
        setIncomingCall({
          callerId: payload.callerId,
          callerName: payload.callerName,
          type: payload.type as 'audio' | 'video',
        });
      }
    });

    ch.on('broadcast', { event: 'call-ended' }, ({ payload }) => {
      if (payload.callerId !== currentUserId) {
        setIncomingCall(null);
      }
    });

    ch.subscribe();

    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
      setIncomingCall(null);
    };
  }, [channelId, currentUserId]);

  const broadcastCallStarted = useCallback((type: 'audio' | 'video') => {
    chRef.current?.send({
      type: 'broadcast',
      event: 'call-started',
      payload: { callerId: currentUserId, callerName: currentUsername, type },
    });
  }, [currentUserId, currentUsername]);

  const broadcastCallEnded = useCallback(() => {
    chRef.current?.send({
      type: 'broadcast',
      event: 'call-ended',
      payload: { callerId: currentUserId },
    });
    setIncomingCall(null);
  }, [currentUserId]);

  const dismissIncomingCall = useCallback(() => setIncomingCall(null), []);

  return { incomingCall, broadcastCallStarted, broadcastCallEnded, dismissIncomingCall };
}
