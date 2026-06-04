-- Grant table-level permissions to authenticated users.
-- RLS policies alone are not enough; Postgres requires explicit GRANT before RLS is evaluated.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE trades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE liquidations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE binance_imports TO authenticated;
