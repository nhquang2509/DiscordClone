-- ============================================================
-- Pin Messages - Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Add is_system column to messages (flags system/automated messages)
alter table public.messages
  add column if not exists is_system boolean not null default false;

-- 2. Create pinned_messages table
create table if not exists public.pinned_messages (
  id             uuid primary key default gen_random_uuid(),
  channel_id     uuid references public.channels(id) on delete cascade not null,
  message_id     uuid references public.messages(id) on delete cascade not null,
  pinned_by_id   text not null,
  pinned_by_name text not null,
  content        text not null,
  author_name    text not null,
  created_at     timestamptz default now() not null,
  unique(channel_id, message_id)
);

-- 3. Enable RLS
alter table public.pinned_messages enable row level security;

-- 4. RLS Policies
create policy "Authenticated users can view pinned_messages"
  on public.pinned_messages for select to authenticated using (true);

create policy "Authenticated users can pin messages"
  on public.pinned_messages for insert to authenticated with check (true);

create policy "Authenticated users can unpin messages"
  on public.pinned_messages for delete to authenticated using (true);

-- 5. Enable Realtime
alter publication supabase_realtime add table public.pinned_messages;
