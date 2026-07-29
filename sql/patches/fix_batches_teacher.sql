-- Add teacher_id to batches (needed for teacher class isolation)
alter table public.batches
  add column if not exists teacher_id uuid references public.teachers(id) on delete set null;

create index if not exists idx_batches_teacher_id on public.batches(teacher_id);

-- Ensure students.course_id exists
alter table public.students
  add column if not exists course_id uuid references public.courses(id) on delete set null;

notify pgrst, 'reload schema';

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'batches'
order by ordinal_position;
