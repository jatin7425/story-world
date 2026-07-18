-- Table to store uploaded images as base64-encoded blobs. Images may
-- also reference an external source URL if they were not uploaded.
CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT,
  content_type TEXT,
  data_base64 TEXT,
  source_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
