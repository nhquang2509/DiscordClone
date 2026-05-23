/**
 * useVoiceChannelSidebar
 *
 * For every voice/video channel in the server EXCEPT the one the current user
 * is actively calling in, this hook subscribes to the existing Supabase Presence
 * channel (`voice-call-<channelId>`) in read-only mode to discover who is there.
 *
 * Why this approach instead of a separate "server-wide" presence channel:
 *  - The `voice-call-<channelId>` channel is already populated by useVoiceCall
 *    on every participant's client — proven to work.
 *  - We only skip the channel the local user is in (Phoenix constraint: a client
 *    cannot subscribe to the same topic twice; useVoiceCall already owns that slot).
 *  - Different channel topics → no duplicate-subscription conflict.
 *
 * The current user's own channel is served by voiceChannelStore (fed by
 * ActiveCallView's participants via setVoiceChannelParticipants).
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Channel } from '@/types';
import type { VoiceStoreUser } from './voiceChannelStore';
import { useMyVoiceChannelId } from './voiceChannelStore';

type VoiceMap = Record<string, VoiceStoreUser[]>;

interface PresencePayload {
  userId: string;
  username: string;
  isMicOn: boolean;
  isCameraOn: boolean;
}

export function useVoiceChannelSidebar(channels: Channel[]): VoiceMap {
  const [voiceMap, setVoiceMap] = useState<VoiceMap>({});

  // The channel the current user is in (set by ActiveCallView, cleared on leave).
  const myChannelId = useMyVoiceChannelId();

  // Stable key of all voice/video channel IDs — only changes when channels are
  // added or removed, preventing unnecessary effect re-runs.
  const channelIdKey = channels
    .filter(c => c.type === 'audio' || c.type === 'video')
    .map(c => c.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (!channelIdKey) return;

    const allIds = channelIdKey ? channelIdKey.split(',') : [];
    // Skip the channel the user is currently in — useVoiceCall already holds
    // that subscription; a second subscribe would violate the Phoenix constraint.
    const toSubscribe = allIds.filter(id => id !== myChannelId);

    const subscriptions = new Map<string, ReturnType<typeof supabase.channel>>();

    for (const channelId of toSubscribe) {
      const ch = supabase.channel(`voice-call-${channelId}`);
      subscriptions.set(channelId, ch);

      const syncState = () => {
        const state = ch.presenceState<PresencePayload>();
        const users: VoiceStoreUser[] = [];
        for (const presences of Object.values(state)) {
          for (const p of presences) {
            if (!users.some(u => u.userId === p.userId)) {
              users.push({ userId: p.userId, username: p.username });
            }
          }
        }
        setVoiceMap(prev => {
          if (users.length === 0) {
            if (!prev[channelId]) return prev; // no-op
            const next = { ...prev };
            delete next[channelId];
            return next;
          }
          return { ...prev, [channelId]: users };
        });
      };

      ch.on('presence', { event: 'sync' }, syncState)
        .on('presence', { event: 'join' }, syncState)
        .on('presence', { event: 'leave' }, syncState)
        .subscribe();
    }

    return () => {
      for (const ch of subscriptions.values()) {
        ch.unsubscribe();
      }
      // Clear all external data; voiceChannelStore covers the local user's channel.
      setVoiceMap({});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelIdKey, myChannelId]);

  return voiceMap;
}
