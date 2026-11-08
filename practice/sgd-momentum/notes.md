## Why momentum helps

With a constant gradient $g$, the velocity after $k$ steps is $g (1 - \beta^k) / (1 - \beta)$. For $\beta = 0.9$ the step grows to 10 times the plain gradient step in a consistent direction. When the gradient changes sign from step to step, the terms cancel and the velocity stays small. This is why momentum moves fast along a valley and slowly across it.

## Two conventions

The lesson adds the raw gradient: $v \leftarrow \beta v + g$. Some texts use an average: $v \leftarrow \beta v + (1 - \beta) g$. The two give the same direction, but the second has a step that is $1 - \beta$ times smaller. When you copy a learning rate from a paper or a framework, check which convention it uses.

## Nesterov

Nesterov momentum looks ahead. It computes the gradient where the velocity will carry the parameters. When the velocity points past the minimum, the lookahead gradient already points back, so the method corrects earlier. On the example quadratic the Nesterov trajectory overshoots less.

## Where this goes next

Adam keeps the same first moment, but as an average with the $1 - \beta_1$ factor and a bias correction. The learning rate schedules lesson changes `lr` from step to step around the same update.
