import datetime
import hashlib
import html
import json
import math
import re


def validate_schema(schema):
    if not isinstance(schema, list) or not 1 <= len(schema) <= 30:
        raise ValueError('Schema needs 1 to 30 fields')
    names = set()
    aliases = set()
    for field in schema:
        if not isinstance(field, dict) or not isinstance(field.get('name'), str) or not re.fullmatch(r'[a-z][a-z0-9_]{0,40}', field.get('name', '')):
            raise ValueError('Field needs a simple lowercase name')
        if field['name'] in names or field.get('type') not in {'text', 'integer', 'number', 'date'} or not isinstance(field.get('required'), bool):
            raise ValueError('Duplicate name or invalid type/required flag')
        labels = field.get('labels')
        if not isinstance(labels, list) or not labels or any(not isinstance(label, str) or not label.strip() or ':' in label or '\n' in label for label in labels):
            raise ValueError('Each field needs one or more line labels')
        for label in labels:
            key = label.strip().casefold()
            if key in aliases:
                raise ValueError('Labels must be unique across the schema')
            aliases.add(key)
        names.add(field['name'])
    return schema


def extract_candidates(text, schema):
    validate_schema(schema)
    if not isinstance(text, str) or len(text) > 100000:
        raise ValueError('Document must contain at most 100000 characters')
    labels = {label.strip().casefold(): field['name'] for field in schema for label in field['labels']}
    candidates = []
    for match in re.finditer(r'(?m)^([^:\r\n]+):[ \t]*([^\r\n]*)', text):
        name = labels.get(match.group(1).strip().casefold())
        quote = match.group(2).strip()
        if name and quote:
            start = match.start(2) + len(match.group(2)) - len(match.group(2).lstrip())
            candidates.append({'name': name, 'quote': quote, 'start': start, 'end': start + len(quote)})
    return candidates


def typed_value(quote, kind):
    if kind == 'text':
        return quote
    if kind == 'integer':
        if not re.fullmatch(r'[+-]?\d+', quote):
            raise ValueError('Expected a whole number')
        return int(quote)
    if kind == 'number':
        value = float(quote)
        if not math.isfinite(value):
            raise ValueError('Expected a finite number')
        return value
    if kind == 'date':
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', quote):
            raise ValueError('Use an ISO date: YYYY-MM-DD')
        return datetime.date.fromisoformat(quote).isoformat()
    raise ValueError('Unknown field type')


def review_document(text, schema, candidates, decisions=None):
    validate_schema(schema)
    if not isinstance(text, str) or len(text) > 100000 or not isinstance(candidates, list) or len(candidates) > 300:
        raise ValueError('Invalid document or candidate limits')
    digest = hashlib.sha256(text.encode()).hexdigest()
    choices = {}
    if decisions is not None:
        if not isinstance(decisions, dict) or decisions.get('sourceSha256') != digest or not isinstance(decisions.get('choices'), dict):
            raise ValueError('Approval belongs to another document version')
        choices = decisions['choices']
    fields = {field['name']: field for field in schema}
    if set(choices) - set(fields):
        raise ValueError('Approval names an unknown field')
    grouped = {name: [] for name in fields}
    seen = set()
    for candidate in candidates:
        if not isinstance(candidate, dict) or candidate.get('name') not in fields:
            raise ValueError('Proposal names an unknown field')
        start, end, quote = candidate.get('start'), candidate.get('end'), candidate.get('quote')
        if type(start) is not int or type(end) is not int or not 0 <= start < end <= len(text) or text[start:end] != quote:
            raise ValueError('Proposal does not match its exact source span')
        key = (candidate['name'], start, end)
        if key in seen:
            continue
        seen.add(key)
        try:
            value = typed_value(quote, fields[candidate['name']]['type'])
            issue = None
        except ValueError as error:
            value, issue = None, str(error)
        grouped[candidate['name']].append({**candidate, 'value': value, 'issue': issue})
    result, approved = [], {}
    for name, field in fields.items():
        options = grouped[name]
        chosen = choices.get(name)
        matches = [c for c in options if chosen == {'start': c['start'], 'end': c['end']} and c['issue'] is None]
        if chosen is not None and len(matches) != 1:
            raise ValueError('Approval must select one valid source candidate')
        if matches:
            state = 'approved'
        elif not options:
            state = 'missing'
        elif len(options) > 1:
            state = 'ambiguous'
        elif options[0]['issue']:
            state = 'invalid'
        else:
            state = 'proposed'
        if matches:
            approved[name] = matches[0]['value']
        result.append({'name': name, 'type': field['type'], 'required': field['required'], 'state': state, 'selected': {'start': matches[0]['start'], 'end': matches[0]['end']} if matches else None, 'candidates': options})
    ready = all(not field['required'] or field['state'] == 'approved' for field in result)
    return {'schemaVersion': 1, 'sourceSha256': digest, 'status': 'approved' if ready else 'needs_review',
            'fields': result, 'approvedValues': approved, 'text': text,
            'scope': 'Offsets prove provenance. A reviewer must still confirm that a value belongs to the named field.'}


