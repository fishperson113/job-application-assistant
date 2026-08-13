CREATE TABLE job_applications (
  id TEXT PRIMARY KEY,
  source_chat_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  company TEXT,
  cv_drive_file_id TEXT,
  cv_drive_link TEXT,
  tracker_row TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX job_applications_status_idx ON job_applications(status);
CREATE INDEX job_applications_created_at_idx ON job_applications(created_at DESC);

-- Idempotency for inbound Telegram updates polled from Corsair.
CREATE TABLE processed_updates (
  update_id BIGINT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-row cursor for the Corsair getUpdates offset.
CREATE TABLE poller_state (
  id INT PRIMARY KEY,
  telegram_offset BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT poller_state_singleton CHECK (id = 1)
);

INSERT INTO poller_state (id, telegram_offset) VALUES (1, 0);
