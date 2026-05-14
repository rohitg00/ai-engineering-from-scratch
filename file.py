import numpy as np

class Perceptron:
    """A simple perceptron implementation for binary classification."""
    
    def __init__(self, learning_rate=0.01, n_iterations=100):
        self.learning_rate = learning_rate
        self.n_iterations = n_iterations
        self.weights = None
        self.bias = None
    
    def fit(self, X, y):
        """Train the perceptron on training data."""
        n_samples, n_features = X.shape
        
        # Initialize weights and bias
        self.weights = np.zeros(n_features)
        self.bias = 0
        
        # Training loop
        for _ in range(self.n_iterations):
            # Compute predictions
            linear_output = np.dot(X, self.weights) + self.bias
            predictions = np.sign(linear_output)
            
            # Compute errors
            errors = y - predictions
            
            # Update weights and bias
            self.weights += self.learning_rate * np.dot(X.T, errors)
            self.bias += self.learning_rate * np.sum(errors)
    
    def predict(self, X):
        """Make predictions on new data."""
        linear_output = np.dot(X, self.weights) + self.bias
        return np.sign(linear_output)


if __name__ == "__main__":
    # Example usage
    X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
    y = np.array([-1, -1, -1, 1])
    
    perceptron = Perceptron()
    perceptron.fit(X, y)
    
    predictions = perceptron.predict(X)
    print("Predictions:", predictions)
