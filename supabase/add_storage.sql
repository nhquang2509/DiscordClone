-- =========================================================
-- add_storage.sql: Tạo bucket lưu file đính kèm (ảnh, PDF)
-- Chạy file này trong Supabase SQL Editor
-- =========================================================

-- 1. Tạo public bucket "attachments"
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Cho phép authenticated user upload file
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Authenticated users can upload attachments'
  ) THEN
    CREATE POLICY "Authenticated users can upload attachments"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'attachments');
  END IF;
END $$;

-- 3. Cho phép tất cả đọc file (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Anyone can read attachments'
  ) THEN
    CREATE POLICY "Anyone can read attachments"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'attachments');
  END IF;
END $$;
