-- Run against a local/migrated database as postgres. Everything rolls back.
begin;
do $$
begin
  assert (select relrowsecurity from pg_class where oid='public.applications'::regclass), 'RLS must be enabled';
  assert not has_table_privilege('anon','public.applications','SELECT'), 'Anonymous reads must be denied';
  assert not has_table_privilege('anon','public.applications','INSERT'), 'Anonymous writes must be denied';
  assert not has_table_privilege('authenticated','public.applications','SELECT'), 'Signed-in reads must be denied';
  assert not has_table_privilege('authenticated','public.applications','INSERT'), 'Signed-in writes must be denied';
end $$;
insert into public.applications(request_id,full_name,email,school,study_year,preferred_role,motivation,consent_version)
values ('12345678-1234-4234-8234-123456789abc','Test Student','test@example.com','School','Year 2','graphics','Test motivation','recruitment-v1');
do $$
begin
  begin
    insert into public.applications(request_id,full_name,email,school,study_year,preferred_role,motivation,consent_version)
    values ('12345678-1234-4234-8234-123456789abc','Test Student','test@example.com','School','Year 2','graphics','Test motivation','recruitment-v1');
    raise exception 'Duplicate request was accepted';
  exception when unique_violation then null;
  end;
end $$;
do $$
begin
  assert (select not public from storage.buckets where id='application-work'), 'Work bucket must be private';
  assert not has_function_privilege('anon','public.unreferenced_application_work()','EXECUTE'), 'Anonymous cleanup must be denied';
  assert not has_function_privilege('authenticated','public.unreferenced_application_work()','EXECUTE'), 'Authenticated cleanup must be denied';
  begin
    update public.applications set preferred_role='events',work_description='creative draft'
    where request_id='12345678-1234-4234-8234-123456789abc';
    raise exception 'Noncreative work was accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;
