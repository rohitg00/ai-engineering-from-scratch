## Why the hidden layer matters

One sigmoid unit draws one straight line. XOR needs two lines: one unit fires for "at least one bit is 1" and one for "both bits are 1". The output unit then combines them. The lesson on multi-layer networks sets these weights by hand. Here gradient descent finds weights that do the same job.

## Why the start values matter

When all weights start at the same value, every hidden unit gets the same gradient. The units stay the same for ever, so the network acts like one unit. Random start values break this symmetry. The scale $\sqrt{2 / n_{in}}$ keeps the first activations in the range where the sigmoid has a large slope.

## Why the checks use a held-out set

A model can fit its training points and fail on new points. The checks build 2000 new points with a hidden seed. Only a model that learned the XOR rule gets a high score on them.

## Where this goes next

The same forward pass, backward pass and update return in the mini framework lesson. There, each layer is a module with its own `forward` and `backward`, and an optimizer object applies the update.
