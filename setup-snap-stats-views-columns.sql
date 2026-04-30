-- Kjør én gang i Supabase hvis site_snap_stats allerede finnes uten nye kolonner.
alter table public.site_snap_stats add column if not exists metric_story_views_30d text;
alter table public.site_snap_stats add column if not exists metric_story_views_90d text;
alter table public.site_snap_stats add column if not exists metric_story_views_all_time text;
alter table public.site_snap_stats add column if not exists metric_story_views_7d_delta text;
alter table public.site_snap_stats add column if not exists metric_story_views_30d_delta text;
alter table public.site_snap_stats add column if not exists metric_story_views_90d_delta text;
alter table public.site_snap_stats add column if not exists metric_story_views_all_time_delta text;
