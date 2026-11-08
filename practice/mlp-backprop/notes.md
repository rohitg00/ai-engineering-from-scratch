## Why it works

Each gradient is a product of local derivatives. The backward pass computes the gradient for one layer and then reuses it for the layer below. The cost of the backward pass is about the same as the cost of the forward pass. A finite difference check needs two forward passes for each parameter, so it is only a test tool.

## Matrix shapes give the order of the products

The gradient of $W_2$ must have the shape `(n_hidden, n_out)`. The only product of $a_1$ and $\partial L / \partial z_2$ with that shape is $a_1^T \, \partial L / \partial z_2$. The same rule gives every other product. When the shapes do not fit, the order of a product is wrong.

## The batch sums the gradients

The bias adds to each row of the batch. Its gradient is a sum over the rows, not a mean. The division by the batch size is already in $\partial L / \partial a_2$, because the loss is a mean.

## The vanishing gradient

The derivative of the sigmoid is at most 0.25. Each sigmoid layer multiplies the gradient by this factor or by a smaller one. In a deep sigmoid network the gradient of the first layers is close to 0. The lesson on activation functions replaces the sigmoid with ReLU for this reason.

## Where this goes next

The lesson builds the same gradients one scalar at a time with a `Value` graph. The mini framework lesson puts each layer in a class with its own `forward` and `backward`. Batch norm and dropout in the next problems use the same pattern.
