-- ============================================================
-- Discord Clone - Supabase Schema
-- Chạy file này trong Supabase Dashboard > SQL Editor
-- ============================================================

-- Bảng servers
create table if not exists public.servers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  image       text,
  owner_id    uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now() not null
);

-- Bảng channels
create table if not exists public.channels (
  id          uuid primary key default gen_random_uuid(),
  server_id   uuid references public.servers(id) on delete cascade not null,
  name        text not null,
  type        text not null default 'text' check (type in ('text', 'audio', 'video')),
  created_at  timestamptz default now() not null
);

-- Bảng messages
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid references public.channels(id) on delete cascade not null,
  author_id    uuid references auth.users(id) on delete cascade not null,
  author_name  text not null,
  author_color text not null default '#5865f2',
  content      text not null default '',
  deleted      boolean not null default false,
  edited       boolean not null default false,
  created_at   timestamptz default now() not null
);

-- Bảng file_attachments
create table if not exists public.file_attachments (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.messages(id) on delete cascade not null,
  name        text not null,
  file_type   text not null check (file_type in ('image', 'pdf')),
  url         text not null
);

-- ============================================================
-- Bật Row Level Security
-- ============================================================
alter table public.servers         enable row level security;
alter table public.channels        enable row level security;
alter table public.messages        enable row level security;
alter table public.file_attachments enable row level security;

-- ============================================================
-- RLS Policies - Servers
-- ============================================================
create policy "Authenticated users can view servers"
  on public.servers for select to authenticated using (true);

create policy "Users can create servers"
  on public.servers for insert to authenticated with check (auth.uid() = owner_id);

create policy "Owners can update servers"
  on public.servers for update to authenticated using (auth.uid() = owner_id);

create policy "Owners can delete servers"
  on public.servers for delete to authenticated using (auth.uid() = owner_id);

-- ============================================================
-- RLS Policies - Channels
-- ============================================================
create policy "Authenticated users can view channels"
  on public.channels for select to authenticated using (true);

create policy "Authenticated users can create channels"
  on public.channels for insert to authenticated with check (true);

create policy "Authenticated users can update channels"
  on public.channels for update to authenticated using (true);

create policy "Authenticated users can delete channels"
  on public.channels for delete to authenticated using (true);

-- ============================================================
-- RLS Policies - Messages
-- ============================================================
create policy "Authenticated users can view messages"
  on public.messages for select to authenticated using (true);

create policy "Users can create messages"
  on public.messages for insert to authenticated with check (auth.uid() = author_id);

create policy "Users can update their own messages"
  on public.messages for update to authenticated using (auth.uid() = author_id);

-- ============================================================
-- RLS Policies - File attachments
-- ============================================================
create policy "Authenticated users can view attachments"
  on public.file_attachments for select to authenticated using (true);

create policy "Authenticated users can create attachments"
  on public.file_attachments for insert to authenticated with check (true);

-- ============================================================
-- Realtime: bật cho bảng messages
-- ============================================================
alter publication supabase_realtime add table public.messages;
