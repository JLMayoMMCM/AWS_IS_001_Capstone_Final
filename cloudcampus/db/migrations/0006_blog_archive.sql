-- Adds 'archived' to blog_status so the admin blogs queue can mirror the
-- projects lifecycle (pending / approved / rejected / archived). The public
-- blog listings already filter on status = 'approved', so archived posts are
-- hidden from readers without any application-layer changes.

ALTER TYPE blog_status ADD VALUE IF NOT EXISTS 'archived';
