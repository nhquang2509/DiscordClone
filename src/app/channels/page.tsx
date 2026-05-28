'use client';

import { useTheme } from '@/lib/theme-context';
import { useDiscord } from '@/lib/discord-context';
import { useRouter } from 'next/navigation';

export default function ChannelsPage() {
  const { resolvedTheme } = useTheme();
  const { user } = useDiscord();
  const router = useRouter();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={`flex-1 flex items-center justify-center ${
        isDark ? 'text-[#949ba4]' : 'text-[#4f5660]'
      }`}
    >
      <div className="text-center">
        {user ? (
          <>
            <div className="text-5xl mb-4">👋</div>
            <p className="text-xl">Create or select a server to get started</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">👋</div>
            <p className="text-xl mb-4">Login to get started</p>
            <button
              onClick={() => router.push('/auth')}
              className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-md text-sm font-semibold transition-colors duration-200"
            >
              Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
