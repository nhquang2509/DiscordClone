'use client';

import { X, Upload, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import type { ServerMember } from '../../hooks/useServerMembers';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  serverImage: string | null;
  members: ServerMember[];
  onUpdateServer: (name: string, image: string | null) => Promise<boolean>;
}

export function ServerSettingsModal({
  isOpen,
  onClose,
  serverName,
  serverImage,
  members,
  onUpdateServer,
}: ServerSettingsModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [name, setName] = useState(serverName);
  const [image, setImage] = useState<string | null>(serverImage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(serverName);
      setImage(serverImage);
      setError(null);
      setSaved(false);
    }
  }, [isOpen, serverName, serverImage]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be smaller than 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    const success = await onUpdateServer(name.trim(), image);
    setSaving(false);
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError('Failed to save. Please try again.');
    }
  };

  const isDirty = name.trim() !== serverName || image !== serverImage;

  // Theme tokens
  const overlayBg = 'bg-black/70';
  const modalBg = isDark ? 'bg-[#313338]' : 'bg-white';
  const sidebarBg = isDark ? 'bg-[#2b2d31]' : 'bg-[#f2f3f5]';
  const textPrimary = isDark ? 'text-white' : 'text-[#2e3338]';
  const textMuted = isDark ? 'text-[#949ba4]' : 'text-[#5c5f66]';
  const inputBg = isDark ? 'bg-[#1e1f22] text-white placeholder:text-[#6d6f78]' : 'bg-[#e3e5e8] text-[#313338] placeholder:text-[#87898c]';
  const borderColor = isDark ? 'border-[#3f4147]' : 'border-[#e3e5e8]';
  const sectionLabel = `text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? 'text-[#b5bac1]' : 'text-[#4e5058]'}`;

  return (
    <div
      className={`fixed inset-0 ${overlayBg} flex items-center justify-center z-50`}
      onClick={onClose}
    >
      <div
        className={`${modalBg} rounded-lg w-[580px] max-h-[85vh] flex overflow-hidden shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {/* Left nav */}
        <div className={`w-48 ${sidebarBg} p-4 flex flex-col gap-0.5 flex-shrink-0`}>
          <p className={`text-xs font-bold uppercase tracking-wide ${textMuted} px-2 mb-1`}>
            Server Settings
          </p>
          <button
            className={`w-full text-left px-2 py-1.5 rounded text-sm font-medium ${textPrimary} bg-[#5865f2]/20 text-[#5865f2]`}
          >
            Overview
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-bold ${textPrimary}`}>Server Overview</h2>
            <button
              onClick={onClose}
              className={`${textMuted} hover:${textPrimary} transition-colors`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Server image + name row */}
          <div className="flex items-start gap-6 mb-6">
            {/* Image picker */}
            <div className="flex-shrink-0">
              <p className={sectionLabel}>Server Icon</p>
              <input
                type="file"
                id="settings-server-image"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="settings-server-image"
                className="block w-24 h-24 rounded-full cursor-pointer overflow-hidden relative group"
              >
                {image ? (
                  <img
                    src={image}
                    alt="Server icon"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#5865f2] flex items-center justify-center text-white font-bold text-3xl">
                    {serverName.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Upload className="w-5 h-5 text-white mb-0.5" />
                  <span className="text-white text-[10px] font-medium">Change</span>
                </div>
              </label>
              {image && (
                <button
                  onClick={() => setImage(null)}
                  className="mt-1.5 text-xs text-[#ed4245] hover:text-[#c03537] transition-colors w-full text-center"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Name input */}
            <div className="flex-1">
              <label className={sectionLabel}>Server Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                className={`w-full ${inputBg} px-3 py-2.5 rounded outline-none focus:ring-2 focus:ring-[#5865f2] transition-shadow text-sm`}
              />
              <p className={`mt-1 text-xs ${textMuted}`}>{name.length}/100</p>
            </div>
          </div>

          {/* Divider */}
          <div className={`h-px ${isDark ? 'bg-[#3f4147]' : 'bg-[#e3e5e8]'} mb-6`} />

          {/* Member count */}
          <div className="mb-6">
            <p className={sectionLabel}>Members</p>
            <div className={`flex items-center gap-3 p-4 rounded-lg ${isDark ? 'bg-[#2b2d31]' : 'bg-[#f2f3f5]'}`}>
              <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${textPrimary}`}>{members.length}</p>
                <p className={`text-xs ${textMuted}`}>
                  {members.length === 1 ? '1 member' : `${members.length} members`}
                </p>
              </div>
              <div className="ml-auto flex gap-3 text-sm">
                <div className="text-center">
                  <p className={`font-semibold ${textPrimary}`}>
                    {members.filter(m => m.role === 'admin').length}
                  </p>
                  <p className={`text-xs ${textMuted}`}>Admin</p>
                </div>
                <div className="text-center">
                  <p className={`font-semibold ${textPrimary}`}>
                    {members.filter(m => m.role === 'moderator').length}
                  </p>
                  <p className={`text-xs ${textMuted}`}>Mod</p>
                </div>
                <div className="text-center">
                  <p className={`font-semibold ${textPrimary}`}>
                    {members.filter(m => m.role === 'guest').length}
                  </p>
                  <p className={`text-xs ${textMuted}`}>Guest</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[#ed4245] text-sm mb-4">{error}</p>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium ${textMuted} hover:${textPrimary} transition-colors`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving || !name.trim()}
              className={`px-5 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                saved
                  ? 'bg-[#248046] hover:bg-[#1a6035]'
                  : 'bg-[#5865f2] hover:bg-[#4752c4]'
              }`}
            >
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
