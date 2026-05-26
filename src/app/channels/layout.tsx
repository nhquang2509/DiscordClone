'use client';

import { useSelectedLayoutSegments, useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { DiscordProvider, useDiscord } from '@/lib/discord-context';
import { useTheme } from '@/lib/theme-context';
import { ServerSidebar } from '@/app/components/ServerSidebar';

function ChannelsLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSelectedLayoutSegments();
  const selectedServerId = segments[0] ?? null;

  const { user, authLoading, serversLoading, servers, signOut, createServer } = useDiscord();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (authLoading || serversLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#313338]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#5865f2]" />
      </div>
    );
  }

  return (
    <div className={`h-full w-full flex ${isDark ? 'bg-[#313338]' : 'bg-[#f2f3f5]'}`}>
      <Toaster richColors position="top-center" />
      <ServerSidebar
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={(id) => router.push(`/channels/${id}`)}
        onCreateServer={createServer}
        user={user}
        onSignOut={signOut}
      />
      {children}
    </div>
  );
}

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DiscordProvider>
      <ChannelsLayoutContent>{children}</ChannelsLayoutContent>
    </DiscordProvider>
  );
}
