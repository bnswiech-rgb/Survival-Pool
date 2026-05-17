-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  wins integer not null default 0,
  losses integer not null default 0,
  pushes integer not null default 0,
  pools_entered integer not null default 0,
  pools_won integer not null default 0,
  created_at timestamptz not null default now()
);

-- TEAMS (for team battle format)
create table teams (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid not null,
  name text not null,
  captain_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- POOLS
create table pools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sport text not null,
  entry_fee_cents integer not null default 0,
  rake_percentage numeric(5,2) not null default 10.0,
  max_entries integer,
  start_date timestamptz not null,
  pick_deadline timestamptz not null,
  round_frequency text not null default 'daily' check (round_frequency in ('daily', 'weekly')),
  status text not null default 'upcoming' check (status in ('upcoming', 'open', 'locked', 'active', 'completed', 'canceled')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  push_rule text not null default 'advance' check (push_rule in ('advance', 'eliminate', 'repeat')),
  all_lose_rule text not null default 'repeat' check (all_lose_rule in ('repeat', 'split', 'tiebreak')),
  prize_structure text not null default 'winner_take_all',
  -- Contest format fields
  contest_format text not null default 'classic' check (contest_format in ('classic', 'lives', 'first_to_x', 'best_record', 'streak_race', 'team_battle')),
  lives_count integer not null default 1,
  target_wins integer not null default 5,
  target_streak integer not null default 5,
  max_losses integer,
  contest_duration_rounds integer,
  push_resets_streak boolean not null default false,
  team_scoring text default 'last_team_standing',
  -- Admin
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- POOL PARTICIPANTS
create table pool_participants (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid not null references pools(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  team_id uuid references teams(id),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded', 'waived')),
  status text not null default 'active' check (status in ('active', 'advanced', 'eliminated', 'winner')),
  lives_remaining integer not null default 1,
  current_streak integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  pushes integer not null default 0,
  rounds_survived integer not null default 0,
  eliminated_round integer,
  prize_amount_cents integer,
  joined_at timestamptz not null default now(),
  unique(pool_id, user_id)
);

-- ROUNDS
create table rounds (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid not null references pools(id) on delete cascade,
  round_number integer not null,
  deadline timestamptz not null,
  status text not null default 'open' check (status in ('open', 'locked', 'grading', 'completed')),
  created_at timestamptz not null default now(),
  unique(pool_id, round_number)
);

-- PICKS
create table picks (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid not null references pools(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  sport text not null,
  league text,
  game text not null,
  pick_type text not null check (pick_type in ('spread', 'total', 'moneyline')),
  side text not null,
  line_value text not null,
  american_odds integer not null,
  game_start_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'push', 'void')),
  is_locked boolean not null default false,
  submitted_at timestamptz not null default now(),
  locked_at timestamptz,
  graded_at timestamptz,
  unique(pool_id, round_id, user_id)
);

-- POOL MESSAGES (chat)
create table pool_messages (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid not null references pools(id) on delete cascade,
  user_id uuid references profiles(id),
  message text,
  message_type text not null default 'user' check (message_type in ('user', 'system', 'pinned')),
  reactions jsonb not null default '{}',
  mentions text[] default '{}',
  created_at timestamptz not null default now()
);

-- PAYMENTS
create table payments (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid not null references pools(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  provider text not null default 'mock' check (provider in ('mock', 'stripe', 'whop')),
  provider_payment_id text,
  created_at timestamptz not null default now()
);

-- ADMIN ACTIONS
create table admin_actions (
  id uuid primary key default uuid_generate_v4(),
  admin_user_id uuid not null references profiles(id),
  action_type text not null,
  target_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ACTIVITY FEED
create table activity_feed (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid references pools(id) on delete cascade,
  user_id uuid references profiles(id),
  activity_type text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- PICK REACTIONS
create table pick_reactions (
  id uuid primary key default uuid_generate_v4(),
  pick_id uuid not null references picks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(pick_id, user_id, emoji)
);

-- FOLLOWS
create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  primary key(follower_id, following_id)
);

-- RLS Policies (enable for all tables)
alter table profiles enable row level security;
alter table pools enable row level security;
alter table pool_participants enable row level security;
alter table rounds enable row level security;
alter table picks enable row level security;
alter table pool_messages enable row level security;
alter table payments enable row level security;
alter table admin_actions enable row level security;
alter table activity_feed enable row level security;
alter table pick_reactions enable row level security;
alter table follows enable row level security;
alter table teams enable row level security;

-- Basic RLS policies
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Public pools viewable by everyone" on pools for select using (visibility = 'public' or created_by = auth.uid());
create policy "Authenticated users can create pools" on pools for insert with check (auth.uid() is not null);
create policy "Admins and creators can update pools" on pools for update using (created_by = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Participants viewable by pool members" on pool_participants for select using (true);
create policy "Users can join pools" on pool_participants for insert with check (auth.uid() = user_id);
create policy "Users can update own participation" on pool_participants for update using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Rounds viewable by everyone" on rounds for select using (true);

create policy "Users can view own picks always, others only after lock" on picks for select using (
  user_id = auth.uid() or
  is_locked = true or
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Users can submit own picks" on picks for insert with check (auth.uid() = user_id);
create policy "Users can update own unlocked picks" on picks for update using (auth.uid() = user_id and is_locked = false);

create policy "Pool messages viewable by everyone" on pool_messages for select using (true);
create policy "Authenticated users can send messages" on pool_messages for insert with check (auth.uid() is not null);

create policy "Users can view own payments" on payments for select using (user_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "System can insert payments" on payments for insert with check (auth.uid() is not null);

create policy "Activity feed viewable by everyone" on activity_feed for select using (true);

create policy "Pick reactions viewable by everyone" on pick_reactions for select using (true);
create policy "Users can react to picks" on pick_reactions for insert with check (auth.uid() = user_id);
create policy "Users can remove own reactions" on pick_reactions for delete using (auth.uid() = user_id);

create policy "Follows viewable by everyone" on follows for select using (true);
create policy "Users can follow" on follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on follows for delete using (auth.uid() = follower_id);

create policy "Teams viewable by everyone" on teams for select using (true);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable realtime for chat
alter publication supabase_realtime add table pool_messages;
alter publication supabase_realtime add table activity_feed;
alter publication supabase_realtime add table pool_participants;
alter publication supabase_realtime add table picks;
