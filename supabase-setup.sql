-- Run this once in Supabase's SQL Editor

create table user_data (
  user_id uuid references auth.users on delete cascade primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table user_data enable row level security;

create policy "Users can read their own data"
  on user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on user_data for update
  using (auth.uid() = user_id);
