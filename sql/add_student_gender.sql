-- Add gender on students (Male / Female) for class & attendance separation
alter table public.students
  add column if not exists gender text;

-- Backfill from batch name when possible
update public.students s
set gender = case
  when b.name ~* 'female' then 'Female'
  when b.name ~* 'male' then 'Male'
  else s.gender
end
from public.batches b
where s.batch_id = b.id
  and (s.gender is null or btrim(s.gender) = '');

notify pgrst, 'reload schema';

select gender, count(*) from public.students group by gender order by gender;
