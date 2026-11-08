## Why the cache gives the same answer

In a causal decoder, step $t$ attends only to steps 0 to $t$. The keys and values of those steps do not change when new tokens come. So the cache can store them once. The output of step $t$ with the cache equals row $t$ of full causal attention. The check that compares the two is the main test of any cache.

## Why a fixed capacity

A serving engine allocates the cache memory before it runs a request. It does not grow an array at each step, because a copy of a large cache at each step is slow. So the cache has a fixed `max_len`, and an append past the end is an error. The check before the write keeps the cache valid after the error.

## The cost of the cache

Each layer stores one key and one value for each token and each key and value head. The memory is $2 \times N \times \text{layers} \times \text{heads}_{kv} \times d_{head} \times \text{bytes}$. At long context this memory is often larger than the weights. Grouped query attention reduces the number of key and value heads for this reason.

## Where this goes next

The same lesson shows tiled attention with a running maximum. It computes the same softmax one block of keys at a time. Paged caches split the fixed array into blocks, so that many requests can share one pool of memory.
