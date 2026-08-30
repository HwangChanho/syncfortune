import { q } from './q.mjs';
const p = (label, v) => console.log(label, JSON.stringify(v));
p('① 결제 관련 테이블 :', (await q(`
  select table_name from information_schema.tables
  where table_schema='public'
    and (table_name ~ 'order|purchase|coin|payment|ledger|unlock')
  order by 1`)).map(r => r.table_name));
p('② 적립 RPC 권한   :', await q(`
  select p.proname, coalesce(array_to_string(p.proacl,' | '),'(default=PUBLIC)') acl
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('grant_coins','spend_coins','spend_coins_owner','spend_coins_fixed','buy_ad_free','claim_unlock')
  order by 1`));
p('③ 코인 소비 실적  :', await q(`
  select reason, count(*) n, sum(delta) woon from coin_ledger where delta<0 group by 1 order by n desc limit 6`));
p('④ purchases 컬럼  :', (await q(`
  select column_name from information_schema.columns where table_schema='public' and table_name='purchases' order by ordinal_position`)).map(r=>r.column_name));
p('⑤ app_flags       :', await q(`select key, enabled from app_flags order by key`));
