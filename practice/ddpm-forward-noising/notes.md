## Why a closed form exists

Each forward step scales the data by $\sqrt{\alpha_t}$ and adds Gaussian noise with variance $\beta_t$. A sum of independent Gaussians is Gaussian. After $t$ steps the scale is $\sqrt{\bar{\alpha}_t}$ and the noise variance is $1 - \bar{\alpha}_t$. The squares of the two coefficients sum to 1, so data with unit variance keeps unit variance. Training uses this to sample any $t$ in one step.

## Why the posterior matters

The reverse step $q(x_{t-1} \mid x_t)$ is unknown, but $q(x_{t-1} \mid x_t, x_0)$ is a Gaussian with the mean and the variance of this problem. The model does not know $x_0$. It predicts the noise $\epsilon$, and the paper substitutes $x_0 = (x_t - \sqrt{1 - \bar{\alpha}_t}\,\epsilon) / \sqrt{\bar{\alpha}_t}$. The posterior mean then becomes $(x_t - \beta_t \epsilon / \sqrt{1 - \bar{\alpha}_t}) / \sqrt{\alpha_t}$. That is the update in the sampler of the lesson.

## The indexing trap

With timesteps that start at 0, the step before $t = 0$ is the clean data, with $\bar{\alpha} = 1$. A negative index in numpy reads the last entry, so the code still runs but gives the wrong posterior. The paper counts from 1. Choose one convention and keep it in the schedule, the sampler and the loss.

## Where this goes next

The lesson trains a small network to predict $\epsilon$ with a mean squared error and runs the reverse chain. DDIM, latent diffusion and classifier-free guidance all reuse this schedule. The flow matching lesson replaces it with a straight line between data and noise.
