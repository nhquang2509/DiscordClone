import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { ChatArea } from './components/ChatArea';
import { AuthPage } from './components/AuthPage';
import { ManageMembersModal } from './components/ManageMembersModal';
import { ServerSettingsModal } from './components/ServerSettingsModal';
import { useState, createContext, useContext, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useServers } from '../hooks/useServers';
import { useChannels } from '../hooks/useChannels';
import { useMessages } from '../hooks/useMessages';
import { useServerMembers } from '../hooks/useServerMembers';
import { useDmInvitations } from '../hooks/useDmInvitations';
import { supabase } from '../lib/supabase/client';
export type { MemberRole } from '../hooks/useServerMembers';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeCtx {
  resolvedTheme: 'dark' | 'light';
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const ThemeContext = createContext<ThemeCtx>({
  resolvedTheme: 'dark',
  theme: 'dark',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'audio' | 'video' | 'members';
}

export interface FileAttachment {
  id: string;
  name: string;
  fileType: 'image' | 'pdf';
  url: string;
}

export interface Message {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorColor: string;
  timestamp: string;
  content: string;
  deleted: boolean;
  edited: boolean;
  files: FileAttachment[];
}

export interface Server {
  id: string;
  name: string;
  image: string | null;
  invite_code: string | null;
}

export const CURRENT_USER = {
  id: 'user-antonio',
  name: 'Antonio',
  avatar: 'A',
  color: '#5865f2',
};

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [theme, setTheme] = useState<Theme>('dark');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Record<string, string | null>>({});
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [manageMembersReadOnly, setManageMembersReadOnly] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);

  // Derived user info
  const displayName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'User';
  const authorColor = '#5865f2';

  // Supabase hooks (devem ser chamados antes dos early returns)
  const {
    servers,
    loading: serversLoading,
    createServer,
    deleteServer,
    generateInviteCode,
    joinServerByInvite,
    quitServer,
    updateServer,
  } = useServers(user);
  const currentChannelId = selectedServerId ? (selectedChannelIds[selectedServerId] ?? null) : null;
  const { channels, createChannel, deleteChannel, renameChannel } = useChannels(selectedServerId);
  const { messages, sendMessage, deleteMessage: deleteMsg, editMessage, loadMore, hasMore, isLoadingMore } = useMessages(currentChannelId);  const { members, myRole, setMemberRole, kickMember, serverNotifications, clearServerNotifications } = useServerMembers(selectedServerId, user?.id ?? null);
  const { dmChannelMap, pendingInvitations, createDmChannel, acceptInvitation } =
    useDmInvitations(selectedServerId, user?.id ?? null);
  const resolvedTheme: 'dark' | 'light' =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  const isDark = resolvedTheme === 'dark';

  // Lưu invite code khi chưa đăng nhập (để xử lý sau khi login)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('invite');
    if (code) {
      sessionStorage.setItem('pendingInvite', code);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Xử lý invite khi user đăng nhập
  useEffect(() => {
    if (!user) return;
    const code =
      sessionStorage.getItem('pendingInvite') ||
      new URLSearchParams(window.location.search).get('invite');
    if (!code) return;
    sessionStorage.removeItem('pendingInvite');
    window.history.replaceState({}, '', window.location.pathname);
    joinServerByInvite(code).then(server => {
      if (server) setSelectedServerId(server.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCreateDm = async (member: { userId: string; username: string }) => {
    if (!selectedServerId || !user) return;
    const channelId = await createDmChannel({
      serverId: selectedServerId,
      inviterId: user.id,
      inviterName: displayName,
      inviteeId: member.userId,
      inviteeName: member.username,
    });
    if (channelId) {
      setSelectedChannelIds(prev => ({ ...prev, [selectedServerId]: channelId }));
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    const channelId = await acceptInvitation(invitationId);
    if (channelId && selectedServerId) {
      setSelectedChannelIds(prev => ({ ...prev, [selectedServerId]: channelId }));
    }
  };

  const handleQuitServer = async (serverId: string) => {
    const remaining = servers.filter(s => s.id !== serverId);
    await quitServer(serverId, user!.id);
    if (selectedServerId === serverId) {
      setSelectedServerId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const handleCreateServer = async (name: string, image: string | null) => {
    const server = await createServer(name, image);
    if (server) {
      // Tạo channel general mặc định
      const { data: generalChannel } = await supabase
        .from('channels')
        .insert({ server_id: server.id, name: 'general', type: 'text' })
        .select('id, name, type')
        .single();
      // Đăng ký người tạo là admin
      await supabase
        .from('server_members')
        .insert({ server_id: server.id, user_id: user!.id, username: displayName, role: 'admin' });
      setSelectedServerId(server.id);
      setSelectedChannelIds(prev => ({
        ...prev,
        [server.id]: generalChannel ? generalChannel.id : null,
      }));
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    const remaining = servers.filter(s => s.id !== serverId);
    await deleteServer(serverId);
    if (selectedServerId === serverId) {
      setSelectedServerId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const handleCreateChannel = async (serverId: string, name: string, type: Channel['type']) => {
    const channel = await createChannel(name, type);
    if (channel) {
      setSelectedChannelIds(prev => ({ ...prev, [serverId]: channel.id }));
    }
  };

  const handleDeleteChannel = async (serverId: string, channelId: string) => {
    const remaining = channels.filter(c => c.id !== channelId);
    await deleteChannel(channelId);
    if (selectedChannelIds[serverId] === channelId) {
      setSelectedChannelIds(prev => ({
        ...prev,
        [serverId]: remaining.length > 0 ? remaining[0].id : null,
      }));
    }
  };

  const handleRenameChannel = async (_serverId: string, channelId: string, newName: string) => {
    await renameChannel(channelId, newName);
  };

  const handleSendMessage = async (_channelId: string, content: string, files: FileAttachment[]): Promise<boolean> => {
    return sendMessage(user!.id, displayName, authorColor, content, files);
  };

  const handleDeleteMessage = async (_channelId: string, messageId: string) => {
    await deleteMsg(messageId);
  };

  const handleEditMessage = async (_channelId: string, messageId: string, content: string) => {
    await editMessage(messageId, content);
  };

  // Auth gate
  if (authLoading || serversLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#313338]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#5865f2]" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthPage />
        <Toaster richColors position="top-center" />
      </>
    );
  }

  const currentServer = servers.find(s => s.id === selectedServerId) ?? null;
  const currentChannel = channels.find(c => c.id === currentChannelId) ?? null;

  return (
    <ThemeContext.Provider value={{ resolvedTheme, theme, setTheme }}>
      <Toaster richColors position="top-center" />
      <div className={`size-full flex ${isDark ? 'bg-[#313338]' : 'bg-[#f2f3f5]'}`}>
        <ServerSidebar
          servers={servers}
          selectedServerId={selectedServerId}
          onSelectServer={setSelectedServerId}
          onCreateServer={handleCreateServer}
          user={user}
          onSignOut={signOut}
        />
        {currentServer ? (
          <>
            <ChannelSidebar
              serverName={currentServer.name}
              channels={channels}
              selectedChannelId={currentChannelId}
              onSelectChannel={id =>
                setSelectedChannelIds(prev => ({ ...prev, [currentServer.id]: id }))
              }
              onCreateChannel={(name, type) => handleCreateChannel(currentServer.id, name, type)}
              onDeleteChannel={id => handleDeleteChannel(currentServer.id, id)}
              onRenameChannel={(id, name) => handleRenameChannel(currentServer.id, id, name)}
              onDeleteServer={() => handleDeleteServer(currentServer.id)}
              myRole={myRole}
              onQuitServer={() => handleQuitServer(currentServer.id)}
              onServerSettings={() => setIsServerSettingsOpen(true)}
              inviteCode={currentServer.invite_code}
              onGenerateInviteCode={() => generateInviteCode(currentServer.id)}
              onManageMembers={() => { setIsManageMembersOpen(true); setManageMembersReadOnly(false); }}
              onMemberList={() => { setIsManageMembersOpen(true); setManageMembersReadOnly(true); }}
              members={members}
              currentUserId={user.id}
              dmChannelMap={dmChannelMap}
              pendingInvitations={pendingInvitations}
              onCreateDm={handleCreateDm}
              onAcceptInvitation={handleAcceptInvitation}
            />
            <ManageMembersModal
              isOpen={isManageMembersOpen}
              onClose={() => setIsManageMembersOpen(false)}
              members={members}
              myRole={myRole}
              currentUserId={user.id}
              onSetRole={setMemberRole}
              onKick={kickMember}
              readOnly={manageMembersReadOnly}
            />
            <ServerSettingsModal
              isOpen={isServerSettingsOpen}
              onClose={() => setIsServerSettingsOpen(false)}
              serverName={currentServer.name}
              serverImage={currentServer.image}
              members={members}
              onUpdateServer={(name, image) => updateServer(currentServer.id, name, image)}
            />
            <ChatArea
              channel={currentChannel}
              messages={messages}
              currentUserId={user!.id}
              currentUsername={displayName}
              members={members}
              myRole={myRole}
              onSetMemberRole={setMemberRole}
              loadMore={loadMore}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              joinNotifications={serverNotifications}
              clearJoinNotifications={clearServerNotifications}
              onSendMessage={(content, files) =>
                currentChannelId ? handleSendMessage(currentChannelId, content, files) : Promise.resolve(false)
              }
              onDeleteMessage={id =>
                currentChannelId && handleDeleteMessage(currentChannelId, id)
              }
              onEditMessage={(id, content) =>
                currentChannelId && handleEditMessage(currentChannelId, id, content)
              }
            />
          </>
        ) : (
          <div
            className={`flex-1 flex items-center justify-center ${
              isDark ? 'text-[#949ba4]' : 'text-[#4f5660]'
            }`}
          >
            <div className="text-center">
              <div className="text-5xl mb-4">👋</div>
              <p className="text-xl">Create or select a server to get started</p>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}
