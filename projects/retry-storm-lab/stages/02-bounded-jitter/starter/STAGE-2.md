`Delay(p Policy,client,attempt int) int`, with attempt numbered from 1 for the first retry wait. Formula for jitter: ((client+1)*1103515245 + attempt*12345 + seed) modulo (cap+1), using uint64 arithmetic. `Validate` rejects invalid bounds.

Spread scheduled retries with a reproducible client-specific sequence.
