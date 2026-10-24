-- Mjadala Step 2: persistent public-profile photo framing.
-- Additive only: this does not change existing RLS policies or storage permissions.
-- Run in Supabase Dashboard > SQL Editor, then verify the columns exist before deploying.
begin;

alter table public.profiles
  add column if not exists avatar_position_x integer not null default 50
    check (avatar_position_x between 0 and 100);

alter table public.profiles
  add column if not exists avatar_position_y integer not null default 50
    check (avatar_position_y between 0 and 100);

comment on column public.profiles.avatar_position_x is
  'Horizontal object-position percentage for profile photo, 0 to 100.';
comment on column public.profiles.avatar_position_y is
  'Vertical object-position percentage for profile photo, 0 to 100.';

commit;

-- Verification (run after the migration):
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('avatar_position_x', 'avatar_position_y')
order by column_name;
