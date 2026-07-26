-- 003_mistakes_schema.sql
-- Migration for Mistakes Journal feature

CREATE TABLE mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  trade_id uuid REFERENCES trades(id) ON DELETE SET NULL,
  trade_date date NOT NULL,
  trade_time time,
  coin text,
  why_took_trade text NOT NULL,
  mistake_details text NOT NULL,
  lesson_learned text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'FOMO',
    'Over-leveraging',
    'Moved Stop Loss',
    'Early Exit',
    'Revenge Trade',
    'Execution Error',
    'No Plan',
    'Chasing Price',
    'Ignored Bias',
    'Other'
  )),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users see and manage only their own mistakes
CREATE POLICY "Users see own mistakes" ON mistakes
  FOR ALL USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX idx_mistakes_user_date ON mistakes(user_id, trade_date DESC);
CREATE INDEX idx_mistakes_category ON mistakes(user_id, category);
