-- Add R2 object key column to images table so blobs can be stored in R2.
ALTER TABLE images ADD COLUMN r2_key TEXT;
