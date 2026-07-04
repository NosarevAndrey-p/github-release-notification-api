-- repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL UNIQUE, 
  last_seen_tag TEXT
);
