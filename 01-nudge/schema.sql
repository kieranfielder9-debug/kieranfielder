-- STAGE 5: THE DATABASE
-- What the app must remember. Two tables.

-- One row per person you are waiting to hear back from.
CREATE TABLE IF NOT EXISTS leads (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,                 -- who
  about          TEXT NOT NULL DEFAULT '',      -- what the work is
  next_follow_up TEXT NOT NULL,                 -- date to chase, as YYYY-MM-DD
  status         TEXT NOT NULL DEFAULT 'open',  -- open, won or lost
  created_on     TEXT NOT NULL
);

-- One row each time you chase someone.
-- The app would run without this table. It exists so we can measure
-- the hypothesis: were chases done on the day they were due?
CREATE TABLE IF NOT EXISTS follow_ups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER NOT NULL REFERENCES leads(id),  -- which lead this chase belongs to
  was_due_on TEXT NOT NULL,                          -- the date it should have happened
  done_on    TEXT NOT NULL                           -- the date it did happen
);
