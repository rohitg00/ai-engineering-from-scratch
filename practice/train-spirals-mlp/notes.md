## Why depth helps here

Each tanh unit of the first layer makes one soft line in the plane. The second layer combines these lines into curved regions. The spirals need many bends, and two layers of 24 units give enough of them inside the step budget.

## Why the shuffle matters

The rows come sorted by label. Without a shuffle, the batches near the start hold only label 0 and the batches near the end hold only label 1. Each run of such batches pulls the output toward one class. A new random order for each pass over the data gives batches that look like the whole set. The order comes from `rng`, so the run stays reproducible.

## Why Adam

Adam divides each step by a running estimate of the gradient size. Each weight then moves at a similar speed, also when its gradients are very small or very large. Plain gradient descent with one learning rate can reach the target too, but it needs a careful choice of the rate and more steps.

## Where this goes next

The mini framework lesson puts each layer in a module with `forward` and `backward`, and the optimizer in an object. The same loop of batch, forward, backward and step trains every model in the later phases.
