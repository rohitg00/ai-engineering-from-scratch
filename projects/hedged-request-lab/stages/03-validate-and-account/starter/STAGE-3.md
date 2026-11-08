`ValidBody(status int,body []byte)(string,error)`; `Read(ctx,client,endpoint,index) Attempt`. Attempt records status, valid, cancelled, late, elapsedMs and optional value/error. Receipt distinguishes cancelRequested and unobserved. No client result can prove service computation stopped.

A fast error cannot win, and cancellation is an observation rather than a billing guarantee.
