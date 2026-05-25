'use client';

import {
  Hash,
  Bell,
  Pin,
  Users,
  Search,
  Inbox,
  CircleHelp,
  SmilePlus,
  Gift,
  Sticker,
  Plus,
  Pencil,
  Trash2,
  X,
  FileText,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  Download,
  Phone,
  Video,
  User,
  AlertCircle,
} from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/lib/theme-context';
import { VideoCallArea } from './VideoCallArea';
import { AttachmentModal } from './AttachmentModal';
import type { Channel, Message, FileAttachment } from '@/types';
import type { ServerMember, MemberRole, ServerNotification } from '../../hooks/useServerMembers';
import { useDmCallSignal } from '../../hooks/useDmCallSignal';
import { usePinnedMessages } from '../../hooks/usePinnedMessages';
import type { PinnedMessage } from '../../hooks/usePinnedMessages';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

interface ChatAreaProps {
  channel: Channel | null;
  messages: Message[];
  currentUserId: string;
  currentUsername: string;
  members: ServerMember[];
  myRole: MemberRole;
  onSetMemberRole: (userId: string, role: MemberRole) => void;
  onSendMessage: (content: string, files: FileAttachment[]) => Promise<boolean>;
  onDeleteMessage: (id: string) => void;
  onEditMessage: (id: string, content: string) => void;
  loadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  joinNotifications: ServerNotification[];
  clearJoinNotifications: () => void;
  partnerName?: string;
}

