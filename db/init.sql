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

-- Voting windows: each tied to a nomination window
CREATE TABLE IF NOT EXISTS voting_windows (
  id SERIAL PRIMARY KEY,
  nomination_window_id INTEGER NOT NULL REFERENCES nomination_windows(id),
  opened_by INTEGER NOT NULL REFERENCES users(id),
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes: ranked choice — one row per voter per nomination, with rank
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  voting_window_id INTEGER NOT NULL REFERENCES voting_windows(id),
  voter_id INTEGER NOT NULL REFERENCES users(id),
  nomination_id INTEGER NOT NULL REFERENCES nominations(id),
  rank INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (voting_window_id, voter_id, nomination_id),
  UNIQUE (voting_window_id, voter_id, rank)
);

-- Currently reading: tracks the book the club is currently reading (only one active at a time)
CREATE TABLE IF NOT EXISTS currently_reading (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255) NOT NULL,
  nominated_by INTEGER REFERENCES users(id),
  set_by INTEGER NOT NULL REFERENCES users(id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Only one book can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_currently_reading_active
  ON currently_reading (is_active) WHERE is_active = TRUE;

-- Book comments: discussion tied to a currently_reading book
CREATE TABLE IF NOT EXISTS book_comments (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES currently_reading(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_comments_book_id ON book_comments(book_id);

-- Meeting windows: tracks each meeting availability poll
CREATE TABLE IF NOT EXISTS meeting_windows (
  id SERIAL PRIMARY KEY,
  opened_by INTEGER NOT NULL REFERENCES users(id),
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  selected_option_id INTEGER, -- FK to meeting_options added below
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meeting options: date/time/location choices for a poll
CREATE TABLE IF NOT EXISTS meeting_options (
  id SERIAL PRIMARY KEY,
  window_id INTEGER NOT NULL REFERENCES meeting_windows(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL DEFAULT '17:00:00',
  location VARCHAR(500) NOT NULL DEFAULT 'TeaHaus',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK: meeting_windows.selected_option_id -> meeting_options.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_meeting_windows_selected_option'
      AND table_name = 'meeting_windows'
  ) THEN
    ALTER TABLE meeting_windows
      ADD CONSTRAINT fk_meeting_windows_selected_option
      FOREIGN KEY (selected_option_id) REFERENCES meeting_options(id);
  END IF;
END;
$$;

-- Meeting votes: multi-select, one row per voter per option
CREATE TABLE IF NOT EXISTS meeting_votes (
  id SERIAL PRIMARY KEY,
  window_id INTEGER NOT NULL REFERENCES meeting_windows(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES meeting_options(id) ON DELETE CASCADE,
  voter_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (window_id, option_id, voter_id)
);
