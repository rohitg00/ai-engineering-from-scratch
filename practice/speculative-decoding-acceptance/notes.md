## Why the output equals the target

Take one draft token. Token $x$ comes out in two ways. The draft proposes $x$ and the rule accepts it, with probability $q(x) \min(1, p(x)/q(x)) = \min(p(x), q(x))$. Or the rule rejects the draft token, with probability $1 - \alpha$, and the residual gives $x$. The residual is $\max(0, p(x) - q(x)) / (1 - \alpha)$, because the sum of $\max(0, p - q)$ is $1 - \alpha$. The sum of the two terms is $\min(p, q) + \max(0, p - q) = p(x)$. The check on the exact distribution tests this identity.

## The speed

Each step calls the target model once and gives from 1 to $\gamma + 1$ tokens. With independent acceptances at rate $\alpha$, the mean is $(1 - \alpha^{\gamma + 1}) / (1 - \alpha)$. A draft that is close to the target gives a high $\alpha$. The paper shows that $\alpha$ is also $1 - \frac{1}{2} \lVert p - q \rVert_1$, one minus the total variation distance.

## The names of p and q

This problem uses the letters of the paper: $p$ for the target and $q$ for the draft. The lesson code uses the opposite letters. The rule is the same.

## Where this goes next

The lessons on Medusa and EAGLE replace the separate draft model with extra heads on the target model. The verify step stays the same.
