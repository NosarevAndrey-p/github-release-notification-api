-- repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL UNIQUE, 
  last_seen_tag TEXT
);

-- subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  repo_id INTEGER NOT NULL,

  confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0,1)),

  confirm_token TEXT NOT NULL UNIQUE,
  unsubscribe_token TEXT NOT NULL UNIQUE,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- prevent duplicate subscriptions per user per repo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_subscription
ON subscriptions (email, repo_id);

-- speed up lookups by repo (scanner use case)
CREATE INDEX IF NOT EXISTS idx_subscriptions_repo
ON subscriptions (repo_id);

-- speed up lookups by email (GET /subscriptions)
CREATE INDEX IF NOT EXISTS idx_subscriptions_email
ON subscriptions (email);