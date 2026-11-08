## Why it stops

The inertia is the sum of the squared distances from each point to its centroid. The assignment step cannot increase it, because each point picks its nearest centroid. The update step cannot increase it, because the mean is the point with the smallest sum of squared distances to a set. There is only a finite number of ways to assign the points. So the run must stop, often after a few passes.

## A local minimum

The stop does not give the best clusters. The line example in the problem stops with one cluster at 0, one at 1.5 and one at 13.25. A better answer puts one centroid near 11 and one at 20. The start centroids decide the result. The lesson picks random points as the start. K-means++ picks start points that are far apart, and libraries run several starts and keep the one with the lowest inertia.

## Empty clusters

A centroid can lose all its points. The mean of no points is not defined, and numpy returns NaN. Keeping the old centroid is the simplest rule. The lesson moves the centroid to a random point. Some libraries move it to the point that is farthest from its centroid.

## Where this goes next

The assignment step is the pairwise distance matrix and an argmin. Vector quantization, product quantization for vector search, and the codebooks of some audio and image tokenizers use the same two steps.
