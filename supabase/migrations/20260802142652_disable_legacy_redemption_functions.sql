-- 保留旧数据与函数定义用于必要时回退，但撤销所有调用权限。
revoke all on function public.redeem_code(text) from public, anon, authenticated, service_role;
revoke all on function public.redeem_code(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_redeem_codes(integer, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.generate_unique_code(integer) from public, anon, authenticated, service_role;
