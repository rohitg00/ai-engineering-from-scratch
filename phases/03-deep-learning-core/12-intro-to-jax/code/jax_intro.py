import jax
import jax.numpy as jnp
from jax import random
import optax


def get_mnist_data():
    from sklearn.datasets import fetch_openml
    mnist = fetch_openml('mnist_784', version=1, as_frame=False, parser='auto')
    X = mnist.data.astype('float32') / 255.0
    y = mnist.target.astype('int')
    X_train, X_test = X[:60000], X[60000:]
    y_train, y_test = y[:60000], y[60000:]
    return X_train, y_train, X_test, y_test


def init_params(key):
    k1, k2, k3 = random.split(key, 3)
    scale1 = jnp.sqrt(2.0 / 784)
    scale2 = jnp.sqrt(2.0 / 256)
    scale3 = jnp.sqrt(2.0 / 128)
    params = {
        'layer1': {
            'w': scale1 * random.normal(k1, (784, 256)),
            'b': jnp.zeros(256),
        },
        'layer2': {
            'w': scale2 * random.normal(k2, (256, 128)),
            'b': jnp.zeros(128),
        },
        'layer3': {
            'w': scale3 * random.normal(k3, (128, 10)),
            'b': jnp.zeros(10),
        },
    }
    return params


def forward(params, x):
    x = jnp.dot(x, params['layer1']['w']) + params['layer1']['b']
    x = jax.nn.relu(x)
    x = jnp.dot(x, params['layer2']['w']) + params['layer2']['b']
    x = jax.nn.relu(x)
    x = jnp.dot(x, params['layer3']['w']) + params['layer3']['b']
    return x


def loss_fn(params, x, y):
    logits = forward(params, x)
    one_hot = jax.nn.one_hot(y, 10)
    return -jnp.mean(jnp.sum(jax.nn.log_softmax(logits) * one_hot, axis=-1))


optimizer = optax.adam(learning_rate=1e-3)


@jax.jit
def train_step(params, opt_state, x, y):
    loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
    updates, opt_state = optimizer.update(grads, opt_state, params)
    params = optax.apply_updates(params, updates)
    return params, opt_state, loss


@jax.jit
def accuracy(params, x, y):
    logits = forward(params, x)
    preds = jnp.argmax(logits, axis=-1)
    return jnp.mean(preds == y)


def train():
    X_train, y_train, X_test, y_test = get_mnist_data()
    X_train = jnp.array(X_train)
    X_test = jnp.array(X_test)
    y_train = jnp.array(y_train)
    y_test = jnp.array(y_test)

    key = random.PRNGKey(0)
    params = init_params(key)
    opt_state = optimizer.init(params)

    batch_size = 128
    n_epochs = 10

    for epoch in range(n_epochs):
        key, subkey = random.split(key)
        perm = random.permutation(subkey, len(X_train))
        X_shuffled = X_train[perm]
        y_shuffled = y_train[perm]

        epoch_loss = 0.0
        n_batches = len(X_train) // batch_size
        for i in range(n_batches):
            start = i * batch_size
            xb = X_shuffled[start:start + batch_size]
            yb = y_shuffled[start:start + batch_size]
            params, opt_state, loss = train_step(params, opt_state, xb, yb)
            epoch_loss += loss

        train_acc = accuracy(params, X_train[:5000], y_train[:5000])
        test_acc = accuracy(params, X_test, y_test)
        print(f"Epoch {epoch + 1:2d} | Loss: {epoch_loss / n_batches:.4f} | "
              f"Train Acc: {train_acc:.4f} | Test Acc: {test_acc:.4f}")

    return params


def demo_grad():
    print("=== jax.grad demo ===")

    def f(x):
        return x ** 3

    df = jax.grad(f)
    d2f = jax.grad(df)
    print(f"f(2.0)   = {f(2.0)}")
    print(f"f'(2.0)  = {df(2.0)}")
    print(f"f''(2.0) = {d2f(2.0)}")
    print()


def demo_vmap():
    print("=== jax.vmap demo ===")
    key = random.PRNGKey(42)
    k1, k2 = random.split(key)

    params = {'w': random.normal(k1, (3,)), 'b': 0.0}

    def predict_single(params, x):
        return jnp.dot(params['w'], x) + params['b']

    batch_x = random.normal(k2, (5, 3))
    batch_predict = jax.vmap(predict_single, in_axes=(None, 0))
    results = batch_predict(params, batch_x)
    print(f"Input shape:  {batch_x.shape}")
    print(f"Output shape: {results.shape}")
    print(f"Predictions:  {results}")
    print()


def demo_jit():
    print("=== jax.jit demo ===")
    import time

    key = random.PRNGKey(0)
    x = random.normal(key, (1000, 1000))

    def slow_fn(x):
        for _ in range(10):
            x = jnp.dot(x, x)
            x = x / jnp.linalg.norm(x)
        return x

    fast_fn = jax.jit(slow_fn)
    _ = fast_fn(x)

    start = time.perf_counter()
    for _ in range(10):
        _ = slow_fn(x)
    eager_time = time.perf_counter() - start

    start = time.perf_counter()
    for _ in range(10):
        _ = fast_fn(x).block_until_ready()
    jit_time = time.perf_counter() - start

    print(f"Eager: {eager_time:.4f}s")
    print(f"JIT:   {jit_time:.4f}s")
    print(f"Speedup: {eager_time / jit_time:.1f}x")
    print()


if __name__ == '__main__':
    demo_grad()
    demo_vmap()
    demo_jit()
    print("=== MNIST Training ===")
    train()
