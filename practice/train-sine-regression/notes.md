## How tanh units build a curve

Each hidden unit gives a smooth step $\tanh(w x + b)$. Its center is at $x = -b / w$ and its width depends on $w$. The output layer adds the steps with the weights $W_2$. A sine curve between $-\pi$ and $\pi$ needs about three bends, so 16 units are more than enough.

## Why the check uses the true curve

The training targets have noise with variance 0.01. A model that copies every training point gets a training loss below 0.01 but a wrong curve between the points. The held-out check compares with $\sin(x)$ itself, so only a smooth fit passes.

## Why tanh and not a step function

The derivative of tanh, $1 - \tanh^2$, is never 0, so each unit always gets some gradient. The activation functions lesson compares this with sigmoid and ReLU. A ReLU network also fits a sine, but it builds the curve from straight pieces.

## Where this goes next

The same training loop with a different loss trains every regression model in the course. The mini framework lesson puts the layers, the loss and Adam into reusable modules.
