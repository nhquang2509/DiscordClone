export type Theme = 'dark' | 'light' | 'system';

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'audio' | 'video' | 'members';
}

export interface FileAttachment {
  id: string;
  name: string;
  fileType: 'image' | 'pdf';
  url: string;
}

export interface Message {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorColor: string;
  timestamp: string;
  content: string;
  deleted: boolean;
  edited: boolean;
  files: FileAttachment[];
}

export interface Server {
  id: string;
  name: string;
  image: string | null;
  invite_code: string | null;
}
