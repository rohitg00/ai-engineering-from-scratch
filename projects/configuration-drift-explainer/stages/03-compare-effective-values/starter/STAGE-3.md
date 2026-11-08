`Compare(in Input) Report` returns `schemaVersion:1`, `drift:boolean`, and sorted `changes`. Each row has `key`, `kind`, `expected`, `observed`, `history`, `redacted`. Sensitive keys match password/secret/token/api-key/credential case-insensitively or the explicit sensitive list.

Distinguish equal, changed, missing and unexpected keys.
