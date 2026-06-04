-- trades table
CREATE TABLE trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  time time,
  day text,
  coin text NOT NULL,
  position text NOT NULL CHECK (position IN ('Long', 'Short')),
  entry_price numeric,
  exit_price numeric,
  stop_loss numeric,
  quantity numeric,
  leverage text,
  strategy text,
  timeframes text[],
  confidence integer CHECK (confidence BETWEEN 1 AND 5),
  risk_pct numeric,
  range_pct numeric,
  fib_match_macro text,
  limit_type text,
  pnl numeric,
  fee numeric,
  win boolean DEFAULT false,
  loss boolean DEFAULT false,
  be boolean DEFAULT false,
  date_closed date,
  closed_reason text,
  duration text,
  reason text,
  pre_notes text,
  post_notes text,
  order_id text,
  fills integer,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'futures_import')),
  annotated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, order_id)
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own trades" ON trades
  FOR ALL USING (auth.uid() = user_id);

-- ledger table
CREATE TABLE ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  date date NOT NULL,
  time time,
  my_bank text,
  recipient_bank text,
  sender_bank text,
  receiver_bank text,
  fiat_sent numeric,
  usd_fee numeric DEFAULT 0,
  usd_rate numeric,
  usd_received numeric,
  usd_quantity numeric,
  fee numeric DEFAULT 0.07,
  fiat_amount numeric,
  notes text,
  order_number text,
  counterparty text,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'c2c_import')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, order_number)
);

ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own ledger" ON ledger
  FOR ALL USING (auth.uid() = user_id);

-- liquidations table
CREATE TABLE liquidations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  coin text,
  position text CHECK (position IN ('Long', 'Short')),
  amount_lost numeric,
  strategy text,
  reason text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE liquidations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own liquidations" ON liquidations
  FOR ALL USING (auth.uid() = user_id);

-- sessions table
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('pre', 'tcl', 'post')),
  status text DEFAULT 'not_started',
  market_bias text,
  news_events jsonb DEFAULT '[]',
  watchlist jsonb DEFAULT '[]',
  live_trades jsonb DEFAULT '[]',
  session_notes text,
  what_seen text,
  what_skipped text,
  trades_count integer,
  wins integer,
  losses integer,
  net_pnl numeric,
  what_right text,
  what_wrong text,
  tomorrow_plan text,
  checklist jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, session_type)
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- binance_imports table (tracks both futures and c2c imports)
CREATE TABLE binance_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  filename text,
  import_type text NOT NULL CHECK (import_type IN ('futures', 'c2c')),
  imported_at timestamptz DEFAULT now(),
  trades_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  status text DEFAULT 'complete'
);

ALTER TABLE binance_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own imports" ON binance_imports
  FOR ALL USING (auth.uid() = user_id);
