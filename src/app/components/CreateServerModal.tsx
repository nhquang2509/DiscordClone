'use client';

import { X, Upload } from 'lucide-react';
import { useState } from 'react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateServer: (name: string, image: string | null) => void;
}

export function CreateServerModal({ isOpen, onClose, onCreateServer }: CreateServerModalProps) {
  const [serverName, setServerName] = useState('');
  const [serverImage, setServerImage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setServerImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = () => {
    if (serverName.trim()) {
      onCreateServer(serverName, serverImage);
      setServerName('');
      setServerImage(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-[440px] p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#4e5058] hover:text-[#1e1f22] transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-[#313338] text-2xl font-bold mb-2">Customize your server</h2>
          <p className="text-[#4e5058] text-sm">
            Give your server a personality with a name and an icon. You can always change it later.
          </p>
        </div>

        <div className="mb-6">
          <input
            type="file"
            id="server-image"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <label
            htmlFor="server-image"
            className="border-2 border-dashed border-[#d0d0d0] rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#5865f2] transition-colors"
          >
            {serverImage ? (
              <img src={serverImage} alt="Server" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <>
                <div className="w-16 h-16 bg-[#d0d0d0] rounded-full flex items-center justify-center mb-2">
                  <Upload className="w-8 h-8 text-[#7a7d85]" />
                </div>
                <p className="text-[#5865f2] text-sm font-medium">Choose files or drag and drop</p>
                <p className="text-[#7a7d85] text-xs">Image (4MB)</p>
              </>
            )}
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-[#313338] text-xs font-bold uppercase mb-2">
            Server Name
          </label>
          <input
            type="text"
            placeholder="Enter server name"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="w-full bg-[#e3e5e8] text-[#313338] px-3 py-2.5 rounded outline-none focus:outline-none placeholder:text-[#87898c]"
          />
        </div>

        <div className="bg-[#f2f3f5] -mx-6 -mb-6 px-6 py-4 rounded-b-lg flex justify-end">
          <button
            onClick={handleCreate}
            disabled={!serverName.trim()}
            className="bg-[#5865f2] text-white px-8 py-2.5 rounded hover:bg-[#4752c4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
