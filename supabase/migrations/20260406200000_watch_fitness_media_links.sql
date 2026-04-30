-- Watch / vlog: lagret video (Storage), eksterne lenker (TikTok, Instagram, Snap)
alter table public.watch_videos add column if not exists video_file_url text;
alter table public.watch_videos add column if not exists link_tiktok text;
alter table public.watch_videos add column if not exists link_instagram text;
alter table public.watch_videos add column if not exists link_snap text;

alter table public.fitness_episodes add column if not exists link_tiktok text;
alter table public.fitness_episodes add column if not exists link_instagram text;

notify pgrst, 'reload schema';
