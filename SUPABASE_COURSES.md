# Gcourses Portal — Multiple courses + student enrollment

Run this **once** in Supabase → **SQL Editor** (after the earlier setup that
created `profiles`). It adds **courses** and **enrollments**, with access rules
so students only see courses they're enrolled in and admins manage everything.

```sql
-- helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
  returns boolean language sql security definer stable
  set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- courses: each row is one course, with its modules/lessons in `data`
create table if not exists public.courses (
  id bigint generated always as identity primary key,
  title text not null default 'Untitled course',
  intro text default '',
  data jsonb not null default '{"modules":[]}'::jsonb,
  sort int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.courses enable row level security;

-- enrollments: which student email is in which course (email = enroll before signup)
create table if not exists public.enrollments (
  id bigint generated always as identity primary key,
  course_id bigint references public.courses(id) on delete cascade,
  student_email text not null,
  created_at timestamptz default now(),
  unique (course_id, student_email)
);
alter table public.enrollments enable row level security;
create index if not exists enrollments_email_idx on public.enrollments (lower(student_email));

-- policies: courses
drop policy if exists "courses admin all" on public.courses;
create policy "courses admin all" on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "courses student read" on public.courses;
create policy "courses student read" on public.courses for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.enrollments e
               where e.course_id = courses.id
               and lower(e.student_email) = lower(coalesce(auth.jwt() ->> 'email','')))
  );

-- policies: enrollments
drop policy if exists "enroll admin all" on public.enrollments;
create policy "enroll admin all" on public.enrollments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "enroll student read own" on public.enrollments;
create policy "enroll student read own" on public.enrollments for select to authenticated
  using (lower(student_email) = lower(coalesce(auth.jwt() ->> 'email','')));

-- policies: let admins list every student (for the Students tab)
drop policy if exists "profiles admin read all" on public.profiles;
create policy "profiles admin read all" on public.profiles for select to authenticated
  using (public.is_admin());
```

## After running it
- Open **/portal.html** as admin → click **Manage**.
- **Courses tab:** the **ACT/EST Biology** course is preloaded. Add more with **+ New course**, edit content, rename, or delete.
- **Students tab:** type a student's email + pick a course → **Enroll**. Students see only the courses they're enrolled in. Remove anyone with the × on their course chip.

The old single-course `portal_content` table is no longer used (you can leave it).
