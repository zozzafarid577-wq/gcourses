# Gcourses Portal — Supabase setup (one time)

The portal stores **users (with passwords)** and **content** in Supabase.
Do these 3 short steps once.

## 1. Paste the SQL

Supabase dashboard → **SQL Editor** → **New query** → paste all of this → **Run**:

```sql
-- profiles: one row per user, with an is_admin flag
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  is_admin boolean default false,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- auto-create a profile when someone signs up; the listed emails become admins
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (
    new.id,
    new.email,
    lower(new.email) in ('gigiimofarid@gmail.com','gcourrrses@gmail.com')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- portal content: a single JSON row holding all modules/lessons
create table if not exists public.portal_content (
  id int primary key default 1,
  data jsonb not null default '{"title":"ACT Biology Portal","intro":"","modules":[]}'::jsonb,
  updated_at timestamptz default now()
);
insert into public.portal_content (id) values (1) on conflict (id) do nothing;
alter table public.portal_content enable row level security;

drop policy if exists "logged-in users can read content" on public.portal_content;
create policy "logged-in users can read content" on public.portal_content
  for select to authenticated using (true);

drop policy if exists "admins can update content" on public.portal_content;
create policy "admins can update content" on public.portal_content
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
```

## 2. Turn OFF email confirmation (so passwords work right away)

Supabase dashboard → **Authentication** → **Providers** → **Email** →
turn **off** "Confirm email" → **Save**.

(Otherwise every new student would have to confirm via email before logging in.)

## 3. (Optional) File uploads

To let admins upload PDFs/images directly:
Dashboard → **Storage** → **New bucket** → name it `portal-files` → tick
**Public bucket** → create. (Without this, just paste links — that always works.)

---

## How it works after setup

- **You (admin):** sign up once with `gigiimofarid@gmail.com` (or
  `gcourrrses@gmail.com`) and your chosen password → you're automatically an
  admin and can add/edit content.
- **Students:** sign up with their email + a password → they can read all the
  materials but not edit.
- Passwords are hashed by Supabase — nobody, including you, can see them.
- Want students approved before they can sign up? Tell me and I'll add an
  approval gate.
