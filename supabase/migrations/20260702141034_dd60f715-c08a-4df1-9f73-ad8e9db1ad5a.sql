ALTER TABLE public.edge_devices
  ADD COLUMN IF NOT EXISTS cpu_percent numeric,
  ADD COLUMN IF NOT EXISTS memory_percent numeric,
  ADD COLUMN IF NOT EXISTS memory_total_mb integer,
  ADD COLUMN IF NOT EXISTS memory_used_mb integer,
  ADD COLUMN IF NOT EXISTS disk_percent numeric,
  ADD COLUMN IF NOT EXISTS temperature_c numeric,
  ADD COLUMN IF NOT EXISTS net_rx_bps bigint,
  ADD COLUMN IF NOT EXISTS net_tx_bps bigint,
  ADD COLUMN IF NOT EXISTS load_avg_1m numeric;