## What the sweep shows

With one scale for the matrix, the outlier near 0.29 sets the step. At 4 bits the step is about 0.04, twice the standard deviation of the normal weights, so most weights round to 0 or to one step. The relative error is 0.563. With one scale for each row it is 0.183, about 3.1 times smaller. To get under 5 percent error, the per tensor method needs 8 bits and the per row method needs 6 bits.

## Why per row scales help

Each row scale is at most the tensor scale, so each row gets the same step or a finer one. Only the rows with an outlier keep a coarse step. This is why weight quantizers in practice use one scale per output channel or per group of 64 to 128 weights.

## The error halves with each bit

Above the lowest bit widths, each extra bit halves the step, so the relative error falls by about a factor of 2. From 6 to 7 to 8 bits the per row error goes 0.041, 0.020, 0.010.

## Where this goes next

GPTQ and AWQ in the quantization lesson go further. They do not stop at a finer scale: they change which error to minimize, the error of the layer output on real inputs.
