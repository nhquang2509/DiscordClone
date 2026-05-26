'use client';

import { useParams } from 'next/navigation';
import { useMessages } from '@/hooks/useMessages';
import { useDiscord } from '@/lib/discord-context';
import { useServerContext } from '@/lib/server-context';
import { ChatArea } from '@/app/components/ChatArea';
import type { FileAttachment } from '@/types';

const AUTHOR_COLOR = '#5865f2';

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const serverId = params.serverId as string;

  const { user, displayName } = useDiscord();
  const {
    channels,
    members,
    myRole,
    setMemberRole,
    dmChannelMap,
    serverNotifications,
    clearServerNotifications,
  } = useServerContext();

  const { messages, sendMessage, deleteMessage, editMessage, loadMore, hasMore, isLoadingMore } =
    useMessages(channelId);

  const currentChannel = channels.find((c) => c.id === channelId) ?? null;

  const handleSendMessage = async (content: string, files: FileAttachment[]): Promise<boolean> => {
    if (!user) return false;
    return sendMessage(user.id, displayName, AUTHOR_COLOR, content, files);
  };

  return (
    <ChatArea
      channel={currentChannel}
      messages={messages}
      currentUserId={user?.id ?? ''}
      currentUsername={displayName}
      members={members}
      myRole={myRole}
      onSetMemberRole={setMemberRole}
      loadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      joinNotifications={serverNotifications}
      clearJoinNotifications={clearServerNotifications}
      partnerName={
        currentChannel?.type === 'members' ? dmChannelMap[channelId]?.partnerName : undefined
      }
      onSendMessage={handleSendMessage}
      onDeleteMessage={(id) => deleteMessage(id)}
      onEditMessage={(id, content) => editMessage(id, content)}
    />
  );
}
