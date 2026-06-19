create table users (
  id uuid primary key,
  name text not null,
  phone text,
  role text not null,
  created_at timestamptz not null default now()
);

create table camp_sessions (
  id uuid primary key,
  name text not null,
  city text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key,
  session_id uuid not null references camp_sessions(id),
  name text not null,
  created_at timestamptz not null default now()
);

create table itinerary_points (
  id uuid primary key,
  session_id uuid not null references camp_sessions(id),
  team_id uuid references teams(id),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key,
  reporter_name text not null,
  reporter_role text not null,
  session_id uuid not null references camp_sessions(id),
  team_id uuid references teams(id),
  point_id uuid references itinerary_points(id),
  category text not null,
  content text not null,
  status text not null default 'open',
  is_urgent boolean not null default false,
  affects_settlement boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table report_actions (
  id uuid primary key,
  report_id uuid not null references reports(id),
  actor_name text not null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);
