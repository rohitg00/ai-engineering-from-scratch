## Why the score depends on the gap only

Each pair is a point in a plane. RoPE turns the query pair by $m\theta_i$ and the key pair by $n\theta_i$. The dot product of two points in a plane depends on their lengths and on the angle between them. The angle between the turned points changes by $(m - n)\theta_i$. So the score sees only the gap $m - n$. The model gets relative positions, but each token needs only its own absolute position.

## Why the norm stays the same

A rotation matrix is orthogonal. It keeps the length of every pair. So RoPE does not change the size of the scores. It changes only their direction.

## The pairing convention

This lesson pairs adjacent coordinates `(2i, 2i+1)`. Some libraries pair coordinate `i` with `i + d/2`. Both conventions give the relative property. But the weights of a trained model expect one convention. If you load weights with the other convention, the model gives wrong outputs and no error appears.

## Where this goes next

The full transformer lesson applies RoPE to the queries and keys of each head before the attention scores. Long context methods change the base or scale the positions, so that the slow pairs do not wrap past a full turn.
