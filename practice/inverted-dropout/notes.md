## Why divide by 1 - p

An entry is kept with probability $1 - p$. Without the scale, the expected value of the output is $(1 - p) x$. The next layer then sees smaller activations in training than in inference. The division by $1 - p$ makes the expected value $x$ in training mode. Inference mode can then use the plain input.

## The older form

The original form of dropout does not scale in training. It multiplies the activations by $1 - p$ at inference time. Both forms give the same expected values. The inverted form puts all the work in training, so inference has no cost.

## Why the mask is part of the output

The backward pass must use the same random draw as the forward pass. A layer object keeps the mask as state. A function returns it, as in this problem.

## Where this goes next

Transformers use dropout with $p = 0.1$ after attention and after the feed forward block. The `model.eval()` call in the lesson sets every dropout layer to inference mode. A model that stays in training mode gives a different result on each run.
