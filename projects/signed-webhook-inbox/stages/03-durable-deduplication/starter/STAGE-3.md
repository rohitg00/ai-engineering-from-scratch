`Accept(dir,id,body,now)(Entry,created,error)`; `LoadEntry(dir,id)(Entry,error)`. Entry stores schemaVersion, deliveryId, base64 body, sha256 and acceptedAt. `ErrConflict` identifies reused delivery IDs. Corrupt stored records fail closed.

Persist accepted identity and body before acknowledging delivery.
