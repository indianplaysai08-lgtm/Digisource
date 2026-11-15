-- DigiSource D1 schema
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'General',
  creator_name TEXT NOT NULL DEFAULT 'DigiSource contributor',
  licence TEXT NOT NULL DEFAULT 'See item details', file_key TEXT, cover_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_products_status_created ON products(status, created_at DESC);
CREATE TABLE IF NOT EXISTS research (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL DEFAULT '', author_name TEXT NOT NULL DEFAULT 'DigiSource contributor',
  sources TEXT NOT NULL DEFAULT '', licence TEXT NOT NULL DEFAULT 'See item details',
  file_key TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_research_status_created ON research(status, created_at DESC);
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '', format TEXT NOT NULL DEFAULT 'Unknown',
  records_count INTEGER, source_url TEXT NOT NULL DEFAULT '',
  licence TEXT NOT NULL DEFAULT 'Not specified', file_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_datasets_status_created ON datasets(status, created_at DESC);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('product','research','dataset')),
  title TEXT NOT NULL, contact_email TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
  rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (rights_confirmed IN (0,1)),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_submissions_review_created ON submissions(review_status, created_at DESC);
