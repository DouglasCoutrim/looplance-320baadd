DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.replays; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cameras; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.edge_devices; EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;
ALTER TABLE public.replays REPLICA IDENTITY FULL;
ALTER TABLE public.cameras REPLICA IDENTITY FULL;
ALTER TABLE public.edge_devices REPLICA IDENTITY FULL;