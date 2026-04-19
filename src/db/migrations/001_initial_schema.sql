CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  phone TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  eleven_labs_voice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected',
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  script TEXT NOT NULL,
  audio_url TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_detail TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS briefing_feedback (
  id UUID PRIMARY KEY,
  briefing_id UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (briefing_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'open',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  morning_time TEXT NOT NULL DEFAULT '07:00',
  evening_time TEXT NOT NULL DEFAULT '18:00',
  news_keywords TEXT[] NOT NULL DEFAULT ARRAY['small business','operations','sales'],
  news_feeds TEXT[] NOT NULL DEFAULT ARRAY[
    'https://feeds.feedburner.com/entrepreneur/latest',
    'https://www.forbes.com/small-business/feed/',
    'https://techcrunch.com/category/startups/feed/'
  ],
  deal_value_threshold NUMERIC NOT NULL DEFAULT 10000,
  urgency_keywords TEXT[] NOT NULL DEFAULT ARRAY['urgent','asap','invoice','contract'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS briefing_job_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reliability_alerts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_briefings_user_created ON briefings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_job_events_user_created ON briefing_job_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_feedback_user_created ON briefing_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reliability_alerts_user_created ON reliability_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reliability_alerts_user_key ON reliability_alerts (user_id, alert_key, created_at DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'connected';

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS delivery_detail TEXT;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS news_feeds TEXT[] NOT NULL DEFAULT ARRAY[
    'https://feeds.feedburner.com/entrepreneur/latest',
    'https://www.forbes.com/small-business/feed/',
    'https://techcrunch.com/category/startups/feed/'
  ];
