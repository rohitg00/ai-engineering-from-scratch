## What each norm removes

LayerNorm removes the mean and the scale of each vector. RMSNorm removes only the scale. The residual stream of a transformer has a mean close to 0 in practice, so the centering adds little. RMSNorm saves one reduction over the vector and one subtraction for each entry.

## Why eps goes inside the square root

$\sqrt{\sigma^2 + \epsilon}$ is at least $\sqrt{\epsilon}$, so a constant vector does not cause a division by 0. LayerNorm of a constant vector gives $\beta$, and RMSNorm of a zero vector gives 0.

## The difference from BatchNorm

BatchNorm normalizes each feature over the batch axis. LayerNorm and RMSNorm normalize each example over the feature axis. They do not need running statistics, and they act the same way in training and in inference. They also work for a batch of one token, which is the case during generation.

## Where this goes next

The full transformer lesson uses pre-norm blocks: `x + attention(norm(x))` and `x + ffn(norm(x))`. Llama, Mistral and Qwen use RMSNorm with eps from 1e-6 to 1e-5. The capstone lesson builds the same RMSNorm as a module with a learned `weight`.
