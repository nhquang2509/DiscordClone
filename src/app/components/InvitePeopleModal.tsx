'use client';

import { X, Copy, RefreshCw, Check } from 'lucide-react';
import { useState } from 'react';
import type { MemberRole } from '../../hooks/useServerMembers';

interface InvitePeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  inviteCode: string | null;
  myRole: MemberRole;
  onGenerateInviteCode: () => Promise<string | null>;
}

export function InvitePeopleModal({
  isOpen,
  onClose,
  serverName,
  inviteCode,
  myRole,
  onGenerateInviteCode,
}: InvitePeopleModalProps) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const inviteUrl = inviteCode
    ? `${window.location.origin}${window.location.pathname}?invite=${inviteCode}`
    : '';

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateNew = async () => {
    setIsGenerating(true);
    await onGenerateInviteCode();
    setIsGenerating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-[440px] p-6 relative" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#4e5058] hover:text-[#1e1f22] transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-[#313338] text-2xl font-bold">Invite Friends</h2>
          <p className="text-[#4e5058] text-sm mt-1">to <span className="font-semibold">{serverName}</span></p>
        </div>

        <div className="mb-4">
          <label className="block text-[#4e5058] text-xs font-bold uppercase mb-2">
            Server Invite Link
          </label>
          {inviteUrl ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#e3e5e8] text-[#313338] px-3 py-2.5 rounded text-sm truncate select-all">
                {inviteUrl}
              </div>
              <button
                onClick={handleCopy}
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white p-2.5 rounded transition-colors flex-shrink-0 flex items-center justify-center min-w-[44px]"
                title="Copy invite link"
              >
                {copied ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          ) : (
            <p className="text-[#4e5058] text-sm">No invite link available.</p>
          )}
        </div>

        {myRole === 'admin' && (
          <button
            onClick={handleGenerateNew}
            disabled={isGenerating}
            className="flex items-center gap-2 text-[#4e5058] hover:text-[#313338] text-sm transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating…' : 'Generate a new link'}</span>
          </button>
        )}

        {myRole !== 'admin' && (
          <p className="text-[#4e5058] text-xs mt-1">Only admins can generate a new invite link.</p>
        )}
      </div>
    </div>
  );
}
