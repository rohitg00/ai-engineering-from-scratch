`Sign(key []byte,id string,timestamp int64,body []byte)string`; `Verify(Delivery,key,now,skew)error`. Keys require at least 16 bytes; skew must be 0..1 hour. Receiver uses five minutes. This format is original and not compatible with a named webhook provider.

Authenticate identity, timestamp and raw bytes under an explicit teaching scheme.
