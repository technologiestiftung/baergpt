-- Checks the order of B-tree indexes on collated (text-like) columns with amcheck. The Postgres 17 image ships a
-- newer glibc, whose collation rules may sort some strings differently than when an index was built.
-- Read-only. Prints "REINDEX NEEDED" per index out of order and "CHECK ERROR" per index amcheck could not check;
-- nothing else on stdout.
\set ON_ERROR_STOP 1
\set QUIET on
\pset tuples_only on
\pset format unaligned

SELECT NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'amcheck') AS amcheck_created \gset
CREATE EXTENSION IF NOT EXISTS amcheck WITH SCHEMA extensions;
CREATE TEMP TABLE amcheck_failed (idx text, verdict text, error text);

DO $$
DECLARE
	r record;
	checked int := 0;
BEGIN
	FOR r IN
		SELECT i.indexrelid::regclass AS idx
		FROM pg_index i
		JOIN pg_class c ON c.oid = i.indexrelid
		JOIN pg_am am ON am.oid = c.relam
		JOIN pg_namespace n ON n.oid = c.relnamespace
		-- relkind 'i' only: a partitioned table's parent index ('I') holds no data; its partitions' indexes are checked.
		WHERE c.relkind = 'i' AND am.amname = 'btree' AND i.indisvalid AND i.indisready AND c.relpersistence <> 't'
			AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_toast%'
			AND EXISTS (
				SELECT 1 FROM unnest(i.indcollation::oid[]) AS k(coll)
				JOIN pg_collation pc ON pc.oid = k.coll
				WHERE pc.collname NOT IN ('C', 'POSIX', 'ucs_basic'))
	LOOP
		BEGIN
			PERFORM extensions.bt_index_check(r.idx);
		EXCEPTION
			WHEN index_corrupted THEN
				INSERT INTO amcheck_failed VALUES (r.idx::text, 'REINDEX NEEDED', SQLERRM);
			WHEN OTHERS THEN
				INSERT INTO amcheck_failed VALUES (r.idx::text, 'CHECK ERROR', SQLERRM);
		END;
		checked := checked + 1;
	END LOOP;
	RAISE NOTICE 'amcheck: checked % indexes', checked;
END $$;

\if :amcheck_created
DROP EXTENSION amcheck;
\endif

SELECT verdict || ': ' || idx || ' (' || error || ')' FROM amcheck_failed;
