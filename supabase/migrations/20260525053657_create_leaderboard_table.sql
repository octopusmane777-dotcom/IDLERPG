/*
  # Create leaderboard table

  1. New Tables
    - `leaderboard`
      - `user_id` (text, primary key) — anonymous player identifier
      - `stage` (integer) — highest tier/stage reached
      - `prestige_cores` (integer) — total consciousness shards earned
      - `monsters_defeated` (integer) — lifetime kill count
      - `updated_at` (timestamptz) — last score submission time

  2. Security
    - Enable RLS on `leaderboard` table
    - SELECT: any authenticated user can read all rows (public leaderboard)
    - INSERT: authenticated users can only insert their own row
    - UPDATE: authenticated users can only update their own row
    - No DELETE policy (scores are permanent)
*/

CREATE TABLE IF NOT EXISTS leaderboard (
  user_id text PRIMARY KEY,
  stage integer NOT NULL DEFAULT 1,
  prestige_cores integer NOT NULL DEFAULT 0,
  monsters_defeated integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read leaderboard"
  ON leaderboard FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own score"
  ON leaderboard FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own score"
  ON leaderboard FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
