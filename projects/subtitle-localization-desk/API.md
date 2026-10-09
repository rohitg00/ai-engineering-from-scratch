# Public API

All functions live in `main.py`. Invalid inputs raise `ValueError` unless stated otherwise. CLI failures exit nonzero; source inputs are preserved.

### `parse_vtt`

```python
def parse_vtt(text):
```

Parse UTF-8 WebVTT text into cues {id,start,end,settings,text,duration}. Preserve timestamp strings and supplied IDs; assign cue-N to absent IDs. Allow overlapping cues with nondecreasing starts. Ignore NOTE blocks; reject STYLE/REGION blocks and malformed/duplicate/empty cues.

### `propose`

```python
def propose(cues, translations, glossary):
```

Return cue proposals with proposed text, needs_translation and required_terms. translations maps known cue IDs to nonempty target text. glossary maps source phrases to required target phrases; replace residual source terms longest-first in supplied proposals. Missing translations retain source text and remain unapproved.

### `inspect`

```python
def inspect(proposals, cps=17):
```

Return review rows with characters, cps, budget and flags. Count visible non-whitespace Unicode code points after stripping cue tags; budget=floor(duration*cps). Flags identify missing translations, missing required terms and reading-budget overflow. cps must be positive and finite.

### `export_localized`

```python
def export_localized(proposals, decisions=None, cps=17):
```

Return {schema_version,fingerprint,cues,all_reviewed,vtt}. Review {fingerprint,cues:{id:{text,approved,override_budget?}}} is bound to proposals and reading budget. Approved text must satisfy glossary and structural syntax; over-budget approval needs explicit override_budget=true. vtt is None until every cue is approved.

## Files and integration

Input JSON contains vtt, translations, glossary and optional cps. Outputs review.html and translation-decisions.json. Download decisions.json, edit cue text and approved flags, then rerun with --decisions decisions.json. reviewed.vtt is created only when all cues are approved; an over-budget cue additionally needs override_budget=true. Consume reviewed.vtt with parse_vtt or a video player WebVTT track.
