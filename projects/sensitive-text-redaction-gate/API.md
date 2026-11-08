# Public API contract

Detect ASCII email patterns, valid IPv4 addresses and explicit literal identifiers. Merge overlapping spans, replace their union without exposing original values in receipts, and export redacted JSONL plus an inspectable HTML ledger.

## Detect bounded sensitive spans

```text
detect(text, literals=()) -> list[dict]
```

Return start/end Python character offsets and kind EMAIL, IPV4 or LITERAL. End is exclusive. Results sort by start, end, kind. Never return matched text. The detector validates dotted addresses with ipaddress rather than accepting every four-number string. Literal matching is case-sensitive and includes overlapping matches.

Invalid text type, text over one million characters, empty literals and more than one hundred literals raise ValueError. More than 10,000 matches in a record also raises ValueError before a partial result is returned. Check the full allowed email-prefix alphabet at the starting boundary so punctuation-only inputs do not trigger repeated scans.

## Merge complete overlap unions

```text
merge_spans(spans, text_length) -> list[dict]
```

Validate each span and sort a copy. Intersecting spans become one union with sorted unique kinds. Adjacent spans remain separate. Do not remove a small nested match and accidentally expose the remainder of a larger one.

Reject Boolean offsets, negative starts, empty spans, ends past text_length and unsupported kinds. Never mutate the caller spans.

## Replace spans without leaking source values

```text
redact(text, literals=()) -> dict
```

Compose detect and merge_spans. Walk left to right, append untouched text and the literal marker [REDACTED], then append the final suffix. Return text, spans and redacted_characters. Each receipt has index, start, end and kinds. Offsets always refer to the original string.

Do not hash short private values into public receipts: those hashes can still support dictionary guessing. Do not include source substrings in exceptions or receipts.

## Export redacted records and bounded evidence

```text
process(records, literals=()) -> dict; render_html(report) -> str
```

Accept up to ten thousand records with exactly id and text. IDs must match [A-Za-z0-9_-]{1,64} and be unique. Return schema_version=1, records, ledger, totals and scope. The provided CLI writes JSONL and a receipt without raw input text. The HTML escapes redacted content and lets a reviewer expand the offset ledger.

Reject extra metadata rather than silently copying an unscanned field to output. A non-sensitive ID is a caller obligation; syntax validation cannot prove that an ID is public.

## Boundaries

This is a bounded pattern-based redactor, not a general PII detector or an anonymization guarantee. It recognizes ASCII email syntax, valid dotted IPv4 addresses and case-sensitive literal strings. Names, phone numbers, IPv6, obfuscated addresses and encoded secrets can remain. IDs must be non-sensitive. Review remaining text before sharing it. The HTML contains only redacted text and offset receipts, never the original values or the configured literal dictionary.
