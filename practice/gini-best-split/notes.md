## Why weighted impurity

A split must make the whole node purer, not only one child. A child with 1 example is always pure. Without the weights, a split that cuts off one example looks very good. The weights $n_L / n$ and $n_R / n$ give each child a share of the score that matches its size. Minimizing the weighted impurity is the same as maximizing the information gain of the lesson, because the parent impurity is the same for every candidate.

## Why midpoints

Any threshold between two neighbor values gives the same split of the training data. The midpoint is the safest choice for new data, because it has the same distance to both sides. A threshold at a data value also works on the training data, but it moves the boundary next to one of the points.

## Why a tie rule

Ties are common. Labels are discrete, so many splits give the same counts. Without a fixed rule, two correct trees can differ only in the order of the loop. The tolerance of `1e-12` stops rounding error from breaking a tie in a random direction.

## Cost and where this goes next

This search costs $O(d \cdot m \cdot n)$ for $m$ unique values. Libraries sort each feature once and update the class counts as the threshold moves, which gives $O(d \cdot n \log n)$. Random forests run the same search on a random subset of the features at each node. Gradient boosted trees use the same loop with a different score.
