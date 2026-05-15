import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface VoiceParticipant {
  userId: string;
  username: string;
  stream: MediaStream | null;
  isMicOn: boolean;
  isCameraOn: boolean;
}

interface PresencePayload {
  userId: string;
  username: string;
  isMicOn: boolean;
  isCameraOn: boolean;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useVoiceCall(channelId: string, userId: string, username: string, channelType?: string) {
  const isVideoChannel = channelType === 'video';

  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(isVideoChannel);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs – mutable state that doesn't need to trigger re-renders
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isMicOnRef = useRef(true);
  const isCameraOnRef = useRef(isVideoChannel);
  const isScreenSharingRef = useRef(false);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const retrackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks users who have explicitly broadcast user-left so we can ignore
  // the stale presence join that may arrive after the faster broadcast.
  const leftUsersRef = useRef<Set<string>>(new Set());

  // ─── createPeerConnection ─────────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      // Close existing connection if any
      const existing = peersRef.current.get(remoteUserId);
      if (existing) { existing.close(); }

      const pc = new RTCPeerConnection(ICE_CONFIG);

      // Add all current local tracks
      localStreamRef.current?.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // If currently screen sharing, also add the screen track
      if (screenStreamRef.current) {
        const screenTrack = screenStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
          else pc.addTrack(screenTrack, screenStreamRef.current);
        }
      }