def render_review(report):
    esc = lambda value: html.escape(str(value), quote=True)
    fields = []
    for field in report['fields']:
        options = []
        for c in field['candidates']:
            disabled = ' disabled' if c['issue'] else ''
            checked = ' checked' if field.get('selected') == {'start': c['start'], 'end': c['end']} else ''
            options.append('<label class="candidate"><input type="radio" name="' + esc(field['name']) + '" data-start="' + str(c['start']) + '" data-end="' + str(c['end']) + '"' + disabled + checked + '> ' + esc(c['quote']) + '<small>' + esc(c['issue'] or f"source characters {c['start']}..{c['end']}") + '</small></label>')
        fields.append('<section><h2>' + esc(field['name']) + ' <small>' + esc(field['state']) + '</small></h2>' + (''.join(options) or '<p>No source candidate. Correct the input before approval.</p>') + '</section>')
    payload = json.dumps({'sourceSha256': report['sourceSha256'], 'text': report['text']}, ensure_ascii=True).replace('<', '\\u003c')
    script = """const data=JSON.parse(document.querySelector('#source-data').textContent);const view=document.querySelector('#source');const characters=Array.from(data.text);document.querySelectorAll('input[type=radio]').forEach(input=>input.addEventListener('change',()=>{const start=Number(input.dataset.start),end=Number(input.dataset.end);const mark=document.createElement('mark');mark.textContent=characters.slice(start,end).join('');view.replaceChildren(document.createTextNode(characters.slice(0,start).join('')),mark,document.createTextNode(characters.slice(end).join('')));}));document.querySelector('#download').addEventListener('click',()=>{const choices={};document.querySelectorAll('input:checked').forEach(input=>{choices[input.name]={start:Number(input.dataset.start),end:Number(input.dataset.end)};});const blob=new Blob([JSON.stringify({sourceSha256:data.sourceSha256,choices},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='approvals.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('#status').textContent='Saved selected source spans. Apply approvals with the CLI to validate and export.';});"""
    return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Document extraction review</title><style>body{font:16px system-ui;color:#182638;background:#f6f8fa;max-width:1100px;margin:30px auto;padding:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}section,pre{background:white;border:1px solid #ccd6e0;padding:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;align-self:start;position:sticky;top:15px}h2{font-size:18px}small{font-size:12px;color:#566678}.candidate{display:block;padding:10px;border-bottom:1px solid #e5e9ee;cursor:pointer}.candidate small{display:block;margin-left:22px}button{background:#244d99;color:white;padding:12px 18px;border:0;border-radius:4px}mark{background:#ffeb96}@media(max-width:700px){.grid{grid-template-columns:1fr}pre{position:static}}</style><h1>Review the field against its source</h1><p>' + esc(report['scope']) + '</p><p>Status: <strong>' + esc(report['status']) + '</strong></p><div class="grid"><div>' + ''.join(fields) + '</div><pre id="source">' + esc(report['text']) + '</pre></div><button id="download">Download selected approvals</button><p id="status" role="status"></p><script id="source-data" type="application/json">' + payload + '</script><script>' + script + '</script></html>'
