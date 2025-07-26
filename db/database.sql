DROP TABLE IF EXISTS job_logs;
DROP TABLE IF EXISTS jobs;

-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('local', 'ssh')),
  command TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Job logs table (time-series)
CREATE TABLE job_logs (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  stream TEXT NOT NULL CHECK (stream IN ('stdout', 'stderr')),
  data TEXT NOT NULL
);

-- Index for log retrieval
CREATE INDEX idx_job_logs_job_timestamp ON job_logs(job_id, timestamp); 