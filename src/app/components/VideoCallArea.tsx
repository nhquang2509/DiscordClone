'use client';

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Phone,
  PhoneCall,
  X,
  Users,
  AlertCircle,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Channel, Message, FileAttachment } from '@/types';
import { useTheme } from '@/lib/theme-context';
import { useVoiceCall } from '../../hooks/useVoiceCall';
import type { VoiceParticipant } from '../../hooks/useVoiceCall';
import { setVoiceChannelParticipants, clearVoiceChannelParticipants, setMyVoiceChannelId } from '../../hooks/voiceChannelStore';

interface VideoCallAreaProps {
  channel: Channel;
  messages: Message[];
  currentUserId: string;
  currentUsername: string;
  onSendMessage: (content: string, files: FileAttachment[]) => void;
  onDeleteMessage: (id: string) => void;
  onEditMessage: (id: string, content: string) => void;
}

// ─── VideoTile ──────────────────────────────────────────────────────────────
function VideoTile({
  participant,
  isLocal = false,
}: {
  participant: VoiceParticipant & { stream: MediaStream | null };
  isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = participant.stream ?? null;
    }
  }, [participant.stream]);

  const hasActiveVideo =
    participant.stream != null &&
    participant.stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  return (
    <div className="relative rounded-xl overflow-hidden bg-[#1e1f22] flex items-center justify-center aspect-video border border-[#26272b]">
      {/*
        The <video> element MUST always be in the DOM so that the browser can
        route the remote participant's audio through it. Hiding it with CSS
        (display:none / hidden) does NOT stop audio playback — only conditional
        rendering (unmounting) does, which is why audio was broken before.
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={hasActiveVideo ? 'w-full h-full object-cover' : 'hidden'}
      />

      {/* Avatar shown when there is no active video */}
      {!hasActiveVideo && (
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold"
            style={{ background: '#5865f2' }}
          >
            {participant.username.charAt(0).toUpperCase()}
          </div>
          <span className="text-[#b5bac1] text-sm font-medium">
            {participant.username}
            {isLocal ? ' (You)' : ''}
          </span>
        </div>
      )}

      {/* Name + mic status badge */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-md px-2 py-1">
        {!participant.isMicOn && <MicOff className="w-3 h-3 text-[#ed4245]" />}
        <span className="text-white text-xs font-medium">
          {participant.username}
          {isLocal ? ' (You)' : ''}
        </span>
      </div>
    </div>
  );
}

