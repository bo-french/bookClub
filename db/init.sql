-- Book Club App - Initial Schema
-- This runs automatically when the Postgres container starts for the first time

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by clerk_id
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-updating updated_at on users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Nomination windows: tracks each period when nominations are open
CREATE TABLE IF NOT EXISTS nomination_windows (
  id SERIAL PRIMARY KEY,
  opened_by INTEGER NOT NULL REFERENCES users(id),
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nominations: one per user per window
CREATE TABLE IF NOT EXISTS nominations (
  id SERIAL PRIMARY KEY,
  window_id INTEGER NOT NULL REFERENCES nomination_windows(id),
  nominated_by INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  pitch TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (window_id, nominated_by)
);
