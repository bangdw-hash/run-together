-- Run Together / RunMatch — base extensions.
-- PostGIS powers all proximity queries; pg_cron drives scheduled jobs
-- (chat expiry, stale request cleanup).
create extension if not exists postgis;
create extension if not exists pg_cron;
