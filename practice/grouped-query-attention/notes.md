## Why GQA saves memory

At inference, the model keeps the keys and values of every earlier token in a cache. The size of the cache is proportional to the number of key and value heads. GQA keeps $G$ heads in place of $H$, so the cache is $H / G$ times smaller. Llama 3 70B uses 64 query heads and 8 groups, so its cache is 8 times smaller than the cache of the same model with full multi-head attention.

## Why not always one group

Multi-query attention ($G = 1$) gives the smallest cache. The paper shows that it also loses quality and can make training less stable. A small number of groups gives most of the speed of multi-query attention and a quality near that of multi-head attention.

## Uptraining

The paper does not train GQA models from the start. It takes a multi-head checkpoint, mean-pools the key and value heads of each group, and trains for about 5 percent of the original steps. The paper compares mean pooling with other methods, such as the first head of each group, and mean pooling works best.

## Where this goes next

The KV cache lesson stores only the $G$ groups and repeats them at attention time. The lesson on open model architectures lists the values of $H$ and $G$ that current models use.
