import csv
from decimal import Decimal, InvalidOperation
import hashlib
import html
import io
import json
import math
import re
import sqlite3


def load_csv(text, max_rows=10000):
    if not isinstance(text, str) or len(text.encode('utf-8')) > 2_000_000:
        raise ValueError('CSV must be UTF-8 text under 2 MB')
    if not isinstance(max_rows, int) or isinstance(max_rows, bool) or max_rows < 1:
        raise ValueError('max_rows must be a positive integer')
    reader = csv.reader(io.StringIO(text.lstrip('\ufeff')), strict=True)
    try:
        headers = next(reader)
        if not headers or any(not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}', h) for h in headers):
            raise ValueError('Use simple nonempty column names: letters, digits, underscore')
        if len({h.casefold() for h in headers}) != len(headers) or len(headers) > 50:
            raise ValueError('Column names must be unique; at most 50 columns')
        rows = []
        for record in reader:
            if len(record) != len(headers):
                raise ValueError(f'CSV record {len(rows) + 2} has the wrong column count')
            rows.append(record)
            if len(rows) > max_rows:
                raise ValueError('CSV row limit exceeded')
    except (StopIteration, csv.Error) as error:
        raise ValueError('CSV needs a valid header and records') from error
    types = []
    for i in range(len(headers)):
        values = [r[i] for r in rows if r[i] != '']
        numeric = bool(values)
        for value in values:
            value = value.strip()
            if not re.fullmatch(r'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?', value) or re.fullmatch(r'[+-]?0[0-9]+', value):
                numeric = False
                break
            try:
                number, exact = float(value), Decimal(value)
                if not math.isfinite(number) or abs(exact) > 2 ** 53 - 1 or (number == 0 and exact != 0):
                    numeric = False
                    break
            except (ValueError, InvalidOperation):
                numeric = False
                break
        types.append('REAL' if numeric else 'TEXT')
    return {'columns': headers, 'types': types, 'rows': rows,
            'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest()}


def plan_question(question, data):
    if not isinstance(question, str) or len(question) > 500:
        raise ValueError('Question must contain at most 500 characters')
    words = ' '.join(question.lower().strip().rstrip('?').split())
    columns = {name.lower(): name for name in data['columns']}
    if words in {'show rows', 'show all rows'}:
        return 'SELECT * FROM data'
    if words in {'count rows', 'how many rows'}:
        return 'SELECT COUNT(*) AS count FROM data'
    match = re.fullmatch(r'(count|sum|average|avg|min|max)(?: ([a-z][a-z0-9_]*))? by ([a-z][a-z0-9_]*)', words)
    if not match:
        raise ValueError('Try "count rows", "show rows", or "sum units by region"; use --sql for other reads')
    operation, field, group = match.groups()
    if group not in columns or (field and field not in columns):
        raise ValueError('Question names an unknown column')
    if operation != 'count' and not field:
        raise ValueError('An aggregate needs a numeric column')
    if field and operation != 'count' and data['types'][data['columns'].index(columns[field])] != 'REAL':
        raise ValueError('Aggregate column must contain finite numeric values')
    function = 'AVG' if operation in {'average', 'avg'} else operation.upper()
    argument = '"' + columns[field] + '"' if field else '*'
    group = '"' + columns[group] + '"'
    return f'SELECT {group}, {function}({argument}) AS value FROM data GROUP BY {group} ORDER BY {group}'


def run_query(data, sql, max_rows=100, max_steps=100000):
    if not isinstance(sql, str) or not sql.strip() or len(sql) > 10000:
        raise ValueError('SQL must be nonempty and under 10000 characters')
    if type(max_rows) is not int or not 1 <= max_rows <= 1000 or not isinstance(max_steps, int) or not 100 <= max_steps <= 1000000:
        raise ValueError('Invalid row or instruction budget')
    connection = sqlite3.connect(':memory:')
    try:
        schema = ', '.join('"' + name + '" ' + kind for name, kind in zip(data['columns'], data['types']))
        connection.execute('CREATE TABLE data (' + schema + ')')
        records = []
        for row in data['rows']:
            converted = []
            for i, value in enumerate(row):
                if value == '':
                    converted.append(None)
                elif data['types'][i] == 'REAL':
                    converted.append(float(value))
                else:
                    converted.append(value)
            records.append(converted)
        connection.executemany('INSERT INTO data VALUES (' + ','.join('?' for _ in data['columns']) + ')', records)
        connection.commit()
        connection.execute('PRAGMA query_only=ON')
        connection.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 1_000_000)
        connection.setlimit(sqlite3.SQLITE_LIMIT_SQL_LENGTH, 10000)
        safe_functions = {'count', 'sum', 'avg', 'min', 'max', 'total', 'round', 'abs', 'lower', 'upper', 'length', 'coalesce', 'ifnull', 'nullif'}

        def authorize(action, first, second, database, trigger):
            if action == sqlite3.SQLITE_SELECT:
                return sqlite3.SQLITE_OK
            if action == sqlite3.SQLITE_READ and first == 'data' and (database == 'main' or database is None and second == ''):
                return sqlite3.SQLITE_OK
            if action == sqlite3.SQLITE_FUNCTION and (second or '').lower() in safe_functions:
                return sqlite3.SQLITE_OK
            return sqlite3.SQLITE_DENY

        steps = 0

        def budget():
            nonlocal steps
            steps += 100
            return int(steps >= max_steps)

        connection.set_authorizer(authorize)
        connection.set_progress_handler(budget, 100)
        cursor = connection.execute(sql)
        if cursor.description is None:
            raise ValueError('A result-producing read is required')
        rows = cursor.fetchmany(max_rows + 1)
        columns = [column[0] for column in cursor.description]
        return {'schemaVersion': 1, 'sourceSha256': data['sha256'], 'sourceRows': len(data['rows']),
                'sql': sql, 'columns': columns, 'rows': rows[:max_rows], 'truncated': len(rows) > max_rows,
                'instructionBudget': max_steps,
                'provenance': 'Source-file fingerprint and executed SQL; arbitrary SQL has no inferred per-row lineage.'}
    except sqlite3.Error as error:
        raise ValueError('Query rejected: ' + str(error)) from error
    finally:
        connection.close()


def render_report(report):
    esc = lambda value: html.escape(str(value))
    head = ''.join('<th scope="col">' + esc(c) + '</th>' for c in report['columns'])
    rows = ''.join('<tr>' + ''.join('<td>' + esc(v if v is not None else 'NULL') + '</td>' for v in row) + '</tr>' for row in report['rows'])
    payload = html.escape(json.dumps(report, ensure_ascii=False, indent=2))
    return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Data question receipt</title><style>body{font:16px system-ui;max-width:980px;margin:40px auto;padding:20px;color:#162334;background:#f7f8fa}h1{font-size:32px}pre{background:#e8edf3;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;background:white}th,td{border:1px solid #ccd5df;padding:12px;text-align:left}.scroll{overflow:auto}.tag{color:#3157a0}summary{cursor:pointer}</style><p class="tag">READ-ONLY DATA WORKBENCH</p><h1>Your question, with an inspectable query</h1><pre>' + esc(report['sql']) + '</pre><p>' + str(report['sourceRows']) + ' source records. ' + ('Result capped; narrow the query.' if report['truncated'] else 'Complete result within the row budget.') + '</p><div class="scroll"><table><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div><h2>Reproduce this answer</h2><p>' + esc(report['provenance']) + '</p><details><summary>Source fingerprint and full receipt</summary><pre>' + payload + '</pre></details></html>'
