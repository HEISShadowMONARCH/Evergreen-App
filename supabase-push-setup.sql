-- Run this in Supabase's SQL Editor (in addition to supabase-setup.sql)

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Users can insert their own subscription"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own subscription"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can delete their own subscription"
  on push_subscriptions for delete
  using (auth.uid() = user_id);
