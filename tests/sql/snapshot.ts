import type { PGlite } from "@electric-sql/pglite";

/** A comparable description of everything a migration can add, change or remove (schema shape, policies, triggers, function bodies and ACLs, buckets, row counts). */
export interface Snapshot {
  tables: Record<string, { rls: boolean; kind: string }>; columns: Record<string, string>; functions: Record<string, { md5: string; acl: string; def: string }>;
  policies: Record<string, string>; policyDefs: Record<string, string>; triggers: Record<string, string>; constraints: Record<string, string>; indexes: Record<string, string>;
  types: string[]; buckets: Record<string, string>; counts: Record<string, number>;
}
const rows = async (db: PGlite, sql: string) => (await db.query<any>(sql)).rows;

export async function snapshot(db: PGlite): Promise<Snapshot> {
  const tables: Snapshot["tables"] = {};
  for (const r of await rows(db, `select n.nspname||'.'||c.relname k, c.relrowsecurity rls, c.relkind kind from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p','v') and n.nspname in ('public','dp_private')`)) tables[r.k] = { rls: r.rls, kind: r.kind };
  const columns: Snapshot["columns"] = {};
  for (const r of await rows(db, `select table_name||'.'||column_name k, data_type||'|'||is_nullable||'|'||coalesce(column_default,'') v from information_schema.columns where table_schema in ('public','dp_private')`)) columns[r.k] = r.v;
  const functions: Snapshot["functions"] = {};
  for (const r of await rows(db, `select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' k, md5(pg_get_functiondef(p.oid)) m, coalesce(p.proacl::text,'') acl, pg_get_functiondef(p.oid) def
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dp_private') and p.prokind='f'`)) functions[r.k] = { md5: r.m, acl: r.acl, def: r.def };
  const policies: Snapshot["policies"] = {};
  for (const r of await rows(db, `select schemaname||'.'||tablename||'.'||policyname k, md5(coalesce(qual,'')||'|'||coalesce(with_check,'')||'|'||cmd||'|'||permissive||'|'||array_to_string(roles,',')) v from pg_policies where schemaname in ('public','storage')`)) policies[r.k] = r.v;
  const policyDefs: Snapshot["policyDefs"] = {};
  for (const r of await rows(db, `select schemaname||'.'||tablename||'.'||policyname k, 'create policy "'||policyname||'" on '||schemaname||'.'||tablename||' as '||permissive||' for '||cmd||' to '||array_to_string(roles,', ')||coalesce(' using ('||qual||')','')||coalesce(' with check ('||with_check||')','')||';' v from pg_policies where schemaname in ('public','storage')`)) policyDefs[r.k] = r.v;
  const triggers: Snapshot["triggers"] = {};
  for (const r of await rows(db, `select c.relname||'.'||t.tgname k, md5(pg_get_triggerdef(t.oid)) v from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','storage')`)) triggers[r.k] = r.v;
  const constraints: Snapshot["constraints"] = {};
  for (const r of await rows(db, `select c.conrelid::regclass::text||'.'||c.conname k, pg_get_constraintdef(c.oid) v from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public')`)) constraints[r.k] = r.v;
  const indexes: Snapshot["indexes"] = {};
  for (const r of await rows(db, `select tablename||'.'||indexname k, indexdef v from pg_indexes where schemaname='public'`)) indexes[r.k] = r.v;
  const types = (await rows(db, `select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'`)).map((r) => r.typname).sort();
  const buckets: Snapshot["buckets"] = {};
  for (const r of await rows(db, `select id k, public||'|'||coalesce(file_size_limit::text,'')||'|'||coalesce(array_to_string(allowed_mime_types,','),'') v from storage.buckets`)) buckets[r.k] = r.v;
  const counts: Snapshot["counts"] = {};
  for (const t of Object.keys(tables).filter((k) => k.startsWith("public.") && tables[k].kind !== "v")) counts[t] = (await rows(db, `select count(*)::int c from ${t}`))[0].c;
  return { tables, columns, functions, policies, policyDefs, triggers, constraints, indexes, types, buckets, counts };
}

/** What differs. Used both to generate rollbacks and to prove a rollback restored the previous state. */
export function diff(a: Snapshot, b: Snapshot) {
  const keysOf = (o: object) => Object.keys(o);
  const added = <T>(x: Record<string, T>, y: Record<string, T>) => keysOf(y).filter((k) => !(k in x));
  const removed = <T>(x: Record<string, T>, y: Record<string, T>) => keysOf(x).filter((k) => !(k in y));
  const changed = <T>(x: Record<string, T>, y: Record<string, T>, eq: (p: T, q: T) => boolean) => keysOf(x).filter((k) => k in y && !eq(x[k], y[k]));
  return {
    tablesAdded: added(a.tables, b.tables), tablesRemoved: removed(a.tables, b.tables), rlsChanged: changed(a.tables, b.tables, (p, q) => p.rls === q.rls),
    columnsAdded: added(a.columns, b.columns), columnsRemoved: removed(a.columns, b.columns), columnsChanged: changed(a.columns, b.columns, (p, q) => p === q),
    functionsAdded: added(a.functions, b.functions), functionsRemoved: removed(a.functions, b.functions), functionsChanged: changed(a.functions, b.functions, (p, q) => p.md5 === q.md5 && p.acl === q.acl),
    policiesAdded: added(a.policies, b.policies), policiesRemoved: removed(a.policies, b.policies), policiesChanged: changed(a.policies, b.policies, (p, q) => p === q),
    triggersAdded: added(a.triggers, b.triggers), triggersRemoved: removed(a.triggers, b.triggers), triggersChanged: changed(a.triggers, b.triggers, (p, q) => p === q),
    constraintsAdded: added(a.constraints, b.constraints), constraintsRemoved: removed(a.constraints, b.constraints), constraintsChanged: changed(a.constraints, b.constraints, (p, q) => p === q),
    indexesAdded: added(a.indexes, b.indexes), indexesRemoved: removed(a.indexes, b.indexes), indexesChanged: changed(a.indexes, b.indexes, (p, q) => p === q),
    typesAdded: b.types.filter((t) => !a.types.includes(t)), typesRemoved: a.types.filter((t) => !b.types.includes(t)),
    bucketsAdded: added(a.buckets, b.buckets), bucketsChanged: changed(a.buckets, b.buckets, (p, q) => p === q), bucketsRemoved: removed(a.buckets, b.buckets),
    rowsChanged: keysOf(a.counts).filter((k) => k in b.counts && a.counts[k] !== b.counts[k]).map((k) => `${k}: ${a.counts[k]} -> ${b.counts[k]}`)
  };
}
export const isEmptyDiff = (d: ReturnType<typeof diff>) => Object.values(d).every((v) => v.length === 0);
