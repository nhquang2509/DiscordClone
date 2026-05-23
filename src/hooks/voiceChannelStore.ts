/**
 * Module-level store tracking who is in which voice/video channel.
 *
 * Updated by ActiveCallView whenever the participant list changes.
 * Read by ChannelSidebar via useVoiceChannelStore().
 *
 * This avoids Supabase Presence conflicts and timing issues entirely:
 * the data comes straight from useVoiceCall which is already proven to work.
 */

import { useEffect, useState } from 'react';

export interface VoiceStoreUser {
  userId: string;
  username: string;
}

/** Alias kept for compatibility with ChannelSidebar prop type. */
export type VoicePresenceUser = VoiceStoreUser;

type ChannelMap = Record<string, VoiceStoreUser[]>;

let currentMap: ChannelMap = {};
const listeners = new Set<(m: ChannelMap) => void>();

function notify() {
  const snapshot = { ...currentMap };
  listeners.forEach(l => l(snapshot));
}

/** Called by ActiveCallView with the full participant list (including local user). */
export function setVoiceChannelParticipants(channelId: string, users: VoiceStoreUser[]) {
  if (users.length === 0) {
    if (!currentMap[channelId]) return; // nothing to do
    const next = { ...currentMap };
    delete next[channelId];
    currentMap = next;
  } else {
    currentMap = { ...currentMap, [channelId]: users };
  }
  notify();
}

/** Called when leaving the call or component unmounts. */
export function clearVoiceChannelParticipants(channelId: string) {
  setVoiceChannelParticipants(channelId, []);
}

/** React hook — re-renders when the map changes. */
export function useVoiceChannelStore(): ChannelMap {
  const [state, setState] = useState<ChannelMap>({ ...currentMap });

  useEffect(() => {
    // Sync in case the map changed between render and effect registration.
    setState({ ...currentMap });
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
