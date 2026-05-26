'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useServerContext } from '@/lib/server-context';

export default function ServerPage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.serverId as string;
  const { channels } = useServerContext();

  useEffect(() => {
    if (channels.length > 0) {
      router.replace(`/channels/${serverId}/${channels[0].id}`);
    }
  }, [channels, serverId, router]);

  return (
    <div className="flex-1 flex items-center justify-center text-[#949ba4]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#5865f2]" />
    </div>
  );
}
