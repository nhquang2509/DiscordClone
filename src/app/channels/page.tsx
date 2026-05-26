'use client';

import { useTheme } from '@/lib/theme-context';

export default function ChannelsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
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
  );
}
