-- Change trigger_button from INTEGER to TEXT
-- The Zero Delay board maps physical button numbers to labels (K1..K12, L1, L2, etc.)
ALTER TABLE public.cameras
  ALTER COLUMN trigger_button TYPE TEXT USING
    CASE
      WHEN trigger_button IS NULL THEN NULL
      WHEN trigger_button = 0 THEN 'K1'
      WHEN trigger_button = 1 THEN 'K2'
      WHEN trigger_button = 2 THEN 'K3'
      WHEN trigger_button = 3 THEN 'K4'
      WHEN trigger_button = 4 THEN 'L2'
      WHEN trigger_button = 5 THEN 'R2'
      WHEN trigger_button = 6 THEN 'L1'
      WHEN trigger_button = 7 THEN 'R1'
      WHEN trigger_button = 8 THEN 'SE'
      WHEN trigger_button = 9 THEN 'ST'
      WHEN trigger_button = 10 THEN 'K11'
      WHEN trigger_button = 11 THEN 'K12'
      ELSE 'K1'
    END;
