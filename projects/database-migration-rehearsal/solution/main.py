import sqlite3, json, hashlib, time
from pathlib import Path
from urllib.parse import quote


def _snapshot(connection):
    schema = [
        {"type": r[0], "name": r[1], "table": r[2], "sql": r[3]}
        for r in connection.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"
        )
    ]
    tables = {}
    for r in schema:
        if r["type"] != "table":
            continue
        name = r["name"].replace('"', '""')
        rows = []
        for row in connection.execute('SELECT * FROM "' + name + '"'):
            rows.append(
                json.dumps(
                    [{"blob": v.hex()} if isinstance(v, bytes) else v for v in row],
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            )
        rows.sort()
        tables[r["name"]] = {
            "rows": len(rows),
            "data_hash": hashlib.sha256("\n".join(rows).encode()).hexdigest(),
        }
    sequence = []
    if connection.execute(
        "SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'"
    ).fetchone():
        sequence = [
            list(r)
            for r in connection.execute(
                "SELECT name,seq FROM sqlite_sequence ORDER BY name"
            )
        ]
    return {"schema": schema, "tables": tables, "sequences": sequence}


def _clone(source):
    path = Path(source).resolve()
    if not path.is_file():
        raise ValueError("source database must exist")
    original = sqlite3.connect(
        "file:" + quote(str(path), safe="/") + "?mode=ro", uri=True
    )
    copy = sqlite3.connect(":memory:")
    try:
        original.backup(copy)
    finally:
        original.close()
    return copy


def snapshot(source):
    """Read an existing SQLite file through a read-only connection and backup into memory. Return schema definitions, table row counts, order-independent row-content SHA-256 hashes and AUTOINCREMENT sequences. Source is never opened writable."""
    connection = _clone(source)
    try:
        return _snapshot(connection)
    finally:
        connection.close()


def _execute(connection, sql):
    if not isinstance(sql, str) or not sql.strip():
        raise ValueError("nonempty SQL required")
    deadline = time.monotonic() + 2
    denied = {
        sqlite3.SQLITE_ATTACH,
        sqlite3.SQLITE_DETACH,
        sqlite3.SQLITE_PRAGMA,
        sqlite3.SQLITE_CREATE_VTABLE,
        sqlite3.SQLITE_DROP_VTABLE,
    }

    def authorize(action, arg1, arg2, database, trigger):
        if action in denied or (
            action == sqlite3.SQLITE_FUNCTION
            and str(arg2).lower() in ("load_extension", "writefile", "readfile")
        ):
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    connection.set_authorizer(authorize)
    connection.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
    try:
        connection.executescript(sql)
        return None
    except sqlite3.Error as error:
        return str(error)
    finally:
        connection.set_authorizer(None)
        connection.set_progress_handler(None, 0)


def _diff(before, after):
    old = {r["type"] + ":" + r["name"]: r["sql"] for r in before["schema"]}
    new = {r["type"] + ":" + r["name"]: r["sql"] for r in after["schema"]}
    return [
        {"object": key, "before": old.get(key), "after": new.get(key)}
        for key in sorted(set(old) | set(new))
        if old.get(key) != new.get(key)
    ]


def rehearse(source, migration):
    """Apply SQL only to an in-memory backup. Return {before,after,schema_diff,error,applied}; after records even partially applied scripts when an error occurs. ATTACH, DETACH, PRAGMA, virtual-table creation and extension/file functions are denied; long statements are interrupted after a two-second progress deadline. This is SQLite policy, not OS isolation."""
    connection = _clone(source)
    try:
        before = _snapshot(connection)
        error = _execute(connection, migration)
        after = _snapshot(connection)
        return {
            "before": before,
            "after": after,
            "schema_diff": _diff(before, after),
            "error": error,
            "applied": error is None,
        }
    finally:
        connection.close()


def test_rollback(source, migration, rollback):
    """Reapply migration and declared rollback to one disposable backup. Return migration evidence plus {rollback_error,restored,reversible}. restored is the post-rollback snapshot; reversible requires successful forward and rollback scripts and exact equality of schema, row content and sequences to before. No automatic rollback SQL is invented."""
    connection = _clone(source)
    try:
        before = _snapshot(connection)
        error = _execute(connection, migration)
        after = _snapshot(connection)
        rollback_error = (
            _execute(connection, rollback)
            if error is None
            else "forward migration failed"
        )
        restored = _snapshot(connection)
        return {
            "before": before,
            "after": after,
            "schema_diff": _diff(before, after),
            "error": error,
            "applied": error is None,
            "rollback_error": rollback_error,
            "restored": restored,
            "reversible": error is None
            and rollback_error is None
            and (before == restored),
        }
    finally:
        connection.close()


def receipt(source, migration, rollback, invariants):
    """Return schema_version=1 rehearsal with invariant_results and release_ready. invariants is [{table,min_rows?,max_rows?,same_rows?,preserve_data?}]. Missing tables fail. preserve_data compares full row hashes, intended for unchanged-schema tables. Release readiness requires all invariants, successful forward SQL and demonstrated exact rollback; this is evidence for a human release decision."""
    for rule in invariants:
        if (
            not isinstance(rule, dict)
            or not isinstance(rule.get("table"), str)
            or (not rule["table"])
        ):
            raise ValueError("invariant table required")
        if not set(rule) <= {
            "table",
            "min_rows",
            "max_rows",
            "same_rows",
            "preserve_data",
        }:
            raise ValueError("unknown invariant field")
        for key in ("min_rows", "max_rows"):
            if key in rule and (type(rule[key]) is not int or rule[key] < 0):
                raise ValueError("row bound must be a nonnegative integer")
        for key in ("same_rows", "preserve_data"):
            if key in rule and type(rule[key]) is not bool:
                raise ValueError("invariant flags must be booleans")
    result = test_rollback(source, migration, rollback)
    checks = []
    for rule in invariants:
        name = rule["table"]
        before = result["before"]["tables"].get(name)
        after = result["after"]["tables"].get(name)
        failures = []
        if after is None:
            failures.append("table missing after migration")
        else:
            if "min_rows" in rule and after["rows"] < rule["min_rows"]:
                failures.append("below min_rows")
            if "max_rows" in rule and after["rows"] > rule["max_rows"]:
                failures.append("above max_rows")
            if rule.get("same_rows") and (
                before is None or before["rows"] != after["rows"]
            ):
                failures.append("row count changed")
            if rule.get("preserve_data") and (
                before is None or before["data_hash"] != after["data_hash"]
            ):
                failures.append("row content changed")
        checks.append(
            {
                "table": name,
                "passed": not failures,
                "failures": failures,
                "before_rows": before["rows"] if before else None,
                "after_rows": after["rows"] if after else None,
            }
        )
    return {
        "schema_version": 1,
        **result,
        "invariant_results": checks,
        "release_ready": result["reversible"] and all((c["passed"] for c in checks)),
    }