// ─── Lobby view (before joining) ────────────────────────────────────────────
function LobbyView({
  channel,
  onJoin,
}: {
  channel: Channel;
  onJoin: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-6"
      style={{ background: isDark ? '#1a1b1e' : '#f2f3f5' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: isDark ? '#27282c' : '#e3e5e8' }}
        >
          {channel.type === 'video' ? (
            <Video className={`w-9 h-9 ${isDark ? 'text-[#b5bac1]' : 'text-[#4e5058]'}`} />
          ) : (
            <Mic className={`w-9 h-9 ${isDark ? 'text-[#b5bac1]' : 'text-[#4e5058]'}`} />
          )}
        </div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[#2e3338]'}`}>{channel.name}</h2>
        <p className={`text-sm ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`}>
          {channel.type === 'video' ? 'Video channel' : 'Voice channel'}
        </p>
      </div>

      <button
        onClick={onJoin}
        className="bg-[#248046] hover:bg-[#1a6334] text-white px-8 py-3 rounded-full font-semibold text-sm flex items-center gap-2 transition-colors"
      >
        <PhoneCall className="w-4 h-4" />
        Join call
      </button>
    </div>
  );
}

// ─── Active call view ────────────────────────────────────────────────────────
function ActiveCallView({
  channel,
  messages,
  currentUserId,
  currentUsername,
  onSendMessage,
  onLeave,
}: {
  channel: Channel;
  messages: Message[];
  currentUserId: string;
  currentUsername: string;
  onSendMessage: (content: string, files: FileAttachment[]) => void;
  onLeave: () => void;
}) {
  const {
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
  } = useVoiceCall(channel.id, currentUserId, currentUsername, channel.type);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isChatOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim(), []);
    setChatInput('');
  };

  const visibleMessages = messages.filter(m => !m.deleted);

  const localParticipant: VoiceParticipant = {
    userId: currentUserId,
    username: currentUsername,
    stream: localStream,
    isMicOn,
    isCameraOn,
  };
  const allParticipants = [localParticipant, ...participants];

  // Sync participant list to the module store so ChannelSidebar can read it.
  // Uses participants.length as a stable dependency proxy.
  useEffect(() => {
    // Signal immediately that this client is in this channel, so the sidebar
    // hook can stop subscribing to this channel's own presence (Phoenix rule:
    // a client cannot subscribe to the same topic twice).
    setMyVoiceChannelId(channel.id);
    return () => {
      setMyVoiceChannelId(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  useEffect(() => {
    setVoiceChannelParticipants(
      channel.id,
      allParticipants.map(p => ({ userId: p.userId, username: p.username })),
    );
    return () => {
      clearVoiceChannelParticipants(channel.id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  const colClass =
    allParticipants.length === 1
      ? 'grid-cols-1 max-w-xl mx-auto'
      : allParticipants.length <= 4
      ? 'grid-cols-2'
      : 'grid-cols-3';

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const bg = isDark ? '#1a1b1e' : '#f2f3f5';
  const border = isDark ? '#26272b' : '#e3e5e8';
  const textPrimary = isDark ? 'text-white' : 'text-[#2e3338]';
  const textMuted = isDark ? 'text-[#80848e]' : 'text-[#5c5f66]';
  const chatBg = isDark ? '#313338' : '#ffffff';
  const ctrlBg = isDark ? '#232428' : '#e8e9ed';
  const ctrlBorderTop = isDark ? '#1e1f22' : '#d4d5d9';
  const inputBg = isDark ? '#383a40' : '#e3e5e8';
  const inputText = isDark ? 'text-white' : 'text-[#2e3338]';
  const inputPlaceholder = isDark ? 'placeholder:text-[#6d6f78]' : 'placeholder:text-[#81848f]';

  return (
    <div className="flex-1 flex flex-col" style={{ background: bg }}>
      {/* Header */}
      <div
        className="h-12 px-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-2">
          {channel.type === 'video' ? (
            <Video className={`w-4 h-4 ${textMuted}`} />
          ) : (
            <Mic className={`w-4 h-4 ${textMuted}`} />
          )}
          <span className={`${textPrimary} font-semibold text-sm`}>{channel.name}</span>
          <span className="text-[#3ba55c] text-xs font-medium bg-[#3ba55c]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3ba55c] animate-pulse" />
            {allParticipants.length} {allParticipants.length === 1 ? 'member' : 'members'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#949ba4] text-xs">
          <Users className="w-4 h-4" />
          <span>{fmt(elapsed)}</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-[#ed4245]/20 text-[#ed4245] text-sm px-4 py-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Participant grid */}
        <div className="flex-1 p-4 overflow-y-auto flex items-start justify-center">
          <div className={`grid ${colClass} gap-3 w-full`}>
            {allParticipants.map((p, i) => (
              <VideoTile key={p.userId} participant={p} isLocal={i === 0} />
            ))}
          </div>
        </div>

        {/* Chat panel */}
        {isChatOpen && (
          <div
            className="w-72 flex flex-col flex-shrink-0"
            style={{ background: chatBg, borderLeft: `1px solid ${border}` }}
          >
            <div
              className="h-12 px-4 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: `1px solid ${border}` }}
            >
              <span className={`${textPrimary} font-semibold text-sm`}>#{channel.name}</span>
              <button
                onClick={() => setIsChatOpen(false)}
                className={`${textMuted} ${isDark ? 'hover:text-white' : 'hover:text-[#2e3338]'} transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {visibleMessages.length === 0 && (
                <p className={`${textMuted} text-xs text-center mt-4`}>No messages yet.</p>
              )}
              {visibleMessages.map(msg => (
                <div key={msg.id} className="flex gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: msg.authorColor }}
                  >
                    {msg.authorAvatar}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`${textPrimary} text-sm font-semibold`}>{msg.authorName}</span>
                      <span className={`${textMuted} text-[10px]`}>
                        {msg.timestamp.split(', ')[1]}
                      </span>
                    </div>
                    <p className={`${isDark ? 'text-[#dbdee1]' : 'text-[#2e3338]'} text-sm leading-snug break-words`}>{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-3 pb-4 flex-shrink-0">
              <div className="rounded px-3 py-2" style={{ background: inputBg }}>
                <input
                  type="text"
                  placeholder={`Message #${channel.name}`}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
                  className={`w-full bg-transparent ${inputText} ${inputPlaceholder} outline-none text-sm`}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="h-[80px] px-6 flex items-center justify-between flex-shrink-0"
        style={{ background: ctrlBg, borderTop: `1px solid ${ctrlBorderTop}` }}
      >
        <div className="min-w-[140px]">
          <p className={`${textPrimary} text-sm font-medium`}>{channel.name}</p>
          <p className="text-[#3ba55c] text-xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ba55c] inline-block" />
            Connected
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CtrlBtn
            icon={isMicOn ? Mic : MicOff}
            label={isMicOn ? 'Mute' : 'Unmute'}
            active={isMicOn}
            danger={!isMicOn}
            onClick={toggleMic}
          />
          <CtrlBtn
            icon={isCameraOn ? Video : VideoOff}
            label={isCameraOn ? 'Stop video' : 'Start video'}
            active={isCameraOn}
            danger={!isCameraOn}
            onClick={toggleCamera}
          />
          <CtrlBtn
            icon={isScreenSharing ? MonitorOff : Monitor}
            label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            active={isScreenSharing}
            highlight={isScreenSharing}
            onClick={toggleScreenShare}
          />
          <CtrlBtn
            icon={MessageSquare}
            label="Chat"
            active={isChatOpen}
            highlight={isChatOpen}
            onClick={() => setIsChatOpen(v => !v)}
          />
        </div>

        <div className="flex items-center justify-end min-w-[140px]">
          <button
            onClick={async () => { await leaveCall(); onLeave(); }}
            className="bg-[#ed4245] hover:bg-[#c03537] text-white px-5 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-colors"
          >
            <Phone className="w-4 h-4" />
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Control button ──────────────────────────────────────────────────────────
function CtrlBtn({
  icon: Icon,
  label,
  active,
  danger,
  highlight,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  danger?: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={onClick}
        title={label}
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
          highlight
            ? 'bg-[#5865f2] text-white hover:bg-[#4752c4]'
            : danger
            ? 'bg-[#ed4245]/20 text-[#ed4245] hover:bg-[#ed4245]/30'
            : active
            ? `${isDark ? 'bg-[#404249]' : 'bg-[#d5d7db]'} ${isDark ? 'text-white' : 'text-[#2e3338]'} ${isDark ? 'hover:bg-[#4f5058]' : 'hover:bg-[#c8cace]'}`
            : `${isDark ? 'bg-[#2b2d31] text-[#b5bac1] hover:bg-[#404249] hover:text-white' : 'bg-[#e3e5e8] text-[#4e5058] hover:bg-[#d5d7db] hover:text-[#2e3338]'}`
        }`}
      >
        <Icon className="w-5 h-5" />
      </button>
      <span className={`${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'} text-[9px] whitespace-nowrap`}>{label}</span>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function VideoCallArea({
  channel,
  messages,
  currentUserId,
  currentUsername,
  onSendMessage,
}: VideoCallAreaProps) {
  const [isJoined, setIsJoined] = useState(false);
  // Messages visible in the call chat — reset on each new call session
  const [callMessages, setCallMessages] = useState<Message[]>([]);
  // IDs of messages that existed before joining (so we only show new ones)
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Accumulate messages that arrive AFTER joining the call
  useEffect(() => {
    if (!isJoined) return;
    setCallMessages(prev => {
      const newMsgs = messages.filter(m => !seenIdsRef.current.has(m.id));
      newMsgs.forEach(m => seenIdsRef.current.add(m.id));
      // Also apply edits / soft-deletes to existing call messages
      const updated = prev.map(cm => messages.find(m => m.id === cm.id) ?? cm);
      return [...updated, ...newMsgs];
    });
  }, [messages, isJoined]);

  const handleJoin = () => {
    // Snapshot current message IDs so they are treated as "pre-existing"
    seenIdsRef.current = new Set(messages.map(m => m.id));
    setCallMessages([]);
    setIsJoined(true);
  };

  if (!isJoined) {
    return <LobbyView channel={channel} onJoin={handleJoin} />;
  }

  return (
    <ActiveCallView
      channel={channel}
      messages={callMessages}
      currentUserId={currentUserId}
      currentUsername={currentUsername}
      onSendMessage={onSendMessage}
      onLeave={() => setIsJoined(false)}
    />
  );
}