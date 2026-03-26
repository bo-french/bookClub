-- February 2026 Book Club Seed Data
-- Clears all data and seeds one completed cycle: nominations, voting, currently reading, and meeting for Feb 2026

DO $$
DECLARE
  u1_id INTEGER; u2_id INTEGER; u3_id INTEGER; u4_id INTEGER;
  u5_id INTEGER; u6_id INTEGER; u7_id INTEGER;

  nom_window_id     INTEGER;
  vote_window_id    INTEGER;
  meeting_window_id INTEGER;
  meeting_option_id INTEGER;

  nom1_id INTEGER; nom2_id INTEGER; nom3_id INTEGER; nom4_id INTEGER;
  nom5_id INTEGER; nom6_id INTEGER; nom7_id INTEGER;
BEGIN
  -- Clear all data and reset sequences
  TRUNCATE TABLE
    meeting_votes,
    meeting_options,
    meeting_windows,
    book_comments,
    currently_reading,
    votes,
    voting_windows,
    nominations,
    nomination_windows,
    users
  RESTART IDENTITY CASCADE;

  -- ── Seed Users ────────────────────────────────────────────────────────────
  -- One per nomination (schema enforces one nomination per user per window)

  INSERT INTO users (clerk_id, email, first_name, last_name, created_at, updated_at)
    VALUES ('seed_feb2026_user1', 'seed1@bookclub.local', 'Alex',   'Morgan', '2026-01-10 00:00:00+00', '2026-01-10 00:00:00+00')
    RETURNING id INTO u1_id;
  INSERT INTO users (clerk_id, email, first_name, last_name, created_at, updated_at)
    VALUES ('seed_feb2026_user2', 'seed2@bookclub.local', 'Jordan', 'Lee',    '2026-01-10 00:00:00+00', '2026-01-10 00:00:00+00')
    RETURNING id INTO u2_id;
  INSERT INTO users (clerk_id, email, first_name, last_name, created_at, updated_at)
    VALUES ('seed_feb2026_user3', 'seed3@bookclub.local', 'Sam',    'Taylor', '2026-01-10 00:00:00+00', '2026-01-10 00:00:00+00')
    RETURNING id INTO u3_id;
  INSERT INTO users (clerk_id, email, first_name, last_name, created_at, updated_at)
    VALUES ('seed_feb2026_user4', 'seed4@bookclub.local', 'Casey',  'Rivera', '2026-01-10 00:00:00+00', '2026-01-10 00:00:00+00')
    RETURNING id INTO u4_id;
  INSERT INTO users (clerk_id, email, first_name, last_name, created_at, updated_at)
    VALUES ('seed_feb2026_user5', 'seed5@bookclub.local', 'Riley',  'Chen',   '2026-01-10 00:00:00+00', '2026-01-10 00:00:00+00')
    RETURNING id INTO u5_id;
  INSERT INTO users (clerk_id, email, first_name, last_name, created_at, updated_at)
    VALUES ('seed_feb2026_user6', 'seed6@bookclub.local', 'Morgan', 'Patel',  '2026-01-10 00:00:00+00', '2026-01-10 00:00:00+00')
    RETURNING id INTO u6_id;
  INSERT INTO users (clerk_id, email, first_name, last_name, created_at, updated_at)
    VALUES ('seed_feb2026_user7', 'seed7@bookclub.local', 'Drew',   'Wilson', '2026-01-10 00:00:00+00', '2026-01-10 00:00:00+00')
    RETURNING id INTO u7_id;

  -- ── Nomination Window (Jan 15 – Jan 31, 2026) ─────────────────────────────

  INSERT INTO nomination_windows (opened_by, deadline, created_at)
    VALUES (u1_id, '2026-01-31 23:59:59+00', '2026-01-15 10:00:00+00')
    RETURNING id INTO nom_window_id;

  -- ── Nominations ───────────────────────────────────────────────────────────

  INSERT INTO nominations (window_id, nominated_by, title, author, summary, pitch, created_at)
    VALUES (nom_window_id, u1_id,
      'I Cheerfully Refuse', 'Leif Enger',
      'A melancholic, lyrical story of a man sailing a future America in decline, searching for his missing wife.',
      'Beautiful prose and a haunting vision of the near future.',
      '2026-01-16 09:00:00+00')
    RETURNING id INTO nom1_id;

  INSERT INTO nominations (window_id, nominated_by, title, author, summary, pitch, created_at)
    VALUES (nom_window_id, u2_id,
      'The Unbearable Lightness of Being', 'Milan Kundera',
      'A philosophical novel set in 1968 Prague exploring love, politics, and the nature of existence.',
      'A true classic that rewards close reading and rich discussion.',
      '2026-01-17 11:00:00+00')
    RETURNING id INTO nom2_id;

  INSERT INTO nominations (window_id, nominated_by, title, author, summary, pitch, created_at)
    VALUES (nom_window_id, u3_id,
      'Project Hail Mary', 'Andy Weir',
      'An astronaut wakes up alone on a spacecraft with no memory, tasked with saving the solar system.',
      'Incredibly fun and sciency — hard to put down.',
      '2026-01-18 14:00:00+00')
    RETURNING id INTO nom3_id;

  INSERT INTO nominations (window_id, nominated_by, title, author, summary, pitch, created_at)
    VALUES (nom_window_id, u4_id,
      'Station 11', 'Emily St. John Mandel',
      'A post-pandemic novel weaving together past and present around a traveling Shakespeare company.',
      'Poignant and beautifully structured — loads of discussion potential.',
      '2026-01-19 16:00:00+00')
    RETURNING id INTO nom4_id;

  INSERT INTO nominations (window_id, nominated_by, title, author, summary, pitch, created_at)
    VALUES (nom_window_id, u5_id,
      'The Vanishing Half', 'Brit Bennett',
      'Twin sisters choose divergent paths — one passing as white — exploring race and identity across generations.',
      'Compulsively readable with rich themes to unpack.',
      '2026-01-20 10:00:00+00')
    RETURNING id INTO nom5_id;

  INSERT INTO nominations (window_id, nominated_by, title, author, summary, pitch, created_at)
    VALUES (nom_window_id, u6_id,
      'A Gentleman in Moscow', 'Amor Towles',
      'Count Alexander Rostov is sentenced to house arrest in a grand Moscow hotel, living through decades of Soviet history.',
      'Witty, warm, and immaculately written — perfect for a group read.',
      '2026-01-21 12:00:00+00')
    RETURNING id INTO nom6_id;

  INSERT INTO nominations (window_id, nominated_by, title, author, summary, pitch, created_at)
    VALUES (nom_window_id, u7_id,
      'Americanah', 'Chimamanda Ngozi Adichie',
      'A young Nigerian woman immigrates to the US and navigates race, identity, and love across two continents.',
      'Essential, sharp, and emotionally resonant.',
      '2026-01-22 09:30:00+00')
    RETURNING id INTO nom7_id;

  -- ── Voting Window (Feb 1 – Feb 10, 2026) ─────────────────────────────────

  INSERT INTO voting_windows (nomination_window_id, opened_by, deadline, created_at)
    VALUES (nom_window_id, u1_id, '2026-02-10 23:59:59+00', '2026-02-01 10:00:00+00')
    RETURNING id INTO vote_window_id;

  -- ── Ranked Choice Votes ───────────────────────────────────────────────────
  -- A Gentleman in Moscow (nom6) wins: 4 first-choice votes outright

  -- u1: AGiM 1st
  INSERT INTO votes (voting_window_id, voter_id, nomination_id, rank) VALUES
    (vote_window_id, u1_id, nom6_id, 1),
    (vote_window_id, u1_id, nom4_id, 2),
    (vote_window_id, u1_id, nom7_id, 3),
    (vote_window_id, u1_id, nom2_id, 4),
    (vote_window_id, u1_id, nom5_id, 5),
    (vote_window_id, u1_id, nom1_id, 6),
    (vote_window_id, u1_id, nom3_id, 7);

  -- u2: AGiM 1st
  INSERT INTO votes (voting_window_id, voter_id, nomination_id, rank) VALUES
    (vote_window_id, u2_id, nom6_id, 1),
    (vote_window_id, u2_id, nom2_id, 2),
    (vote_window_id, u2_id, nom5_id, 3),
    (vote_window_id, u2_id, nom7_id, 4),
    (vote_window_id, u2_id, nom4_id, 5),
    (vote_window_id, u2_id, nom3_id, 6),
    (vote_window_id, u2_id, nom1_id, 7);

  -- u3: Project Hail Mary 1st, AGiM 2nd
  INSERT INTO votes (voting_window_id, voter_id, nomination_id, rank) VALUES
    (vote_window_id, u3_id, nom3_id, 1),
    (vote_window_id, u3_id, nom6_id, 2),
    (vote_window_id, u3_id, nom1_id, 3),
    (vote_window_id, u3_id, nom4_id, 4),
    (vote_window_id, u3_id, nom5_id, 5),
    (vote_window_id, u3_id, nom7_id, 6),
    (vote_window_id, u3_id, nom2_id, 7);

  -- u4: AGiM 1st
  INSERT INTO votes (voting_window_id, voter_id, nomination_id, rank) VALUES
    (vote_window_id, u4_id, nom6_id, 1),
    (vote_window_id, u4_id, nom5_id, 2),
    (vote_window_id, u4_id, nom3_id, 3),
    (vote_window_id, u4_id, nom1_id, 4),
    (vote_window_id, u4_id, nom2_id, 5),
    (vote_window_id, u4_id, nom4_id, 6),
    (vote_window_id, u4_id, nom7_id, 7);

  -- u5: The Vanishing Half 1st, AGiM 2nd
  INSERT INTO votes (voting_window_id, voter_id, nomination_id, rank) VALUES
    (vote_window_id, u5_id, nom5_id, 1),
    (vote_window_id, u5_id, nom6_id, 2),
    (vote_window_id, u5_id, nom7_id, 3),
    (vote_window_id, u5_id, nom4_id, 4),
    (vote_window_id, u5_id, nom2_id, 5),
    (vote_window_id, u5_id, nom3_id, 6),
    (vote_window_id, u5_id, nom1_id, 7);

  -- u6: AGiM 1st
  INSERT INTO votes (voting_window_id, voter_id, nomination_id, rank) VALUES
    (vote_window_id, u6_id, nom6_id, 1),
    (vote_window_id, u6_id, nom7_id, 2),
    (vote_window_id, u6_id, nom2_id, 3),
    (vote_window_id, u6_id, nom4_id, 4),
    (vote_window_id, u6_id, nom5_id, 5),
    (vote_window_id, u6_id, nom1_id, 6),
    (vote_window_id, u6_id, nom3_id, 7);

  -- u7: Station 11 1st, AGiM 2nd
  INSERT INTO votes (voting_window_id, voter_id, nomination_id, rank) VALUES
    (vote_window_id, u7_id, nom4_id, 1),
    (vote_window_id, u7_id, nom6_id, 2),
    (vote_window_id, u7_id, nom7_id, 3),
    (vote_window_id, u7_id, nom5_id, 4),
    (vote_window_id, u7_id, nom2_id, 5),
    (vote_window_id, u7_id, nom1_id, 6),
    (vote_window_id, u7_id, nom3_id, 7);

  -- ── Meeting Window + March 13 Discussion Date ────────────────────────────

  INSERT INTO meeting_windows (opened_by, deadline, created_at)
    VALUES (u1_id, '2026-02-17 23:59:59+00', '2026-02-10 14:00:00+00')
    RETURNING id INTO meeting_window_id;

  INSERT INTO meeting_options (window_id, meeting_date, meeting_time, location, created_at)
    VALUES (meeting_window_id, '2026-03-13', '17:00:00', 'TeaHaus', '2026-02-10 14:00:00+00')
    RETURNING id INTO meeting_option_id;

  -- Mark the meeting as confirmed
  UPDATE meeting_windows
    SET selected_option_id = meeting_option_id
    WHERE id = meeting_window_id;

  RAISE NOTICE 'February 2026 seed data inserted successfully.';
END;
$$;
