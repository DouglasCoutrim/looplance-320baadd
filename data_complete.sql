-- Data Export Backup
-- Generated for Looplance Edge

-- Arenas
INSERT INTO public.arenas (id, nome, created_at, cidade, telefone, endereco, foto_url, sponsor_logo_left, sponsor_logo_center, sponsor_logo_right) 
VALUES ('a114e200-03a1-41dd-af9e-576cbc2ae469', 'CTC ESPORTES', '2026-05-23 16:00:10.974309+00', 'Cristalina', '(61) 99624-3196', 'R. II, 582-764 - Sul Henrique Cortes', 'https://jurwopyuxmhvtwzjxynm.supabase.co/storage/v1/object/public/arenas/0.07325652914308622.jpeg', 'https://jurwopyuxmhvtwzjxynm.supabase.co/storage/v1/object/public/arenas/0.1759641620023178.png', 'https://jurwopyuxmhvtwzjxynm.supabase.co/storage/v1/object/public/arenas/0.02866589532156527.png', 'https://jurwopyuxmhvtwzjxynm.supabase.co/storage/v1/object/public/arenas/0.1293613660072629.png');

-- Profiles
INSERT INTO public.profiles (id, email, full_name, role, is_super_admin, is_arena_owner, created_at, updated_at, consent_accepted)
VALUES ('3e1d2d86-fc29-413d-93e7-4fc7371ae9f6', 'douglascoutrim@gmail.com', 'Douglas Coutrim', 'super-admin', true, false, '2026-05-23 20:22:45.66534+00', '2026-05-23 20:22:45.66534+00', false),
('80266388-e9f2-47b1-97a9-8d58a6cebc20', 'jorgealcino@gmail.com', 'Jorge Alcino', 'manager', true, true, '2026-05-23 20:05:23.104784+00', '2026-05-26 01:54:25.64189+00', true),
('89002472-f51d-4321-bb3d-fc6a10ee6229', 'douglas@looplance.app', 'Douglas Coutrim Silva ', 'manager', true, true, '2026-05-23 15:46:16.916713+00', '2026-05-26 01:54:50.314641+00', true);

-- Quadras
INSERT INTO public.quadras (id, arena_id, nome, created_at)
VALUES ('015eb2bf-724d-4b1e-9f07-d9461835c417', 'a114e200-03a1-41dd-af9e-576cbc2ae469', 'Areia Coberta', '2026-05-23 16:03:43.643812+00');

-- Arena Settings
INSERT INTO public.arena_settings (id, arena_id, replay_retention_days, auto_cleanup_enabled, created_at, updated_at)
VALUES ('3a7ad1f9-c2d6-4239-9109-e4af67724105', 'a114e200-03a1-41dd-af9e-576cbc2ae469', 4, true, '2026-05-23 17:32:58.540434+00', '2026-05-23 20:43:36.625+00');

-- Edge Devices
INSERT INTO public.edge_devices (id, arena_id, name, edge_token, hostname, local_ip, status, last_seen, created_at)
VALUES ('8fe0b00f-ae5c-4854-902f-4da3ad37e98e', 'a114e200-03a1-41dd-af9e-576cbc2ae469', 'EDGE CTC ESPORTE', '83802619-8680-4f45-9d02-4457d91ff625', 'edge-01-ctc-esporte', '192.168.1.15', 'online', '2026-05-31 19:56:37.42185+00', '2026-05-23 16:00:38.767243+00');

-- Input Boards
INSERT INTO public.input_boards (id, edge_device_id, name, created_at)
VALUES ('d1870fff-2da3-47a7-bb49-87c582048db5', '8fe0b00f-ae5c-4854-902f-4da3ad37e98e', 'Placa CTC ESPORTES', '2026-05-23 16:01:27.984565+00');

-- Cameras
INSERT INTO public.cameras (id, quadra_id, edge_device_id, name, rtsp_url, trigger_button, replay_seconds, active, buffer_seconds, created_at, aspect_ratio, streaming_status, video_width, video_height, video_x, video_y)
VALUES ('a57a2a4d-72eb-43a1-94f3-6e71b4bf80c0', '015eb2bf-724d-4b1e-9f07-d9461835c417', '8fe0b00f-ae5c-4854-902f-4da3ad37e98e', 'Sntético', 'rtsp://admin:e10203040@192.168.1.11:554/cam/realmonitor?channel=1&subtype=0', 1, 30, true, 60, '2026-05-29 05:58:09.820584+00', '16:9', 'success', 916, 827, 502, 120),
('63f77bf2-cf0f-4b92-bf4d-10750b7e3750', '015eb2bf-724d-4b1e-9f07-d9461835c417', '8fe0b00f-ae5c-4854-902f-4da3ad37e98e', 'Areia Coberta', 'rtsp://admin:e10203040@192.168.1.11:554/cam/realmonitor?channel=1&subtype=0', 0, 41, true, 60, '2026-05-23 16:04:41.328041+00', '9:16', 'pending', 1080, 1386, 0, 267);

-- Replays (Sample of latest)
-- INSERT INTO public.replays (id, quadra_id, edge_device_id, video_url, file_size_bytes, duration_sec, created_at, r2_key)
-- VALUES ('05f0546b-934a-4797-9088-1e87188c8e83', '015eb2bf-724d-4b1e-9f07-d9461835c417', '8fe0b00f-ae5c-4854-902f-4da3ad37e98e', '...', 2132789, 35, '2026-05-29 01:48:36.634597+00', 'replays/...');
