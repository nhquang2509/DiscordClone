-- Chạy file này trong Supabase Dashboard > SQL Editor

-- Bảng server_members: lưu vai trò của từng thành viên trong server
CREATE TABLE IF NOT EXISTS public.server_members (
  server_id  UUID  NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id    UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT,
  role       TEXT  NOT NULL DEFAULT 'guest'
               CHECK (role IN ('admin', 'moderator', 'guest')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

-- Mọi người dùng đã xác thực đều xem được danh sách thành viên
CREATE POLICY "view_server_members"
  ON public.server_members FOR SELECT
  USING (auth.role() = 'authenticated');

-- Người dùng có thể tự thêm mình vào server
CREATE POLICY "insert_server_members"
  ON public.server_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Chỉ admin mới được đổi role của thành viên khác
CREATE POLICY "admins_update_members"
  ON public.server_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = server_members.server_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'admin'
    )
  );

-- Thành viên có thể tự rời server
CREATE POLICY "delete_own_membership"
  ON public.server_members FOR DELETE
  USING (auth.uid() = user_id);
