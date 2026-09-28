-- Integration assertions use disposable fixtures and always roll back.
begin;
do $$
declare
 owner_id uuid := gen_random_uuid(); ambassador_user uuid := gen_random_uuid(); other_user uuid := gen_random_uuid();
 a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); token_a uuid := gen_random_uuid(); token_b uuid := gen_random_uuid();
 u uuid := gen_random_uuid(); outsider uuid := gen_random_uuid(); old_user uuid := gen_random_uuid(); expired_user uuid := gen_random_uuid(); disabled_user uuid := gen_random_uuid();
 expired_token uuid := gen_random_uuid(); result record; n integer; table_name text;
begin
 insert into auth.users(id,email,created_at) values
 (owner_id,owner_id||'@ambassador-test.invalid',now()),
 (ambassador_user,ambassador_user||'@ambassador-test.invalid',now()),
 (other_user,other_user||'@ambassador-test.invalid',now()),
 (old_user,old_user||'@ambassador-test.invalid',now());
 insert into public.ambassadors(id,user_id,name,code,created_by) values
 (a,ambassador_user,'A',replace(a::text,'-',''),owner_id),
 (b,other_user,'B',replace(b::text,'-',''),owner_id);
 insert into public.ambassador_visits(token,ambassador_id) values(token_a,a),(token_b,b);
 insert into public.ambassador_visits(token,ambassador_id,expires_at) values(expired_token,a,now()-interval '1 day');
 insert into auth.users(id,email,created_at,raw_user_meta_data) values
 (u,u||'@ambassador-test.invalid',now(),jsonb_build_object('ambassador_token',token_a)),
 (outsider,outsider||'@ambassador-test.invalid',now(),jsonb_build_object('ambassador_token',token_b)),
 (expired_user,expired_user||'@ambassador-test.invalid',now(),jsonb_build_object('ambassador_token',expired_token));
 if not exists(select 1 from public.user_referrals where user_id=u and ambassador_id=a) then raise exception 'new signup was not attributed'; end if;
 if exists(select 1 from public.user_referrals where user_id=expired_user) then raise exception 'expired visit was accepted'; end if;
 update auth.users set raw_user_meta_data=jsonb_build_object('ambassador_token',token_b) where id=u;
 update auth.users set raw_user_meta_data=jsonb_build_object('ambassador_token',token_a) where id=old_user;
 if not exists(select 1 from public.user_referrals where user_id=u and ambassador_id=a) then raise exception 'attribution changed'; end if;
 if exists(select 1 from public.user_referrals where user_id=old_user) then raise exception 'old account acquired attribution'; end if;
 update public.ambassadors set active=false where id=a;
 insert into auth.users(id,email,raw_app_meta_data) values(disabled_user,disabled_user||'@ambassador-test.invalid',jsonb_build_object('ambassador_token',token_a));
 if exists(select 1 from public.user_referrals where user_id=disabled_user) then raise exception 'disabled ambassador attributed new signup'; end if;
 if not exists(select 1 from public.user_referrals where user_id=u) then raise exception 'disable removed history'; end if;
 insert into public.payment_orders(user_id,out_trade_no,package_id,subject,coins,amount_cents,status,paid_at,credited_at) values
 (u,gen_random_uuid()::text,'test','test',10,1000,'paid','2026-09-01T16:00:00Z',now()),
 (u,gen_random_uuid()::text,'test','test',10,500,'refunded','2026-09-01T16:00:00Z',now()),
 (u,gen_random_uuid()::text,'test','test',10,900,'pending',null,null),
 (u,gen_random_uuid()::text,'test','test',10,800,'paid','2026-09-01T16:00:00Z',null),
 (u,gen_random_uuid()::text,'test','test',10,700,'paid','2026-09-02T16:00:00Z',now()),
 (outsider,gen_random_uuid()::text,'test','test',10,99999,'paid','2026-09-01T16:00:00Z',now());
 insert into public.wechat_payment_orders(user_id,out_trade_no,package_id,subject,coins,amount_cents,status,paid_at,credited_at) values
 (u,gen_random_uuid()::text,'test','test',10,2000,'paid','2026-09-01T16:00:00Z',now());
 insert into public.apple_iap_transactions(user_id,transaction_id,original_transaction_id,product_id,environment,coins,signed_transaction,created_at) values
 (u,gen_random_uuid()::text,gen_random_uuid()::text,'test','Production',10,'test','2026-09-01T16:00:00Z'),
 (u,gen_random_uuid()::text,gen_random_uuid()::text,'test','Sandbox',10,'test','2026-09-01T16:00:00Z');
 select * into result from public.ambassador_performance(a,'2026-09-01T16:00:00Z','2026-09-02T16:00:00Z');
 if result.registered_users<>1 or result.paid_users<>1 or result.paid_orders<>2 or result.paid_cents<>3000 or result.refunded_orders<>1 or result.refunded_cents<>500 or result.apple_orders<>1 then raise exception 'report calculation failed: %',row_to_json(result); end if;
 select count(*) into n from public.ambassador_payment_orders where ambassador_id=a and user_id=outsider;
 if n<>0 then raise exception 'cross ambassador data leakage'; end if;
 foreach table_name in array array['ambassadors','ambassador_visits','user_referrals','ambassador_payment_orders','ambassador_wechat_payment_orders','ambassador_apple_iap_transactions','ambassador_user_profiles','ambassador_user_daily_activity','ambassador_jianzhongsheng_answers','ambassador_jianzhongsheng_comments','ambassador_jianzhongsheng_reports'] loop
   if has_table_privilege('anon','public.'||table_name,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||table_name,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'client grant on %',table_name; end if;
 end loop;
 if has_function_privilege('authenticated','public.ambassador_performance(uuid,timestamptz,timestamptz)','EXECUTE') or has_function_privilege('anon','public.ambassador_performance(uuid,timestamptz,timestamptz)','EXECUTE') then raise exception 'public RPC grant'; end if;
 if has_table_privilege('service_role','public.user_referrals','INSERT,UPDATE,DELETE') then raise exception 'attribution should be trigger-only'; end if;
end $$;
set local role service_role;
select count(*) >= 0 as service_role_can_read from public.ambassador_user_profiles;
select count(*) >= 0 as service_role_can_report from public.ambassador_performance();
rollback;
