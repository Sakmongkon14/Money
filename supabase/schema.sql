-- Run in the Supabase SQL Editor before connecting the web app.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0),
  title text not null check (char_length(title) between 1 and 100),
  category text not null,
  entry_date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, entry_date desc);

alter table public.transactions enable row level security;
revoke all on public.transactions from anon;
grant select, insert, update, delete on public.transactions to authenticated;

drop policy if exists "Users can view own transactions" on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;

create policy "Users can view own transactions"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own transactions"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);