      // Receive remote tracks → update participant stream
      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setParticipants(prev =>
          prev.map(p => p.userId === remoteUserId ? { ...p, stream } : p)
        );
      };

      // Send ICE candidates as they're discovered
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        channelRef.current?.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: userId,
            to: remoteUserId,
            candidate: event.candidate.toJSON(),
          },
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          pc.restartIce();
        }
      };

      peersRef.current.set(remoteUserId, pc);
      return pc;
    },
    [userId],
  );

  // ─── sendOffer ────────────────────────────────────────────────────────────
  const sendOffer = useCallback(
    async (remoteUserId: string) => {
      const pc = createPeerConnection(remoteUserId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'offer',
        payload: { from: userId, to: remoteUserId, sdp: pc.localDescription },
      });
    },
    [userId, createPeerConnection],
  );

  // ─── Apply pending ICE candidates ─────────────────────────────────────────
  const applyPendingCandidates = useCallback(async (remoteUserId: string, pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(remoteUserId) ?? [];
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
    pendingCandidatesRef.current.delete(remoteUserId);
  }, []);

  // ─── Retrack presence with updated flags (debounced) ───────────────────────
  // Reads isMicOnRef/isCameraOnRef at fire-time, so the LATEST state is always
  // sent even if the user toggles multiple times before the timer fires.
  // Debouncing prevents Supabase Presence rate-limit disconnects on rapid toggles.
  const retrack = useCallback(() => {
    if (retrackTimerRef.current) clearTimeout(retrackTimerRef.current);
    retrackTimerRef.current = setTimeout(() => {
      retrackTimerRef.current = null;
      channelRef.current?.track({
        userId,
        username,
        isMicOn: isMicOnRef.current,
        isCameraOn: isCameraOnRef.current,
      });
    }, 200);
  }, [userId, username]);

  // ─── Main effect: setup signaling + local media ───────────────────────────
  useEffect(() => {
    let mounted = true;

    async function init() {
      // 1. Get local stream (video channel: request camera by default)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoChannel });
      } catch {
        try {
          // Fallback: audio only (camera might be unavailable)
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (isVideoChannel && mounted) isCameraOnRef.current = false;
        } catch {
          stream = new MediaStream();
          if (isVideoChannel && mounted) isCameraOnRef.current = false;
          if (mounted) setError('Không thể truy cập microphone. Kiểm tra quyền trình duyệt.');
        }
      }
      // Sync camera state in case fallback occurred
      if (mounted) setIsCameraOn(isCameraOnRef.current);
      if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Create Supabase Realtime channel
      const ch = supabase.channel(`voice-call-${channelId}`, {
        config: { presence: { key: userId } },
      });
      channelRef.current = ch;

      // ── Incoming: offer ──────────────────────────────────────────────────
      ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const fromId = payload.from as string;
        let pc = peersRef.current.get(fromId);
        // If I also sent an offer (glare), smaller userId backs off
        if (pc && pc.signalingState !== 'stable') {
          if (userId < fromId) return; // I keep my offer, they must handle it
          pc.close();
          pc = undefined;
        }
        if (!pc) pc = createPeerConnection(fromId);

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ch.send({
          type: 'broadcast',
          event: 'answer',
          payload: { from: userId, to: fromId, sdp: pc.localDescription },
        });
        await applyPendingCandidates(fromId, pc);
      });

      // ── Incoming: answer ─────────────────────────────────────────────────
      ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const fromId = payload.from as string;
        const pc = peersRef.current.get(fromId);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await applyPendingCandidates(fromId, pc);
        } catch { /* ignore stale answers */ }
      });

      // ── Incoming: ICE candidate ──────────────────────────────────────────
      ch.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const fromId = payload.from as string;
        const pc = peersRef.current.get(fromId);
        if (!pc || !pc.remoteDescription) {
          // Queue until remote description is set
          const q = pendingCandidatesRef.current.get(fromId) ?? [];
          q.push(payload.candidate);
          pendingCandidatesRef.current.set(fromId, q);
        } else {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* ignore */ }
        }
      });

      // ── Incoming: user-left (explicit leave, instant) ────────────────────
      ch.on('broadcast', { event: 'user-left' }, ({ payload }) => {
        const leftId = payload.userId as string;
        // Mark as left so any stale presence join that arrives later is ignored
        leftUsersRef.current.add(leftId);
        const pc = peersRef.current.get(leftId);
        if (pc) { pc.close(); peersRef.current.delete(leftId); }
        setParticipants(prev => prev.filter(p => p.userId !== leftId));
      });

      // ── Presence: sync (initial state when we subscribe) ─────────────────
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<PresencePayload>();
        const others = Object.values(state)
          .flat()
          .filter(p => p.userId !== userId)
          // Ignore users who sent user-left broadcast — their presence data may
          // still be on the server momentarily due to subsystem timing.
          .filter(p => !leftUsersRef.current.has(p.userId));

        setParticipants(prev => {
          const byId = new Map(prev.map(p => [p.userId, p]));
          // Update existing, add new
          others.forEach(o => {
            byId.set(o.userId, {
              userId: o.userId,
              username: o.username,
              stream: byId.get(o.userId)?.stream ?? null,
              isMicOn: o.isMicOn,
              isCameraOn: o.isCameraOn,
            });
          });
          // Remove anyone not in presence anymore
          const activeIds = new Set(others.map(o => o.userId));
          for (const id of byId.keys()) {
            if (!activeIds.has(id)) byId.delete(id);
          }
          return Array.from(byId.values());
        });

        // Send offers to everyone we haven't connected to yet
        others.forEach(other => {
          if (!peersRef.current.has(other.userId)) {
            sendOffer(other.userId);
          }
        });
      });

      // ── Presence: join ───────────────────────────────────────────────────
      ch.on('presence', { event: 'join' }, ({ newPresences }) => {
        const others = (newPresences as unknown as PresencePayload[])
          .filter(p => p.userId !== userId)
          // Skip stale join events for users who already broadcast user-left
          .filter(p => !leftUsersRef.current.has(p.userId));
        others.forEach(other => {
          setParticipants(prev =>
            prev.some(p => p.userId === other.userId)
              ? prev.map(p => p.userId === other.userId
                  ? { ...p, isMicOn: other.isMicOn, isCameraOn: other.isCameraOn }
                  : p)
              : [...prev, { userId: other.userId, username: other.username, stream: null, isMicOn: other.isMicOn, isCameraOn: other.isCameraOn }]
          );
          // Tie-breaking for simultaneous joins: smaller userId initiates
          if (userId < other.userId && !peersRef.current.has(other.userId)) {
            sendOffer(other.userId);
          }
        });
      });

      // ── Presence: leave ──────────────────────────────────────────────────
      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const leftIds = (leftPresences as unknown as PresencePayload[]).map(p => p.userId);
        leftIds.forEach(id => {
          // Presence is now clean on the server — clear the guard so a future
          // real rejoin from this user will not be filtered.
          leftUsersRef.current.delete(id);
          const pc = peersRef.current.get(id);
          if (pc) { pc.close(); peersRef.current.delete(id); }
        });
        setParticipants(prev => prev.filter(p => !leftIds.includes(p.userId)));
      });

      // 3. Subscribe and track own presence
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({
            userId,
            username,
            isMicOn: isMicOnRef.current,
            isCameraOn: isCameraOnRef.current,
          });
        }
      });
    }

    init();

    return () => {
      mounted = false;
      if (retrackTimerRef.current) { clearTimeout(retrackTimerRef.current); retrackTimerRef.current = null; }
      if (!channelRef.current) return; // already cleaned up by leaveCall
      channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setLocalStream(null);
      setParticipants([]);
      setIsMicOn(true);
      setIsCameraOn(false);
      setIsScreenSharing(false);
    };
  }, [channelId, userId, username, createPeerConnection, sendOffer, applyPendingCandidates]);

  // ─── toggleMic ────────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const next = !isMicOnRef.current;
    isMicOnRef.current = next;
    setIsMicOn(next);

    const stream = localStreamRef.current;

    if (!next) {
      // ── Muting (fully synchronous — no race-condition risk) ───────────────
      stream?.getAudioTracks().forEach(t => { t.enabled = false; });
      retrack();
      return;
    }

    // ── Unmuting ─────────────────────────────────────────────────────────────
    const liveTrack = stream?.getAudioTracks().find(t => t.readyState === 'live');
    if (liveTrack) {
      // Normal path: live track exists — just re-enable it (synchronous, no race risk)
      liveTrack.enabled = true;
      retrack();
      return;
    }

    // Edge-case: audio track was ended (e.g. OS took back mic access).
    // Request a fresh track and wire it into the stream + every peer sender.
    if (!stream) return;
    try {
      const freshStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newTrack = freshStream.getAudioTracks()[0];
      // If user muted again while getUserMedia was pending, discard and bail out.
      if (!isMicOnRef.current) { newTrack.stop(); return; }
      stream.getAudioTracks().forEach(t => stream.removeTrack(t)); // remove dead tracks
      stream.addTrack(newTrack);
      await Promise.all(
        Array.from(peersRef.current.values()).map(async pc => {
          try {
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
            if (sender) await sender.replaceTrack(newTrack);
            else pc.addTrack(newTrack, stream);
          } catch { /* PC already closed — safe to ignore */ }
        }),
      );
      retrack();
    } catch {
      // Could not re-acquire the microphone
      isMicOnRef.current = false;
      setIsMicOn(false);
      retrack();
    }
  }, [retrack]);

  // ─── toggleCamera ─────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const next = !isCameraOnRef.current;
    if (next) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = camStream.getVideoTracks()[0];
        localStreamRef.current?.addTrack(videoTrack);
        // Add/replace video track in all peer connections
        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
          else pc.addTrack(videoTrack, localStreamRef.current!);
        });
        // Re-expose a new stream object so React updates video elements
        setLocalStream(new MediaStream(localStreamRef.current!.getTracks()));
        isCameraOnRef.current = true;
        setIsCameraOn(true);
        retrack();
      } catch {
        setError('Không thể truy cập camera. Kiểm tra quyền trình duyệt.');
      }
    } else {
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; t.stop(); localStreamRef.current!.removeTrack(t); });
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(null);
      });
      setLocalStream(new MediaStream(localStreamRef.current!.getTracks()));
      isCameraOnRef.current = false;
      setIsCameraOn(false);
      retrack();
    }
  }, [retrack]);

  // ─── toggleScreenShare ────────────────────────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharingRef.current) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      isScreenSharingRef.current = false;
      setIsScreenSharing(false);
      // Restore camera track (or null) in peer connections
      const camTrack = isCameraOnRef.current
        ? localStreamRef.current?.getVideoTracks()[0]
        : null;
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack ?? null);
      });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => {
          // User stopped via browser UI
          isScreenSharingRef.current = false;
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          const camTrack = isCameraOnRef.current
            ? localStreamRef.current?.getVideoTracks()[0]
            : null;
          peersRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(camTrack ?? null);
          });
        };
        screenStreamRef.current = screenStream;
        isScreenSharingRef.current = true;
        setIsScreenSharing(true);
        // Replace/add video track in all peer connections
        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
          else pc.addTrack(screenTrack, screenStream);
        });
      } catch {
        // User cancelled or permission denied – silently ignore
      }
    }
  }, []);

  // ─── leaveCall ────────────────────────────────────────────────────────────
  const leaveCall = useCallback(async () => {
    const ch = channelRef.current;
    if (!ch) return;
    // 1. Cancel pending retrack timer so no stale channel.track() fires
    if (retrackTimerRef.current) {
      clearTimeout(retrackTimerRef.current);
      retrackTimerRef.current = null;
    }
    // 2. Untrack presence FIRST so the server starts cleaning up our presence
    // before the broadcast arrives at other clients. This minimises the window
    // in which a stale presence join could overtake the user-left broadcast.
    ch.untrack();
    // 3. Notify all others via broadcast (instant, no server-side timeout)
    await ch.send({ type: 'broadcast', event: 'user-left', payload: { userId } });
    // 3. Stop all local media
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    // 4. Close peer connections
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    // 5. Disconnect from Supabase Realtime
    supabase.removeChannel(ch);
    channelRef.current = null; // prevents double-cleanup in useEffect
  }, [userId]);

  return {
    participants,
    localStream,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    error,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    leaveCall,
  };
}
