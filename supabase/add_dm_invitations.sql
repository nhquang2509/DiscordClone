-- ============================================================
-- DM Invitations - Chạy trong Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Cho phép type 'members' trong bảng channels
alter table public.channels
  drop constraint if exists channels_type_check;

alter table public.channels
  add constraint channels_type_check
  check (type in ('text', 'audio', 'video', 'members'));

-- 2. Bảng dm_invitations (lời mời chat riêng giữa 2 thành viên)
create table if not exists public.dm_invitations (
  id           uuid primary key default gen_random_uuid(),
  server_id    uuid references public.servers(id) on delete cascade not null,
  channel_id   uuid references public.channels(id) on delete cascade not null,
  inviter_id   text not null,
  inviter_name text not null,
  invitee_id   text not null,
  invitee_name text not null,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz default now() not null
);

-- 3. Bật RLS
alter table public.dm_invitations enable row level security;

-- 4. RLS Policies
create policy "Authenticated users can view dm_invitations"
  on public.dm_invitations for select to authenticated using (true);

create policy "Authenticated users can create dm_invitations"
  on public.dm_invitations for insert to authenticated with check (true);

create policy "Authenticated users can update dm_invitations"
  on public.dm_invitations for update to authenticated using (true);

-- 5. Bật Realtime cho bảng dm_invitations
alter publication supabase_realtime add table public.dm_invitations;