export function ChatArea({
  channel,
  messages,
  currentUserId,
  currentUsername,
  members,
  myRole,
  onSetMemberRole,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  loadMore,
  hasMore,
  isLoadingMore,
  joinNotifications,
  clearJoinNotifications,
  partnerName,
}: ChatAreaProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [messageInput, setMessageInput] = useState('');
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [deleteModalMsgId, setDeleteModalMsgId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [openRoleMenuId, setOpenRoleMenuId] = useState<string | null>(null);
  const [dmCallMode, setDmCallMode] = useState<'none' | 'audio' | 'video'>('none');
  const [showCallNotif, setShowCallNotif] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [failedMessages, setFailedMessages] = useState<{ id: string; content: string }[]>([]);

  // DM call signaling (only active for members channels)
  const { incomingCall, broadcastCallStarted, broadcastCallEnded, dismissIncomingCall } =
    useDmCallSignal(
      channel?.type === 'members' ? channel.id : null,
      currentUserId,
      currentUsername,
    );

  // Pinned messages
  const { pinnedMessages, pinMessage } = usePinnedMessages(
    channel?.id ?? null,
    currentUserId,
    currentUsername,
  );

  // Network status
  const networkStatus = useNetworkStatus();

  // Auto-show notification popup when an incoming call arrives
  useEffect(() => {
    if (incomingCall) setShowCallNotif(true);
  }, [incomingCall]);

  // Clear incoming call notification when current user joins a call
  useEffect(() => {
    if (dmCallMode !== 'none') {
      dismissIncomingCall();
      setShowCallNotif(false);
    }
  }, [dmCallMode, dismissIncomingCall]);

  // Close context menu / join panel when clicking anywhere
  useEffect(() => {
    if (!contextMenu && !showJoinPanel) return;
    const close = () => { setContextMenu(null); setShowJoinPanel(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu, showJoinPanel]);

  const handlePinMessage = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    await pinMessage(msgId, msg.content, msg.authorName);
  };

  const scrollToMessage = (messageId: string) => {
    setShowPinPanel(false);
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(messageId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    } else {
      // Message not in DOM yet — load older messages until it appears
      setPendingScrollId(messageId);
    }
  };
  // Effect: when pendingScrollId is set, try to scroll to the message.
  // If not in DOM yet, load more (older) messages until it appears.
  useEffect(() => {
    if (!pendingScrollId) return;
    const el = document.querySelector(`[data-message-id="${pendingScrollId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(pendingScrollId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
      setPendingScrollId(null);
    } else if (hasMore && !isLoadingMore) {
      // Preserve scroll position while prepending older messages
      if (scrollContainerRef.current) {
        prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
      }
      loadMore();
    } else if (!hasMore) {
      // Message not found and no more pages — give up
      setPendingScrollId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScrollId, messages, hasMore, isLoadingMore]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Saved scrollHeight before loadMore — used to restore scroll position after prepend
  const prevScrollHeightRef = useRef<number | null>(null);
  // Whether user is near the bottom (to decide if we auto-scroll on new messages)
  const isAtBottomRef = useRef(true);

  // Scroll to bottom instantly whenever the channel changes
  useEffect(() => {
    isAtBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [channel?.id]);

  // Reset DM call when switching channels
  useEffect(() => {
    setDmCallMode('none');
  }, [channel?.id]);

  // Restore scroll position after older messages are prepended
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (prevScrollHeightRef.current !== null && container) {
      container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
      return; // Don't auto-scroll to bottom when loading more
    }
    // Auto-scroll to bottom only when user is near the bottom
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Track whether user is near bottom
    isAtBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    // Trigger load-more when scrolled near the top
    if (container.scrollTop < 80 && hasMore && !isLoadingMore) {
      prevScrollHeightRef.current = container.scrollHeight;
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // Colors
  const bg = isDark ? 'bg-[#313338]' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-[#2e3338]';
  const textMuted = isDark ? 'text-[#b5bac1]' : 'text-[#747f8d]';
  const textBody = isDark ? 'text-[#dbdee1]' : 'text-[#2e3338]';
  const borderColor = isDark ? 'border-[#26272b]' : 'border-[#e3e5e8]';
  const inputBg = isDark ? 'bg-[#383a40]' : 'bg-[#ebedef]';
  const hoverBg = isDark ? 'hover:bg-[#2e3035]' : 'hover:bg-[#f2f3f5]';
  const actionsPanel = isDark ? 'bg-[#232428] border-[#1e1f22]' : 'bg-white border-[#e3e5e8]';
  const editBg = isDark ? 'bg-[#383a40]' : 'bg-[#ebedef]';
  const hoverIconMuted = isDark ? 'hover:text-[#dbdee1]' : 'hover:text-[#2e3338]';

  // Empty / no channel state
  if (!channel) {
    return (
      <div className={`flex-1 ${bg} flex items-center justify-center ${textMuted}`}>
        <div className="text-center">
          <Hash className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-xl">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  // Voice / Video call view
  // key={channel.id} forces a full remount when the channel changes,
  // which resets isJoined to false and triggers useVoiceCall cleanup
  // (auto-leaving the previous call).
  if (channel.type === 'audio' || channel.type === 'video') {
    return (
      <VideoCallArea
        key={channel.id}
        channel={channel}
        messages={messages}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        onSendMessage={onSendMessage}
        onDeleteMessage={onDeleteMessage}
        onEditMessage={onEditMessage}
      />
    );
  }

  // ——— DM voice/video call overlay ———
  if (channel.type === 'members' && dmCallMode !== 'none') {
    const dmCallChannel: Channel = {
      ...channel,
      type: dmCallMode,
      name: partnerName ?? channel.name,
    };
    return (
      <VideoCallArea
        key={`dm-call-${channel.id}-${dmCallMode}`}
        channel={dmCallChannel}
        messages={messages}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        onSendMessage={onSendMessage}
        onDeleteMessage={onDeleteMessage}
        onEditMessage={onEditMessage}
        onClose={() => { setDmCallMode('none'); broadcastCallEnded(); }}
      />
    );
  }

  // ——— Text channel ———

  const handleSend = async () => {
    if (!messageInput.trim()) return;
    const content = messageInput.trim();
    setMessageInput('');
    const success = await onSendMessage(content, []);
    if (!success) {
      setFailedMessages(prev => [...prev, { id: crypto.randomUUID(), content }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendFiles = async (files: FileAttachment[]) => {
    const success = await onSendMessage('', files);
    if (!success) {
      setFailedMessages(prev => [...prev, { id: crypto.randomUUID(), content: `[${files.length} file(s)]` }]);
    }
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditingContent(msg.content);
  };

  const saveEdit = () => {
    if (editingId && editingContent.trim()) {
      onEditMessage(editingId, editingContent.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <>
    <div className={`flex-1 ${bg} flex min-w-0`}>
      {/* Main chat column */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div
        className={`h-12 px-4 flex items-center justify-between border-b ${borderColor} shadow-sm flex-shrink-0`}
      >
        <div className="flex items-center gap-2">
          {channel.type === 'members' ? (
            <>
              <div className="w-6 h-6 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {(partnerName ?? channel.name).charAt(0).toUpperCase()}
              </div>
              <span className={`${textPrimary} font-semibold`}>{partnerName ?? channel.name}</span>
            </>
          ) : (
            <>
              <Hash className="w-5 h-5" style={{ color: isDark ? '#80848e' : '#747f8d' }} />
              <span className={`${textPrimary} font-semibold`}>{channel.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Network status badge */}
          {networkStatus === 'online' && (
            <div className="px-3 py-1 bg-[#248046] text-white text-xs font-medium rounded flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Live: Real-time updates
            </div>
          )}
          {networkStatus === 'slow' && (
            <div className="px-3 py-1 bg-[#f0a032] text-white text-xs font-medium rounded flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Unstable connection
            </div>
          )}
          {networkStatus === 'offline' && (
            <div className="px-3 py-1 bg-[#ed4245] text-white text-xs font-medium rounded flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full" />
              No connection
            </div>
          )}
          {channel.type === 'members' ? (
            <>
              <Phone
                onClick={() => { setDmCallMode('audio'); broadcastCallStarted('audio'); }}
                className={`w-5 h-5 ${textMuted} ${hoverIconMuted} cursor-pointer transition-colors`}
              />
              <Video
                onClick={() => { setDmCallMode('video'); broadcastCallStarted('video'); }}
                className={`w-5 h-5 ${textMuted} ${hoverIconMuted} cursor-pointer transition-colors`}
              />
              {/* Bell with incoming call notification */}
              <div className="relative">
                <div
                  className="relative cursor-pointer"
                  onClick={() => setShowCallNotif(v => !v)}
                >
                  <Bell className={`w-5 h-5 ${textMuted} ${hoverIconMuted} transition-colors`} />
                  {incomingCall && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ed4245] rounded-full border-2 border-[#313338]" />
                  )}
                </div>
                {showCallNotif && incomingCall && (
                  <div
                    className="absolute right-0 top-full mt-2 w-72 rounded-lg shadow-xl z-[200] p-4"
                    style={{
                      background: isDark ? '#2b2d31' : '#f2f3f5',
                      border: `1px solid ${isDark ? '#1e1f22' : '#e3e5e8'}`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white font-bold flex-shrink-0">
                        {incomingCall.callerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={`${textPrimary} font-semibold text-sm`}>{incomingCall.callerName}</p>
                        <p className={`text-xs ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`}>
                          {incomingCall.type === 'video' ? 'Incoming video call...' : 'Incoming voice call...'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setDmCallMode(incomingCall.type);
                          dismissIncomingCall();
                          setShowCallNotif(false);
                        }}
                        className="flex-1 bg-[#248046] hover:bg-[#1a6334] text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        Answer
                      </button>
                      <button
                        onClick={() => { dismissIncomingCall(); setShowCallNotif(false); }}
                        className="flex-1 bg-[#ed4245] hover:bg-[#c03537] text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Decline
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Pin icon (members) */}
              <PinIconWithPanel
                pinnedMessages={pinnedMessages}
                showPinPanel={showPinPanel}
                setShowPinPanel={setShowPinPanel}
                textMuted={textMuted}
                hoverIconMuted={hoverIconMuted}
                isDark={isDark}
                onSeePins={() => setShowPinPanel(true)}
                onScrollToMessage={scrollToMessage}
              />
            </>
          ) : (
            <>
              {/* Bell with join notifications (text channel) */}
              <div className="relative">
                <div
                  className="relative cursor-pointer"
                  onClick={() => { setShowJoinPanel(v => !v); if (!showJoinPanel) clearJoinNotifications(); }}
                >
                  <Bell className={`w-5 h-5 ${textMuted} ${hoverIconMuted} transition-colors`} />
                </div>
                {showJoinPanel && (
                  <div
                    className="absolute right-0 top-full mt-2 w-80 rounded-lg shadow-xl z-[200]"
                    style={{
                      background: isDark ? '#2b2d31' : '#f2f3f5',
                      border: `1px solid ${isDark ? '#1e1f22' : '#e3e5e8'}`,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ borderBottom: `1px solid ${isDark ? '#1e1f22' : '#e3e5e8'}` }}
                    >
                      <div className="flex items-center gap-2">
                        <Bell className={`w-4 h-4 ${isDark ? 'text-[#b5bac1]' : 'text-[#4e5058]'}`} />
                        <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-[#2e3338]'}`}>
                          Server Notifications
                        </span>
                      </div>
                      <button
                        onClick={() => setShowJoinPanel(false)}
                        className={`${isDark ? 'text-[#b5bac1] hover:text-white' : 'text-[#4e5058] hover:text-[#2e3338]'} transition-colors`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {joinNotifications.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <Bell className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-[#4e5058]' : 'text-[#c1c4c9]'}`} />
                        <p className={`text-sm ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`}>No new notifications</p>
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto divide-y"
                        style={{ borderColor: isDark ? '#1e1f22' : '#e3e5e8' }}
                      >
                        {joinNotifications.map(n => (
                          <div key={n.id} className={`px-4 py-3 flex items-center gap-3 ${isDark ? 'hover:bg-[#35373c]' : 'hover:bg-[#e6e8eb]'} transition-colors`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                              n.type === 'join' ? 'bg-[#248046]' : 'bg-[#ed4245]'
                            }`}>
                              {n.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#2e3338]'}`}>
                                {n.username}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`}>
                                {n.type === 'join' ? 'has joined the server' : 'has left the server'} · {n.time}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Pin icon (text channel) */}
              <PinIconWithPanel
                pinnedMessages={pinnedMessages}
                showPinPanel={showPinPanel}
                setShowPinPanel={setShowPinPanel}
                textMuted={textMuted}
                hoverIconMuted={hoverIconMuted}
                isDark={isDark}
                onSeePins={() => setShowPinPanel(true)}
                onScrollToMessage={scrollToMessage}
              />
              <Users
                onClick={() => setIsMembersOpen(o => !o)}
                className={`w-5 h-5 cursor-pointer transition-colors ${
                  isMembersOpen
                    ? 'text-white'
                    : `${textMuted} ${hoverIconMuted}`
                }`}
              />
              <Search className={`w-5 h-5 ${textMuted} ${hoverIconMuted} cursor-pointer transition-colors`} />
              <Inbox className={`w-5 h-5 ${textMuted} ${hoverIconMuted} cursor-pointer transition-colors`} />
              <CircleHelp className={`w-5 h-5 ${textMuted} ${hoverIconMuted} cursor-pointer transition-colors`} />
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {/* Load-more spinner / sentinel at top */}
        {hasMore && (
          <div className="flex justify-center py-3">
            {isLoadingMore ? (
              <div className="w-5 h-5 rounded-full border-2 border-[#5865f2] border-t-transparent animate-spin" />
            ) : (
              <span className={`text-xs ${isDark ? 'text-[#72767d]' : 'text-[#747f8d]'}`}>Scroll up to load more</span>
            )}
          </div>
        )}
        {/* Welcome header (always shown at top) */}
        <div className="mb-6">
          {channel.type === 'members' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#5865f2] flex items-center justify-center mb-4 text-white text-3xl font-bold">
                {(partnerName ?? channel.name).charAt(0).toUpperCase()}
              </div>
              <h2
                className={`${textPrimary} font-bold mb-2`}
                style={{ fontSize: '1.75rem' }}
              >
                {partnerName ?? channel.name}
              </h2>
              <p className={`${textMuted} text-sm`}>
                This is a private chat
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-[#5865f2] flex items-center justify-center mb-4">
                <Hash className="w-8 h-8 text-white" />
              </div>
              <h2
                className={`${textPrimary} font-bold mb-2`}
                style={{ fontSize: '1.75rem' }}
              >
                Welcome to #{channel.name}!
              </h2>
              <p className={`${textMuted} text-sm`}>
                This is the start of the #{channel.name} channel.
              </p>
            </>
          )}
        </div>

        {/* Message list */}
        <div className="space-y-0.5">
          {messages.map((msg, index) => {
            // System messages rendered as centered dividers
            if (msg.isSystem) {
              const isServerEvent =
                msg.content.includes('has joined the server') ||
                msg.content.includes('has left the server');
              return (
                <div key={msg.id} className="flex items-center gap-3 px-4 py-1 my-1">
                  <div className={`flex-1 h-px ${isDark ? 'bg-[#3f4147]' : 'bg-[#d5d7db]'}`} />
                  <span className={`text-xs ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'} flex items-center gap-1.5 flex-shrink-0`}>
                    {!isServerEvent && <Pin className="w-3 h-3" />}
                    {msg.content}
                    {!isServerEvent && (
                      <>
                        {' — '}
                        <button
                          onClick={() => setShowPinPanel(true)}
                          className="text-[#5865f2] hover:underline"
                        >
                          See more
                        </button>
                      </>
                    )}
                  </span>
                  <div className={`flex-1 h-px ${isDark ? 'bg-[#3f4147]' : 'bg-[#d5d7db]'}`} />
                </div>
              );
            }

            const prev = messages[index - 1];
            const showAvatar =
              !prev ||
              prev.isSystem ||
              prev.authorId !== msg.authorId ||
              prev.deleted;
            const isOwn = msg.authorId === currentUserId;
            const isEditing = editingId === msg.id;

            return (
              <div
                key={msg.id}
                data-message-id={msg.id}
                className={`group ${hoverBg} px-4 ${showAvatar ? 'pt-2 pb-1' : 'py-0.5'} -mx-4 flex gap-4 relative transition-colors duration-300 ${
                  highlightedMsgId === msg.id
                    ? isDark ? 'bg-[#f0b132]/10' : 'bg-[#f0b132]/20'
                    : ''
                }`}
                onContextMenu={(e) => {
                  if (msg.deleted) return;
                  e.preventDefault();
                  // Adjust position so menu doesn't overflow the right/bottom edge
                  const x = Math.min(e.clientX, window.innerWidth - 200);
                  const y = Math.min(e.clientY, window.innerHeight - 60);
                  setContextMenu({ msgId: msg.id, x, y });
                }}
              >
                {/* Avatar column */}
                {showAvatar ? (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: msg.authorColor }}
                  >
                    {msg.authorAvatar}
                  </div>
                ) : (
                  <div className="w-10 flex-shrink-0 flex items-center justify-center">
                    <span
                      className={`${textMuted} text-[11px] opacity-0 group-hover:opacity-100 transition-opacity`}
                    >
                      {msg.timestamp.split(', ')[1]}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {showAvatar && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`${textPrimary} font-semibold cursor-pointer hover:underline`}>
                        {msg.authorName}
                      </span>
                      {(() => {
                        const role = members.find(m => m.userId === msg.authorId)?.role;
                        if (role === 'admin') return <ShieldAlert aria-label="Admin" className="w-4 h-4 text-[#ed4245] flex-shrink-0" />;
                        if (role === 'moderator') return <ShieldCheck aria-label="Moderator" className="w-4 h-4 text-[#5865f2] flex-shrink-0" />;
                        return null;
                      })()}
                      <span className={`${textMuted} text-xs`}>{msg.timestamp}</span>
                    </div>
                  )}

                  {msg.deleted ? (
                    <p className={`${textMuted} text-[15px] leading-[1.375rem] italic`}>
                      This message has been deleted.
                    </p>
                  ) : isEditing ? (
                    <div>
                      <div className={`flex items-center gap-2 ${editBg} rounded px-3 py-2`}>
                        <input
                          value={editingContent}
                          onChange={e => setEditingContent(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit();
                            }
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className={`flex-1 bg-transparent outline-none ${textBody} text-[15px]`}
                          autoFocus
                        />
                        <SmilePlus className={`w-5 h-5 ${textMuted} cursor-pointer`} />
                        <button
                          onClick={saveEdit}
                          className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-3 py-1 rounded text-sm font-medium transition-colors flex-shrink-0"
                        >
                          Save
                        </button>
                      </div>
                      <p className={`${textMuted} text-xs mt-0.5`}>
                        Press escape to cancel, enter to save
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className={`${textBody} text-[15px] leading-[1.375rem]`}>
                        {msg.content}
                        {msg.edited && (
                          <span className={`${textMuted} text-xs ml-1`}>(edited)</span>
                        )}
                      </p>
                      {msg.files.map(f => (
                        <AttachmentDisplay key={f.id} file={f} isDark={isDark} />
                      ))}
                    </>
                  )}
                </div>

                {/* Hover action buttons */}
                {!msg.deleted && !isEditing && (
                  <div
                    className={`absolute right-4 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ${actionsPanel} border rounded-md shadow-md`}
                  >
                    {isOwn && (
                      <button
                        onClick={() => startEdit(msg)}
                        className={`p-1.5 ${textMuted} hover:text-[#5865f2] transition-colors`}
                        title="Edit message"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {(isOwn || myRole === 'admin' || myRole === 'moderator') && (
                      <button
                        onClick={() => setDeleteModalMsgId(msg.id)}
                        className={`p-1.5 ${textMuted} hover:text-[#f23f42] transition-colors`}
                        title="Delete message"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Failed messages */}
        {failedMessages.length > 0 && (
          <div className="space-y-0.5 mt-0.5">
            {failedMessages.map(fm => (
              <div key={fm.id} className="px-4 pt-2 pb-1 -mx-4 flex gap-4 bg-[#ed4245]/10">
                {/* Avatar placeholder — red ! */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ed4245] flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${isDark ? 'text-[#f8f9fa]' : 'text-[#2e3035]'} text-[15px] leading-[1.375rem] opacity-50`}>
                    {fm.content}
                  </p>
                  <p className="text-[#ed4245] text-xs italic mt-0.5">
                    Can&apos;t send message. Please try again later.
                  </p>
                </div>
                <button
                  onClick={() => setFailedMessages(prev => prev.filter(m => m.id !== fm.id))}
                  className="text-[#ed4245] hover:text-[#c03537] transition-colors flex-shrink-0 self-start mt-1"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-6 flex-shrink-0">
        <div className={`${inputBg} rounded-lg px-4 py-3`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAttachmentOpen(true)}
              className={`${textMuted} ${hoverIconMuted} transition-colors flex-shrink-0`}
              title="Add attachment"
            >
              <Plus className="w-6 h-6" />
            </button>
            <input
              type="text"
              placeholder={`Message #${channel.name}`}
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`flex-1 bg-transparent outline-none ${textBody} ${isDark ? 'placeholder:text-[#6d6f78]' : 'placeholder:text-[#747f8d]'}`}
            />
            <div className="flex items-center gap-2">
              <Gift className={`w-5 h-5 ${textMuted} ${hoverIconMuted} cursor-pointer transition-colors`} />
              <Sticker className={`w-5 h-5 ${textMuted} ${hoverIconMuted} cursor-pointer transition-colors`} />
              <SmilePlus className={`w-5 h-5 ${textMuted} ${hoverIconMuted} cursor-pointer transition-colors`} />
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteModalMsgId && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setDeleteModalMsgId(null)}
        >
          <div
            className="bg-white rounded-lg w-[440px] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setDeleteModalMsgId(null)}
                  className="text-[#4e5058] hover:text-[#1e1f22] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-center mb-2">
                <h3 className="text-[#313338] text-xl font-bold mb-3">Delete Message</h3>
                <p className="text-[#4e5058] text-sm">
                  Are you sure you want to do this?
                  <br />
                  The message will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="bg-[#f2f3f5] px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setDeleteModalMsgId(null)}
                className="text-[#4e5058] hover:text-[#313338] text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteMessage(deleteModalMsgId);
                  setDeleteModalMsgId(null);
                }}
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-5 py-2 rounded text-sm font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <AttachmentModal
        isOpen={isAttachmentOpen}
        onClose={() => setIsAttachmentOpen(false)}
        onSend={files => {
          handleSendFiles(files);
          setIsAttachmentOpen(false);
        }}
      />
      </div>{/* end main chat column */}

      {/* Members panel */}
      {isMembersOpen && (
        <div className={`w-60 flex-shrink-0 flex flex-col border-l ${isDark ? 'bg-[#2b2d31] border-[#1e1f22]' : 'bg-[#f2f3f5] border-[#e3e5e8]'}`}>
          <div className={`px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`}>
            Members — {members.length}
          </div>
          <div className="flex-1 overflow-y-auto px-2">
            {members.map(member => (
              <div
                key={member.userId}
                className={`flex items-center gap-2 px-2 py-2 rounded group relative ${isDark ? 'hover:bg-[#35363c]' : 'hover:bg-[#e0e1e5]'}`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {member.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium truncate ${isDark ? 'text-[#dbdee1]' : 'text-[#2e3338]'}`}>
                      {member.username}
                    </span>
                    {member.role === 'admin' && <ShieldAlert className="w-3.5 h-3.5 text-[#ed4245] flex-shrink-0" />}
                    {member.role === 'moderator' && <ShieldCheck className="w-3.5 h-3.5 text-[#5865f2] flex-shrink-0" />}
                  </div>
                  <span className={`text-xs capitalize ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`}>
                    {member.role}
                  </span>
                </div>

                {/* Role selector — chỉ admin mới thấy */}
                {myRole === 'admin' && member.userId !== currentUserId && (
                  <div className="relative">
                    <button
                      onClick={() => setOpenRoleMenuId(openRoleMenuId === member.userId ? null : member.userId)}
                      className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'hover:bg-[#5a5d68] text-[#949ba4]' : 'hover:bg-[#c5c8cc] text-[#5c5f66]'}`}
                      title="Change role"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {openRoleMenuId === member.userId && (
                      <div className={`absolute right-0 top-full mt-1 rounded-md shadow-lg py-1 z-50 min-w-[140px] ${isDark ? 'bg-[#111214]' : 'bg-white border border-[#e3e5e8]'}`}>
                        {(['admin', 'moderator', 'guest'] as MemberRole[]).map(r => (
                          <button
                            key={r}
                            onClick={() => { onSetMemberRole(member.userId, r); setOpenRoleMenuId(null); }}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                              member.role === r
                                ? (isDark ? 'text-white' : 'text-[#2e3338]')
                                : (isDark ? 'text-[#949ba4] hover:bg-[#35363c] hover:text-white' : 'text-[#5c5f66] hover:bg-[#f2f3f5] hover:text-[#2e3338]')
                            }`}
                          >
                            {r === 'admin' && <ShieldAlert className="w-4 h-4 text-[#ed4245]" />}
                            {r === 'moderator' && <ShieldCheck className="w-4 h-4 text-[#5865f2]" />}
                            {r === 'guest' && <div className="w-4 h-4" />}
                            <span className="capitalize">{r}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Right-click context menu */}
    {contextMenu && createPortal(
      <div
        className="fixed z-[300] rounded-md shadow-xl py-1 min-w-[180px]"
        style={{
          top: contextMenu.y,
          left: contextMenu.x,
          background: isDark ? '#111214' : '#fff',
          border: `1px solid ${isDark ? '#2e3035' : '#e3e5e8'}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => { handlePinMessage(contextMenu.msgId); setContextMenu(null); }}
          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-[#f0b132] hover:bg-[#f0b132] hover:text-white transition-colors rounded-sm mx-0.5"
        >
          <Pin className="w-4 h-4" />
          Pin Message
        </button>
      </div>,
      document.body,
    )}
    </>
  );
}

// ─── Pin icon with panel ─────────────────────────────────────────────────────
function PinIconWithPanel({
  pinnedMessages,
  showPinPanel,
  setShowPinPanel,
  textMuted,
  hoverIconMuted,
  isDark,
  onScrollToMessage,
}: {
  pinnedMessages: PinnedMessage[];
  showPinPanel: boolean;
  setShowPinPanel: (v: boolean | ((p: boolean) => boolean)) => void;
  textMuted: string;
  hoverIconMuted: string;
  isDark: boolean;
  onSeePins: () => void;
  onScrollToMessage: (messageId: string) => void;
}) {
  return (
    <div className="relative">
      <div
        className="relative cursor-pointer"
        onClick={() => setShowPinPanel(v => !v)}
      >
        <Pin className={`w-5 h-5 ${textMuted} ${hoverIconMuted} transition-colors`} />
        {pinnedMessages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ed4245] rounded-full border-2 border-[#313338]" />
        )}
      </div>
      {showPinPanel && (
        <div
          className="absolute right-0 top-full mt-2 w-96 rounded-lg shadow-xl z-[200]"
          style={{
            background: isDark ? '#2b2d31' : '#f2f3f5',
            border: `1px solid ${isDark ? '#1e1f22' : '#e3e5e8'}`,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${isDark ? '#1e1f22' : '#e3e5e8'}` }}
          >
            <div className="flex items-center gap-2">
              <Pin className={`w-4 h-4 ${isDark ? 'text-[#b5bac1]' : 'text-[#4e5058]'}`} />
              <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-[#2e3338]'}`}>
                Pinned Messages
              </span>
            </div>
            <button
              onClick={() => setShowPinPanel(false)}
              className={`${isDark ? 'text-[#b5bac1] hover:text-white' : 'text-[#4e5058] hover:text-[#2e3338]'} transition-colors`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Body */}
          {pinnedMessages.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Pin className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-[#4e5058]' : 'text-[#c1c4c9]'}`} />
              <p className={`text-sm ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`}>
                No pinned messages yet.
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-[#6d6f78]' : 'text-[#87909b]'}`}>
                Right-click a message to pin it.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y"
              style={{ borderColor: isDark ? '#1e1f22' : '#e3e5e8' }}
            >
              {pinnedMessages.map(pin => (
                <div
                  key={pin.id}
                  className={`px-4 py-3 cursor-pointer ${isDark ? 'hover:bg-[#35373c]' : 'hover:bg-[#e6e8eb]'} transition-colors`}
                  onClick={() => onScrollToMessage(pin.messageId)}
                  title="Click to jump to message"
                >
                  <div className="flex items-start gap-2">
                    <Pin className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#2e3338]'}`}>
                          {pin.authorName}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]'}`}>{pin.createdAt}</span>
                      </div>
                      <p className={`text-sm leading-snug break-words ${isDark ? 'text-[#dbdee1]' : 'text-[#2e3338]'}`}>
                        {pin.content}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-[#6d6f78]' : 'text-[#87909b]'}`}>
                        Pinned by {pin.pinnedByName}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentDisplay({ file, isDark }: { file: FileAttachment; isDark: boolean }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

  const handleDownload = async () => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      a.target = '_blank';
      a.click();
    }
  };

  if (file.fileType === 'image') {
    return (
      <>
        <div className="mt-2 max-w-sm relative group/img">
          <img
            src={file.url}
            alt={file.name}
            className="rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setLightboxOpen(true)}
          />
          <button
            onClick={handleDownload}
            title="Download image"
            className="absolute bottom-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {lightboxOpen && createPortal(
          <div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999]"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-[85vh] object-contain rounded"
              />
              <p className="text-white/60 text-sm mt-2">{file.name}</p>
              <div className="absolute top-0 right-0 flex gap-2">
                <button
                  onClick={handleDownload}
                  title="Upload image"
                  className="bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-colors"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setLightboxOpen(false)}
                  title="Close"
                  className="bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div
      className={`mt-2 flex items-center gap-3 ${
        isDark ? 'bg-[#2b2d31]' : 'bg-[#f2f3f5]'
      } rounded-lg px-3 py-2 max-w-sm`}
    >
      <FileText className="w-8 h-8 text-[#5865f2] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p
          className={`${
            isDark ? 'text-[#00aff4]' : 'text-[#0068e0]'
          } text-sm truncate`}
        >
          {file.name}
        </p>
        <p className={`${isDark ? 'text-[#949ba4]' : 'text-[#747f8d]'} text-xs`}>PDF Document</p>
      </div>
      <button
        onClick={handleDownload}
        title="Upload file"
        className={`flex-shrink-0 p-1.5 rounded transition-colors ${
          isDark ? 'text-[#949ba4] hover:text-white hover:bg-[#5a5d68]' : 'text-[#747f8d] hover:text-[#2e3338] hover:bg-[#d4d7dc]'
        }`}
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}
