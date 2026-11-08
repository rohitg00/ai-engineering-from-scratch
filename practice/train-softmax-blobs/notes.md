## Why accuracy is not enough

Accuracy counts only the class with the highest probability. Log loss also measures how sure the model is. A model that gives 0.4 to the correct class can be right and still have a high log loss. The target on log loss makes sure that the training ran long enough to make the probabilities sharp.

## Why the features need scaling

Gradient descent takes one step size for every weight. When the features have a large mean, the bias and the weights pull against each other, and the loss surface is a long narrow valley. Scaled features give a round valley, so one learning rate works for all parameters. The statistics come from the training set only, so no information from the held-out set reaches the model.

## Why the biases matter

With equal class frequencies and scaled features, the biases stay near zero. When one class has 85 percent of the points, the biases must store the class frequencies. A model without a bias update gives the rare classes too much probability.

## Where this goes next

The output layer of every classifier in the deep learning phase is this same model: a linear layer and a softmax. The loss functions lesson studies the cross-entropy and its gradient in more detail.
