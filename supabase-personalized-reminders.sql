-- Run this in Supabase's SQL Editor (after supabase-push-setup.sql)

alter table push_subscriptions
  add column if not exists reminder_hour int not null default 9,
  add column if not exists reminder_minute int not null default 0,
  add column if not exists reminder_hour_2 int,
  add column if not exists reminder_minute_2 int,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists last_sent_date date,
  add column if not exists last_sent_date_2 date;

-- Allow users to update their own subscription (for changing reminder times/timezone)
drop policy if exists "Users can update their own subscription" on push_subscriptions;
create policy "Users can update their own subscription"
  on push_subscriptions for update
  using (auth.uid() = user_id);
