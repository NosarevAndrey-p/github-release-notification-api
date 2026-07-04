-- subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  repo_name TEXT NOT NULL,

  confirmed BOOLEAN NOT NULL DEFAULT FALSE,

  confirm_token TEXT NOT NULL UNIQUE,
  unsubscribe_token TEXT NOT NULL UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- prevent duplicate subscriptions per user per repo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_subscription
ON subscriptions (email, repo_name);

-- speed up lookups by repo_name (internal API search)
CREATE INDEX IF NOT EXISTS idx_subscriptions_repo_name
ON subscriptions (repo_name);

-- speed up lookups by email (GET /subscriptions)
CREATE INDEX IF NOT EXISTS idx_subscriptions_email
ON subscriptions (email);
