`Group(Bundle)([]Row,error)`. Rows preserve object, reason, type, count, firstOccurrence, lastOccurrence, observedAt and sorted eventUIDs. Reject an event UID reused for another object, reason or type.

Deduplicate event snapshots before summing distinct series.
