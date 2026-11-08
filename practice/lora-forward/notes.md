## Why B starts at zero

LoRA sets $A$ to small random values and $B$ to zero. The product $BA$ is then zero, so the first forward pass gives the output of the base model. Training moves the layer away from the base behavior step by step.

## Why the scale is alpha over r

The scale $\alpha / r$ keeps the size of the update about the same when you change the rank. You can try several ranks without a new learning rate. A common choice is $\alpha = 2r$.

## Why the count is small

A full update of a $4096 \times 4096$ weight has about 16.8 million values. A rank 8 adapter has $8 \times (4096 + 4096) = 65536$ values. That is 0.4 percent of the full weight. The optimizer state is small for the same reason.

## Shapes in the lesson code

The lesson stores $A$ as `(in_features, r)` and $B$ as `(r, out_features)`, and computes `x @ A @ B`. This problem uses the shapes of the LoRA paper: $A$ is `(r, in)` and $B$ is `(out, r)`. The two forms give the same result. The lesson code merges with `(A @ B).T`, which equals `B @ A` here.

## Where this goes next

The lesson also quantizes the frozen weight to 4 bits. That is QLoRA. The adapter stays in full precision, and the merge step dequantizes $W$ first.
