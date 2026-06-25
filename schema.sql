-- Create Candidates Table
create table if not exists candidates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text,
  phone text,
  linkedin_url text,
  github_url text,
  resume_url text, -- Supabase Storage link or local url
  raw_text text,
  scrubbed_text text,
  skills text[] default '{}',
  experience_years numeric default 0,
  recent_job_title text,
  location text,
  career_breaks jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (optional, let's keep it open for simple API access or enable select all)
alter table candidates enable row level security;

-- Policy to allow anonymous read/write (since "No login required" is specified)
create policy "Allow public read access" on candidates for select using (true);
create policy "Allow public insert access" on candidates for insert with check (true);
create policy "Allow public update access" on candidates for update using (true);

-- Create index for faster searching
create index if not exists candidates_skills_idx on candidates using gin (skills);
create index if not exists candidates_location_idx on candidates (location);
create index if not exists candidates_experience_years_idx on candidates (experience_years);
