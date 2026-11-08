`Hedged(parent context.Context,client *http.Client,endpoints []string,delay time.Duration)(Receipt,error)`. Accept one or two endpoints and delay from 0 to 1 second. Receipt contains launched attempt count, winner index, value and winner latency. Response validation is provided scaffolding for this stage.

Launch a second safe read only when the delay expires before a winner.
