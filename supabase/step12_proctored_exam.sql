-- Step 12: 現場考試考題保護
-- 學生可以登入看 Progress，但不能直接透過 Supabase 查詢 writing_tests 題目。
-- 考題改由 Next.js server-side exam-session API 在監考老師授權後提供。

drop policy if exists "writing_tests_authenticated_select"
on public.writing_tests;

-- 保留 SELECT grant，讓 Teacher RLS policy 仍能工作。
-- 一般學生因沒有符合的 RLS policy，查詢 writing_tests 會得到 0 rows。
grant select on public.writing_tests to authenticated;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'writing_tests'
order by policyname;
