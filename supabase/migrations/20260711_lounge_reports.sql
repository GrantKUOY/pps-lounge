create table if not exists public.lounge_reports (
  id uuid primary key default gen_random_uuid(),
  lounge_key text not null,
  airport_code text not null,
  lounge_name text not null,
  nickname text not null,
  email text not null,
  visit_date date not null,
  airline_flight text,
  cabin_class text,
  access_source text,
  entry_result text not null check (entry_result in ('success', 'denied', 'limited', 'unknown')),
  queue_level text not null check (queue_level in ('none', 'short', 'medium', 'long')),
  crowd_level text not null check (crowd_level in ('quiet', 'normal', 'busy', 'full')),
  food_rating smallint not null check (food_rating between 1 and 5),
  rest_rating smallint check (rest_rating between 1 and 5),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lounge_report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lounge_reports(id) on delete cascade,
  storage_path text not null,
  public_url text,
  sort_order smallint not null check (sort_order between 0 and 4),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now(),
  unique (report_id, sort_order)
);

create index if not exists lounge_reports_public_lookup
  on public.lounge_reports (lounge_key, status, visit_date desc);

alter table public.lounge_reports enable row level security;
alter table public.lounge_report_photos enable row level security;

drop policy if exists "public can read approved reports" on public.lounge_reports;
create policy "public can read approved reports"
on public.lounge_reports
for select
using (status = 'approved');

drop policy if exists "public can insert pending reports" on public.lounge_reports;
create policy "public can insert pending reports"
on public.lounge_reports
for insert
with check (status = 'pending');

drop policy if exists "public can read approved report photos" on public.lounge_report_photos;
create policy "public can read approved report photos"
on public.lounge_report_photos
for select
using (
  exists (
    select 1 from public.lounge_reports
    where lounge_reports.id = lounge_report_photos.report_id
      and lounge_reports.status = 'approved'
  )
);

drop policy if exists "public can insert report photos" on public.lounge_report_photos;
create policy "public can insert report photos"
on public.lounge_report_photos
for insert
with check (
  exists (
    select 1 from public.lounge_reports
    where lounge_reports.id = lounge_report_photos.report_id
      and lounge_reports.status = 'pending'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lounge-report-photos',
  'lounge-report-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "public can upload pending report photos" on storage.objects;
create policy "public can upload pending report photos"
on storage.objects
for insert
with check (
  bucket_id = 'lounge-report-photos'
  and exists (
    select 1 from public.lounge_reports
    where lounge_reports.id::text = split_part(storage.objects.name, '/', 2)
      and lounge_reports.status = 'pending'
  )
);

drop policy if exists "public can read report photos" on storage.objects;
create policy "public can read report photos"
on storage.objects
for select
using (bucket_id = 'lounge-report-photos');
