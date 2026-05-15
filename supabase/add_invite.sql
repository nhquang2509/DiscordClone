-- =========================================================
-- add_invite.sql: invite_code cho servers + RLS cho members
-- Chạy file này trong Supabase SQL Editor
-- =========================================================

-- 1. Thêm cột invite_code vào bảng servers (UUID ngẫu nhiên mặc định)
ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT;

-- 2. Index để tìm server bằng invite_code nhanh hơn
CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_invite_code
  ON public.servers(invite_code);

-- 3. Cho phép authenticated user đọc server khi cần join bằng invite link
--    (tất cả server đều có thể được tìm bằng invite_code)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'servers' AND policyname = 'servers_authenticated_read'
  ) THEN
    CREATE POLICY "servers_authenticated_read"
      ON public.servers FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 4. Cho phép members đọc server của họ (phục vụ fetch qua server_members)
--    (Nếu bạn đã có policy SELECT trên servers, policy mới sẽ cộng thêm OR logic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'servers' AND policyname = 'members_can_read_servers'
  ) THEN
    CREATE POLICY "members_can_read_servers"
      ON public.servers FOR SELECT
      USING (
        auth.uid() = owner_id
        OR EXISTS (
          SELECT 1 FROM public.server_members sm
          WHERE sm.server_id = servers.id AND sm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5. Cho phép admin (owner) cập nhật invite_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'servers' AND policyname = 'owner_can_update_server'
  ) THEN
    CREATE POLICY "owner_can_update_server"
      ON public.servers FOR UPDATE
      USING (auth.uid() = owner_id)
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;
