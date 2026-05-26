'use client';

import { useParams, useSelectedLayoutSegments, useRouter } from 'next/navigation';
import { ServerProvider, useServerContext } from '@/lib/server-context';
import { useDiscord } from '@/lib/discord-context';
import { ChannelSidebar } from '@/app/components/ChannelSidebar';
import { ManageMembersModal } from '@/app/components/ManageMembersModal';
import { ServerSettingsModal } from '@/app/components/ServerSettingsModal';

function ServerLayoutContent({
  serverId,
  currentChannelId,
  children,
}: {
  serverId: string;
  currentChannelId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, servers, generateInviteCode, updateServer, deleteServer, quitServer } = useDiscord();
  const currentServer = servers.find((s) => s.id === serverId) ?? null;

  const {
    channels,
    members,
    myRole,
    dmChannelMap,
    pendingInvitations,
    unreadChannelIds,
    isManageMembersOpen,
    manageMembersReadOnly,
    isServerSettingsOpen,
    setIsManageMembersOpen,
    setManageMembersReadOnly,
    setIsServerSettingsOpen,
    setMemberRole,
    kickMember,
    createChannel,
    deleteChannel,
    renameChannel,
    onCreateDm,
    acceptInvitation,
  } = useServerContext();

  if (!currentServer) return null;

  return (
    <>
      <ChannelSidebar
        serverName={currentServer.name}
        channels={channels}
        selectedChannelId={currentChannelId}
        onSelectChannel={(id) => router.push(`/channels/${serverId}/${id}`)}
        onCreateChannel={(name, type) => createChannel(name, type)}
        onDeleteChannel={(id) => deleteChannel(id)}
        onRenameChannel={(id, name) => renameChannel(id, name)}
        onDeleteServer={() => deleteServer(serverId)}
        myRole={myRole}
        onQuitServer={() => quitServer(serverId)}
        onServerSettings={() => setIsServerSettingsOpen(true)}
        inviteCode={currentServer.invite_code}
        onGenerateInviteCode={() => generateInviteCode(serverId)}
        onManageMembers={() => {
          setIsManageMembersOpen(true);
          setManageMembersReadOnly(false);
        }}
        onMemberList={() => {
          setIsManageMembersOpen(true);
          setManageMembersReadOnly(true);
        }}
        members={members}
        currentUserId={user?.id ?? ''}
        dmChannelMap={dmChannelMap}
        pendingInvitations={pendingInvitations}
        onCreateDm={onCreateDm}
        onAcceptInvitation={acceptInvitation}
        unreadChannelIds={unreadChannelIds}
      />
      <ManageMembersModal
        isOpen={isManageMembersOpen}
        onClose={() => setIsManageMembersOpen(false)}
        members={members}
        myRole={myRole}
        currentUserId={user?.id ?? ''}
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
        onUpdateServer={(name, image) => updateServer(serverId, name, image)}
      />
      {children}
    </>
  );
}

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const segments = useSelectedLayoutSegments();
  const serverId = params.serverId as string;
  const currentChannelId = segments[0] ?? null;

  return (
    <ServerProvider serverId={serverId} currentChannelId={currentChannelId}>
      <ServerLayoutContent serverId={serverId} currentChannelId={currentChannelId}>
        {children}
      </ServerLayoutContent>
    </ServerProvider>
  );
}
