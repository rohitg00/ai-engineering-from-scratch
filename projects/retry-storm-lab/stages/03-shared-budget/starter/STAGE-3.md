`NewBudget(n int)*Budget`; `(*Budget).Take()bool`; `ServerDelay(value string,now time.Time)(time.Duration,error)`. Invalid values fail. A live server delay above MaxMS stops the request rather than retrying earlier than instructed.

Bound aggregate attempts across clients, not just each individual request.
