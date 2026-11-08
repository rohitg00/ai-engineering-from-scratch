## Why the error bound holds

After the division, each value is in $[-127, 127]$. Rounding moves it by at most 0.5, and the clip does not change it. Multiplication by the scale gives an error of at most $\text{scale} / 2$ in each entry. A smaller scale gives a smaller error. This is why the per-row form is more accurate: each row gets a scale that fits its own range.

## Why 127 and not 128

int8 holds values from -128 to 127. The symmetric form uses $[-127, 127]$, so that 0 is in the center and $x$ and $-x$ map to $q$ and $-q$. The value -128 is not used.

## The outlier problem

One large value in a tensor makes the per-tensor scale large. All the small values then round to a few integers or to 0. LLM weights and activations have such outliers. Per-row scales, group scales and methods such as AWQ in the lesson reduce this loss.

## Where this goes next

The lesson also builds asymmetric quantization with a zero point, a sweep over bit widths, and simulated GPTQ, which corrects the rounding error of one column with the next columns. Inference engines store int8 or int4 weights in this form and multiply by the scale inside the matrix product.
