-- Supabase's default privileges may grant ALL to service_role on new tables.
-- Remove those before granting the narrow operations used by the application.
revoke all on public.ambassadors, public.ambassador_visits, public.user_referrals from service_role;
grant select, insert, update on public.ambassadors to service_role;
grant select, insert, delete on public.ambassador_visits to service_role;
grant select on public.user_referrals to service_role;
