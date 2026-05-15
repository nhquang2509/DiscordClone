'use client';

import { X, ChevronDown, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Channel } from '@/types';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, type: Channel['type']) => void;
  defaultType?: Channel['type'];
}

const TYPE_OPTIONS: { value: Channel['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
];

export function CreateChannelModal({
  isOpen,
  onClose,
  onCreate,
  defaultType = 'text',
}: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Channel['type']>(defaultType);
  const [isTypeOpen, setIsTypeOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setType(defaultType);
      setIsTypeOpen(false);
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim().toLowerCase().replace(/\s+/g, '-'), type);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-[460px] relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#4e5058] hover:text-[#1e1f22] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-[#313338] text-2xl font-bold mb-6 text-center">Create Channel</h2>

          <div className="mb-5">
            <label className="block text-[#313338] text-xs font-bold uppercase tracking-wide mb-2">
              Channel Name
            </label>
            <input
              type="text"
              placeholder="Enter channel name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
              }}
              className="w-full bg-[#e3e5e8] text-[#313338] px-3 py-2.5 rounded outline-none placeholder:text-[#87898c] focus:ring-2 focus:ring-[#5865f2]"
              autoFocus
            />
          </div>

          <div className="mb-2">
            <label className="block text-[#313338] text-sm font-semibold mb-2">Channel Type</label>
            <div className="relative">
              <button
                onClick={() => setIsTypeOpen(o => !o)}
                className="w-full bg-[#e3e5e8] text-[#313338] px-3 py-2.5 rounded flex items-center justify-between hover:bg-[#d5d7dc] transition-colors"
              >
                <span>{TYPE_OPTIONS.find(o => o.value === type)?.label}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {isTypeOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1f22] rounded-md shadow-xl z-10 overflow-hidden">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setType(opt.value);
                        setIsTypeOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                        type === opt.value
                          ? 'bg-[#35363c] text-white'
                          : 'text-[#b5bac1] hover:bg-[#2e3035] hover:text-white'
                      }`}
                    >
                      {type === opt.value ? (
                        <Check className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <span className="w-4" />
                      )}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#f2f3f5] px-6 py-4 flex justify-end">
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="bg-[#5865f2] text-white px-6 py-2.5 rounded hover:bg-[#4752c4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
