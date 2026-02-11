-- Add completed flag to assignments
alter table public.assignments add column completed boolean default false not null;
