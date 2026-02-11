-- Create assignments table
create table public.assignments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  original_text text not null,
  created_at timestamptz default now() not null
);

-- Create checklist_steps table
create table public.checklist_steps (
  id uuid default gen_random_uuid() primary key,
  assignment_id uuid references public.assignments(id) on delete cascade not null,
  step_number integer not null,
  title text not null,
  description text not null,
  completed boolean default false not null,
  chat_history jsonb default '[]'::jsonb not null,
  created_at timestamptz default now() not null
);

-- Create indexes
create index idx_assignments_user_id on public.assignments(user_id);
create index idx_checklist_steps_assignment_id on public.checklist_steps(assignment_id);

-- Enable Row Level Security
alter table public.assignments enable row level security;
alter table public.checklist_steps enable row level security;

-- RLS policies for assignments
create policy "Users can view their own assignments"
  on public.assignments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own assignments"
  on public.assignments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own assignments"
  on public.assignments for update
  using (auth.uid() = user_id);

create policy "Users can delete their own assignments"
  on public.assignments for delete
  using (auth.uid() = user_id);

-- RLS policies for checklist_steps (through assignment ownership)
create policy "Users can view steps of their assignments"
  on public.checklist_steps for select
  using (
    exists (
      select 1 from public.assignments
      where assignments.id = checklist_steps.assignment_id
      and assignments.user_id = auth.uid()
    )
  );

create policy "Users can insert steps for their assignments"
  on public.checklist_steps for insert
  with check (
    exists (
      select 1 from public.assignments
      where assignments.id = checklist_steps.assignment_id
      and assignments.user_id = auth.uid()
    )
  );

create policy "Users can update steps of their assignments"
  on public.checklist_steps for update
  using (
    exists (
      select 1 from public.assignments
      where assignments.id = checklist_steps.assignment_id
      and assignments.user_id = auth.uid()
    )
  );

create policy "Users can delete steps of their assignments"
  on public.checklist_steps for delete
  using (
    exists (
      select 1 from public.assignments
      where assignments.id = checklist_steps.assignment_id
      and assignments.user_id = auth.uid()
    )
  );