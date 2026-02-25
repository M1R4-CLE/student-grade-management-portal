This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Run `npm run dev`.

The app expects these tables in Supabase: `profiles`, `courses`, `enrollments`, and `grades`.

### Performance Timeline Table (for Student Grades page)

Run the SQL below in Supabase SQL Editor to enable real timeline rows (Attendance, Quiz, Activity, Exam):

```sql
create table if not exists public.student_performance_logs (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  event_date date not null,
  type text not null check (type in ('Attendance', 'Quiz', 'Activity', 'Exam')),
  item text not null,
  status text not null check (status in ('Present', 'Absent', 'Graded', 'Submitted', 'Missing', 'Upcoming', 'Pending')),
  score text null,
  note text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_perf_logs_student_date
  on public.student_performance_logs (student_id, event_date desc);

create index if not exists idx_perf_logs_course_type
  on public.student_performance_logs (course_id, type);

create or replace function public.set_student_performance_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_perf_logs_updated_at on public.student_performance_logs;
create trigger trg_perf_logs_updated_at
before update on public.student_performance_logs
for each row
execute function public.set_student_performance_logs_updated_at();

alter table public.student_performance_logs enable row level security;

drop policy if exists "students can read own performance logs" on public.student_performance_logs;
create policy "students can read own performance logs"
on public.student_performance_logs
for select
using (student_id = auth.uid());

drop policy if exists "teachers can read course performance logs" on public.student_performance_logs;
create policy "teachers can read course performance logs"
on public.student_performance_logs
for select
using (
  exists (
    select 1
    from public.courses c
    where c.id = student_performance_logs.course_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers can insert course performance logs" on public.student_performance_logs;
create policy "teachers can insert course performance logs"
on public.student_performance_logs
for insert
with check (
  exists (
    select 1
    from public.courses c
    where c.id = student_performance_logs.course_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers can update course performance logs" on public.student_performance_logs;
create policy "teachers can update course performance logs"
on public.student_performance_logs
for update
using (
  exists (
    select 1
    from public.courses c
    where c.id = student_performance_logs.course_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses c
    where c.id = student_performance_logs.course_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers can delete course performance logs" on public.student_performance_logs;
create policy "teachers can delete course performance logs"
on public.student_performance_logs
for delete
using (
  exists (
    select 1
    from public.courses c
    where c.id = student_performance_logs.course_id
      and c.teacher_id = auth.uid()
  )
);

-- Optional sample rows:
insert into public.student_performance_logs (student_id, course_id, event_date, type, item, status, score, note, created_by)
select e.student_id, e.course_id, current_date - 3, 'Attendance', 'Class Meeting', 'Absent', '-', 'Marked absent', c.teacher_id
from public.enrollments e
join public.courses c on c.id = e.course_id
where c.code = 'IS 209'
limit 1;

insert into public.student_performance_logs (student_id, course_id, event_date, type, item, status, score, note, created_by)
select e.student_id, e.course_id, current_date - 2, 'Quiz', 'Quiz 1', 'Graded', '19/20', 'Score posted by teacher', c.teacher_id
from public.enrollments e
join public.courses c on c.id = e.course_id
where c.code = 'IS 209'
limit 1;

insert into public.student_performance_logs (student_id, course_id, event_date, type, item, status, score, note, created_by)
select e.student_id, e.course_id, current_date - 1, 'Activity', 'Activity 3', 'Submitted', '96%', 'Submitted before deadline', c.teacher_id
from public.enrollments e
join public.courses c on c.id = e.course_id
where c.code = 'IS 209'
limit 1;

insert into public.student_performance_logs (student_id, course_id, event_date, type, item, status, score, note, created_by)
select e.student_id, e.course_id, current_date, 'Exam', 'Major Exam', 'Upcoming', '-', 'Scheduled by teacher', c.teacher_id
from public.enrollments e
join public.courses c on c.id = e.course_id
where c.code = 'IS 209'
limit 1;
```
