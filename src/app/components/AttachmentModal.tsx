'use client';

import { X, Upload, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { FileAttachment } from '@/types';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (files: FileAttachment[]) => void;
}

export function AttachmentModal({ isOpen, onClose, onSend }: AttachmentModalProps) {
  const [step, setStep] = useState<'choose' | 'preview'>('choose');
  const [selectedFiles, setSelectedFiles] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawFilesRef = useRef<Map<string, File>>(new Map());

  if (!isOpen) return null;

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: FileAttachment[] = Array.from(fileList).map(f => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      rawFilesRef.current.set(id, f);
      return {
        id,
        name: f.name,
        fileType: f.type.startsWith('image/') ? 'image' : 'pdf',
        url: URL.createObjectURL(f),
      };
    });
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedFiles.length > 0) setStep('preview');
  };

  const handleSend = async () => {
    if (selectedFiles.length === 0 || isUploading) return;
    setIsUploading(true);
    try {
      const uploaded = await Promise.all(
        selectedFiles.map(async (attachment) => {
          const rawFile = rawFilesRef.current.get(attachment.id);
          if (!rawFile) return attachment;
          const ext = rawFile.name.split('.').pop();
          const path = `${attachment.id}.${ext}`;
          const { error } = await supabase.storage
            .from('attachments')
            .upload(path, rawFile, { contentType: rawFile.type });
          if (error) return attachment; // fallback to blob URL on error
          const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(path);
          return { ...attachment, url: urlData.publicUrl };
        })
      );
      onSend(uploaded);
      handleClose();
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    rawFilesRef.current.clear();
    setStep('choose');
    onClose();
  };

  const removeFile = (id: string) => {
    const remaining = selectedFiles.filter(f => f.id !== id);
    setSelectedFiles(remaining);
    if (remaining.length === 0) setStep('choose');
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg w-[480px] relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-[#4e5058] hover:text-[#1e1f22] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-5">
            <h2 className="text-[#313338] text-2xl font-bold">Add an attachment</h2>
            <p className="text-[#4e5058] text-sm">Send a file as a message</p>
          </div>

          {step === 'choose' ? (
            <>
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#5865f2] bg-[#5865f2]/5'
                    : 'border-[#d0d0d0] hover:border-[#5865f2]'
                }`}
              >
                <div className="w-16 h-16 bg-[#d0d0d0] rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-[#7a7d85]" />
                </div>
                <p className="text-[#5865f2] font-medium mb-1">Choose files or drag and drop</p>
                <p className="text-[#4e5058] text-sm mb-3">Image and pdfs</p>

                {selectedFiles.length > 0 && (
                  <button
                    onClick={handleUpload}
                    className="bg-[#5865f2] text-white px-6 py-2 rounded hover:bg-[#4752c4] transition-colors font-medium"
                  >
                    Upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => processFiles(e.target.files)}
              />
            </>
          ) : (
            <div className="space-y-2">
              {selectedFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 bg-[#f2f3f5] rounded px-3 py-3 relative"
                >
                  {file.fileType === 'image' ? (
                    <ImageIcon className="w-8 h-8 text-[#5865f2] flex-shrink-0" />
                  ) : (
                    <FileText className="w-8 h-8 text-[#5865f2] flex-shrink-0" />
                  )}
                  <span className="flex-1 text-[#5865f2] text-sm truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="w-6 h-6 rounded-full bg-[#f23f42] flex items-center justify-center text-white flex-shrink-0 hover:bg-[#d32f32] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[#d0d0d0] rounded px-3 py-2 text-[#4e5058] text-sm hover:border-[#5865f2] hover:text-[#5865f2] transition-colors mt-1"
              >
                + Add more files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => processFiles(e.target.files)}
              />
            </div>
          )}
        </div>

        <div className="bg-[#f2f3f5] px-6 py-4 flex justify-end">
          <button
            onClick={handleSend}
            disabled={step === 'choose' || selectedFiles.length === 0 || isUploading}
            className="bg-[#5865f2] text-white px-6 py-2.5 rounded hover:bg-[#4752c4] transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isUploading ? 'Uploading...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
