# Construye su propio mini marco

> Has construido neuronas, capas, redes, retroactivación, activaciones, funciones de pérdida, optimizadores, regularización, inicialización y calendarios LR. Todo como piezas separadas. Ahora cableálas juntas en un marco. No PyTorch. No TensorFlow.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** All of Phase 03 (Lessons 01-09)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Construir un marco completo de aprendizaje profundo (~ 500 líneas) con módulo, lineal, ReLU, Sigmoid, Dropout, BatchNorm, Sequential, funciones de pérdida, optimizadores y DataLoader
- Explicar la abstracción del módulo (avance, retrocesión, parámetros) y por qué es necesario cambiar de modo tren/eval
- Enlazar todos los componentes en un bucle de entrenamiento de trabajo que entrenan una red de 4 capas en la clasificación de círculos
- Mapa de cada componente de su marco a su equivalente PyTorch (nn.Module, nn.Sequential, optim.Adam, DataLoader)

## El problema

Tienes diez lecciones de bloques de construcción repartidos en archivos separados.`Value`una clase aquí, un bucle de entrenamiento allí, inicialización de peso en otro archivo, horarios de tasa de aprendizaje en otro. para entrenar una red, copias y pegas de cinco lecciones diferentes y las conecta a mano.

Eso es lo que los frameworks resuelven. PyTorch te da`nn.Module`¿ Qué ?`nn.Sequential`¿ Qué ?`optim.Adam`¿ Qué ?`DataLoader`, y un patrón de bucle de entrenamiento que los une. TensorFlow te da`keras.Layer`¿ Qué ?`keras.Sequential`¿ Qué ?`keras.optimizers.Adam`No son magia, son patrones organizativos que permiten definir, entrenar y evaluar redes sin reinventar la tubería cada vez.

Se va a construir lo mismo en ~500 líneas de Python. No numpy. No dependencias externas. Un marco que puede definir cualquier red de entrada, entrenarlo con SGD o Adam, lotar los datos, aplicar la normalización de abandono y lotes, utilizar cualquier activación, y programar la tasa de aprendizaje.

Cuando termine, entenderá exactamente lo que sucede cuando escribe.`model = nn.Sequential(...)`En PyTorch, usted entenderá por qué.`model.train()`y `model.eval()`¿Por qué no existe?`optimizer.zero_grad()`Usted entenderá todo, porque usted lo construyó todo.

## El concepto

### La Abstracción de módulos

Cada capa en PyTorch hereda de `nn.Module`Un módulo tiene tres responsabilidades:

1. **forward()**-- calcular la salida de las entradas dadas
2. **parameters()**- devuelven todos los pesos entrenables
3. **backward()**-- gradientes de cálculo (se manejan por autograd en PyTorch, explícito en el nuestro)

Una capa lineal es un módulo. Una activación ReLU es un módulo. Una capa de abandono es un módulo. Una capa de normalización de lote es un módulo. Todos tienen la misma interfaz.

### Contenedor secuencial

`nn.Sequential`En el interior de la cadena, el módulo de entrada de datos se encuentra en el módulo 1, luego en el módulo 2, luego en el módulo 3.

### Formación frente al modo de evaluación

La normalización de lote utiliza estadísticas de lote durante el entrenamiento pero promedios de ejecución durante la evaluación.`train()`y `eval()`Cada módulo tiene un módulo de control de la velocidad.`training`bandera.

### Optimizador

El optimizador actualiza los parámetros utilizando sus gradientes.`param -= lr * grad`Adam: mantiene estimaciones de impulso y variación, luego actualiza. El optimizador no sabe sobre la arquitectura de red, sólo ve una lista plana de parámetros y sus gradientes.

### Datarregistros

El batch es importante por dos razones: primero, no se puede colocar todo el conjunto de datos en la memoria para problemas grandes. segundo, el descenso de gradiente de minibatch proporciona ruido que ayuda a escapar de los mínimos locales.

### Arquitectura de marco

```mermaid
graph TD
    subgraph "Modules"
        Linear["Linear<br/>W*x + b"]
        ReLU["ReLU<br/>max(0, x)"]
        Sigmoid["Sigmoid<br/>1/(1+e^-x)"]
        Dropout["Dropout<br/>random zero mask"]
        BatchNorm["BatchNorm<br/>normalize activations"]
    end

    subgraph "Containers"
        Sequential["Sequential<br/>chains modules"]
    end

    subgraph "Loss Functions"
        MSE["MSELoss<br/>(pred - target)^2"]
        BCE["BCELoss<br/>binary cross-entropy"]
    end

    subgraph "Optimizers"
        SGD["SGD<br/>param -= lr * grad"]
        Adam["Adam<br/>adaptive moments"]
    end

    subgraph "Data"
        DataLoader["DataLoader<br/>batching + shuffle"]
    end

    Sequential --> |"contains"| Linear
    Sequential --> |"contains"| ReLU
    Sequential --> |"forward/backward"| MSE
    SGD --> |"updates"| Sequential
    DataLoader --> |"feeds"| Sequential
```

### El ciclo de entrenamiento

```mermaid
sequenceDiagram
    participant DL as DataLoader
    participant M as Model
    participant L as Loss
    participant O as Optimizer

    loop Each Epoch
        DL->>M: batch of inputs
        M->>M: forward pass (layer by layer)
        M->>L: predictions
        L->>L: compute loss
        L->>M: backward pass (gradients)
        M->>O: parameters + gradients
        O->>M: updated parameters
        O->>O: zero gradients
    end
```

### La jerarquía de módulos

```mermaid
classDiagram
    class Module {
        +forward(x)
        +backward(grad)
        +parameters()
        +train()
        +eval()
    }

    class Linear {
        -weights
        -biases
        +forward(x)
        +backward(grad)
    }

    class ReLU {
        +forward(x)
        +backward(grad)
    }

    class Sequential {
        -modules[]
        +forward(x)
        +backward(grad)
        +parameters()
    }

    Module <|-- Linear
    Module <|-- ReLU
    Module <|-- Sequential
    Sequential *-- Module
```

```figure
gradient-clipping
```

## Construye el mismo

### Paso 1: Clase base del módulo

La interfaz abstracta que cada capa implementa.

```python
class Module:
    def __init__(self):
        self.training = True

    def forward(self, x):
        raise NotImplementedError

    def backward(self, grad):
        raise NotImplementedError

    def parameters(self):
        return []

    def train(self):
        self.training = True

    def eval(self):
        self.training = False
```

### Paso 2: capa lineal

El bloque de construcción fundamental. Almacena pesas y sesgos, calcula Wx + b hacia adelante y los gradientes de peso / entrada hacia atrás.

```python
import math
import random


class Linear(Module):
    def __init__(self, fan_in, fan_out):
        super().__init__()
        std = math.sqrt(2.0 / fan_in)
        self.weights = [[random.gauss(0, std) for _ in range(fan_in)] for _ in range(fan_out)]
        self.biases = [0.0] * fan_out
        self.weight_grads = [[0.0] * fan_in for _ in range(fan_out)]
        self.bias_grads = [0.0] * fan_out
        self.fan_in = fan_in
        self.fan_out = fan_out
        self.input = None

    def forward(self, x):
        self.input = x
        output = []
        for i in range(self.fan_out):
            val = self.biases[i]
            for j in range(self.fan_in):
                val += self.weights[i][j] * x[j]
            output.append(val)
        return output

    def backward(self, grad):
        input_grad = [0.0] * self.fan_in
        for i in range(self.fan_out):
            self.bias_grads[i] += grad[i]
            for j in range(self.fan_in):
                self.weight_grads[i][j] += grad[i] * self.input[j]
                input_grad[j] += grad[i] * self.weights[i][j]
        return input_grad

    def parameters(self):
        params = []
        for i in range(self.fan_out):
            for j in range(self.fan_in):
                params.append((self.weights, i, j, self.weight_grads))
            params.append((self.biases, i, None, self.bias_grads))
        return params
```

### Paso 3: módulos de activación

ReLU, Sigmoid y Tanh como módulos, cada uno guarda lo que necesita para el pase hacia atrás.

```python
class ReLU(Module):
    def __init__(self):
        super().__init__()
        self.mask = None

    def forward(self, x):
        self.mask = [1.0 if v > 0 else 0.0 for v in x]
        return [max(0.0, v) for v in x]

    def backward(self, grad):
        return [g * m for g, m in zip(grad, self.mask)]


class Sigmoid(Module):
    def __init__(self):
        super().__init__()
        self.output = None

    def forward(self, x):
        self.output = []
        for v in x:
            v = max(-500, min(500, v))
            self.output.append(1.0 / (1.0 + math.exp(-v)))
        return self.output

    def backward(self, grad):
        return [g * o * (1 - o) for g, o in zip(grad, self.output)]


class Tanh(Module):
    def __init__(self):
        super().__init__()
        self.output = None

    def forward(self, x):
        self.output = [math.tanh(v) for v in x]
        return self.output

    def backward(self, grad):
        return [g * (1 - o * o) for g, o in zip(grad, self.output)]
```

### Paso 4: Modulo de abandono

Cero al azar elementos durante el entrenamiento. Escala los elementos restantes por 1/(1-p) así que los valores esperados permanecen iguales. No hace nada durante la evaluación.

```python
class Dropout(Module):
    def __init__(self, p=0.5):
        super().__init__()
        self.p = p
        self.mask = None

    def forward(self, x):
        if not self.training:
            return x
        self.mask = [0.0 if random.random() < self.p else 1.0 / (1 - self.p) for _ in x]
        return [v * m for v, m in zip(x, self.mask)]

    def backward(self, grad):
        if self.mask is None:
            return grad
        return [g * m for g, m in zip(grad, self.mask)]
```

### Paso 5: Modulo de BatchNorm

Normaliza las activaciones a cero media y variación unitaria por característica en todo el lote.

```python
class BatchNorm(Module):
    def __init__(self, size, momentum=0.1, eps=1e-5):
        super().__init__()
        self.size = size
        self.gamma = [1.0] * size
        self.beta = [0.0] * size
        self.gamma_grads = [0.0] * size
        self.beta_grads = [0.0] * size
        self.running_mean = [0.0] * size
        self.running_var = [1.0] * size
        self.momentum = momentum
        self.eps = eps
        self.x_norm = None
        self.std_inv = None
        self.batch_input = None

    def forward_batch(self, batch):
        batch_size = len(batch)
        output_batch = []

        if self.training:
            mean = [0.0] * self.size
            for sample in batch:
                for j in range(self.size):
                    mean[j] += sample[j]
            mean = [m / batch_size for m in mean]

            var = [0.0] * self.size
            for sample in batch:
                for j in range(self.size):
                    var[j] += (sample[j] - mean[j]) ** 2
            var = [v / batch_size for v in var]

            self.std_inv = [1.0 / math.sqrt(v + self.eps) for v in var]

            self.x_norm = []
            self.batch_input = batch
            for sample in batch:
                normed = [(sample[j] - mean[j]) * self.std_inv[j] for j in range(self.size)]
                self.x_norm.append(normed)
                output = [self.gamma[j] * normed[j] + self.beta[j] for j in range(self.size)]
                output_batch.append(output)

            for j in range(self.size):
                self.running_mean[j] = (1 - self.momentum) * self.running_mean[j] + self.momentum * mean[j]
                self.running_var[j] = (1 - self.momentum) * self.running_var[j] + self.momentum * var[j]
        else:
            std_inv = [1.0 / math.sqrt(v + self.eps) for v in self.running_var]
            for sample in batch:
                normed = [(sample[j] - self.running_mean[j]) * std_inv[j] for j in range(self.size)]
                output = [self.gamma[j] * normed[j] + self.beta[j] for j in range(self.size)]
                output_batch.append(output)

        return output_batch

    def forward(self, x):
        result = self.forward_batch([x])
        return result[0]

    def backward(self, grad):
        if self.x_norm is None:
            return grad
        for j in range(self.size):
            self.gamma_grads[j] += self.x_norm[0][j] * grad[j]
            self.beta_grads[j] += grad[j]
        return [grad[j] * self.gamma[j] * self.std_inv[j] for j in range(self.size)]

    def parameters(self):
        params = []
        for j in range(self.size):
            params.append((self.gamma, j, None, self.gamma_grads))
            params.append((self.beta, j, None, self.beta_grads))
        return params
```

### Paso 6: Contenedor secuencial

Módulos de cadenas. adelante va de izquierda a derecha, hacia atrás va de derecha a izquierda.

```python
class Sequential(Module):
    def __init__(self, *modules):
        super().__init__()
        self.modules = list(modules)

    def forward(self, x):
        for module in self.modules:
            x = module.forward(x)
        return x

    def backward(self, grad):
        for module in reversed(self.modules):
            grad = module.backward(grad)
        return grad

    def parameters(self):
        params = []
        for module in self.modules:
            params.extend(module.parameters())
        return params

    def train(self):
        self.training = True
        for module in self.modules:
            module.train()

    def eval(self):
        self.training = False
        for module in self.modules:
            module.eval()
```

### Paso 7: Perdida de funciones

MSE y Binary Cross-Entropy. Cada uno devuelve el valor de pérdida y proporciona un retroceso que devuelve el gradiente.

```python
class MSELoss:
    def __call__(self, predicted, target):
        self.predicted = predicted
        self.target = target
        n = len(predicted)
        self.loss = sum((p - t) ** 2 for p, t in zip(predicted, target)) / n
        return self.loss

    def backward(self):
        n = len(self.predicted)
        return [2 * (p - t) / n for p, t in zip(self.predicted, self.target)]


class BCELoss:
    def __call__(self, predicted, target):
        self.predicted = predicted
        self.target = target
        eps = 1e-7
        n = len(predicted)
        self.loss = 0
        for p, t in zip(predicted, target):
            p = max(eps, min(1 - eps, p))
            self.loss += -(t * math.log(p) + (1 - t) * math.log(1 - p))
        self.loss /= n
        return self.loss

    def backward(self):
        eps = 1e-7
        n = len(self.predicted)
        grads = []
        for p, t in zip(self.predicted, self.target):
            p = max(eps, min(1 - eps, p))
            grads.append((-t / p + (1 - t) / (1 - p)) / n)
        return grads
```

### Paso 8: SGD y Adam Optimizers

Ambos toman una lista de parámetros y actualizan los pesos utilizando gradientes.

```python
class SGD:
    def __init__(self, parameters, lr=0.01):
        self.params = parameters
        self.lr = lr

    def step(self):
        for container, i, j, grad_container in self.params:
            if j is not None:
                container[i][j] -= self.lr * grad_container[i][j]
            else:
                container[i] -= self.lr * grad_container[i]

    def zero_grad(self):
        for container, i, j, grad_container in self.params:
            if j is not None:
                grad_container[i][j] = 0.0
            else:
                grad_container[i] = 0.0


class Adam:
    def __init__(self, parameters, lr=0.001, beta1=0.9, beta2=0.999, eps=1e-8):
        self.params = parameters
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.eps = eps
        self.t = 0
        self.m = [0.0] * len(parameters)
        self.v = [0.0] * len(parameters)

    def step(self):
        self.t += 1
        for idx, (container, i, j, grad_container) in enumerate(self.params):
            if j is not None:
                g = grad_container[i][j]
            else:
                g = grad_container[i]

            self.m[idx] = self.beta1 * self.m[idx] + (1 - self.beta1) * g
            self.v[idx] = self.beta2 * self.v[idx] + (1 - self.beta2) * g * g

            m_hat = self.m[idx] / (1 - self.beta1 ** self.t)
            v_hat = self.v[idx] / (1 - self.beta2 ** self.t)

            update = self.lr * m_hat / (math.sqrt(v_hat) + self.eps)

            if j is not None:
                container[i][j] -= update
            else:
                container[i] -= update

    def zero_grad(self):
        for container, i, j, grad_container in self.params:
            if j is not None:
                grad_container[i][j] = 0.0
            else:
                grad_container[i] = 0.0
```

### Paso 9: DataLoader

Divide los datos en lotes, opcionalmente mezcla cada época.

```python
class DataLoader:
    def __init__(self, data, batch_size=32, shuffle=True):
        self.data = data
        self.batch_size = batch_size
        self.shuffle = shuffle

    def __iter__(self):
        indices = list(range(len(self.data)))
        if self.shuffle:
            random.shuffle(indices)
        for start in range(0, len(indices), self.batch_size):
            batch_indices = indices[start:start + self.batch_size]
            batch = [self.data[i] for i in batch_indices]
            inputs = [item[0] for item in batch]
            targets = [item[1] for item in batch]
            yield inputs, targets

    def __len__(self):
        return (len(self.data) + self.batch_size - 1) // self.batch_size
```

### Paso 10: Entrenar una red de cuatro capas en la clasificación de círculos

Define un modelo, elige una pérdida, elige un optimizador, ejecuta el ciclo de entrenamiento.

```python
def make_circle_data(n=500, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        x = random.uniform(-2, 2)
        y = random.uniform(-2, 2)
        label = 1.0 if x * x + y * y < 1.5 else 0.0
        data.append(([x, y], [label]))
    return data


def train():
    random.seed(42)

    model = Sequential(
        Linear(2, 16),
        ReLU(),
        Linear(16, 16),
        ReLU(),
        Linear(16, 8),
        ReLU(),
        Linear(8, 1),
        Sigmoid(),
    )

    criterion = BCELoss()
    optimizer = Adam(model.parameters(), lr=0.01)

    data = make_circle_data(500)
    split = int(len(data) * 0.8)
    train_data = data[:split]
    test_data = data[split:]

    loader = DataLoader(train_data, batch_size=16, shuffle=True)

    model.train()

    for epoch in range(100):
        total_loss = 0
        total_correct = 0
        total_samples = 0

        for batch_inputs, batch_targets in loader:
            batch_loss = 0
            for x, t in zip(batch_inputs, batch_targets):
                pred = model.forward(x)
                loss = criterion(pred, t)
                batch_loss += loss

                optimizer.zero_grad()
                grad = criterion.backward()
                model.backward(grad)
                optimizer.step()

                predicted_class = 1.0 if pred[0] >= 0.5 else 0.0
                if predicted_class == t[0]:
                    total_correct += 1
                total_samples += 1

            total_loss += batch_loss

        avg_loss = total_loss / total_samples
        accuracy = total_correct / total_samples * 100

        if epoch % 10 == 0 or epoch == 99:
            print(f"Epoch {epoch:3d} | Loss: {avg_loss:.6f} | Train Accuracy: {accuracy:.1f}%")

    model.eval()
    correct = 0
    for x, t in test_data:
        pred = model.forward(x)
        predicted_class = 1.0 if pred[0] >= 0.5 else 0.0
        if predicted_class == t[0]:
            correct += 1
    test_accuracy = correct / len(test_data) * 100
    print(f"\nTest Accuracy: {test_accuracy:.1f}% ({correct}/{len(test_data)})")

    return model, test_accuracy
```

## Usalo

Aquí está el equivalente PyTorch de lo que acabas de construir:

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

model = nn.Sequential(
    nn.Linear(2, 16),
    nn.ReLU(),
    nn.Linear(16, 16),
    nn.ReLU(),
    nn.Linear(16, 8),
    nn.ReLU(),
    nn.Linear(8, 1),
    nn.Sigmoid(),
)

criterion = nn.BCELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

for epoch in range(100):
    model.train()
    for inputs, targets in dataloader:
        optimizer.zero_grad()
        predictions = model(inputs)
        loss = criterion(predictions, targets)
        loss.backward()
        optimizer.step()

    model.eval()
    with torch.no_grad():
        test_predictions = model(test_inputs)
```

La estructura es idéntica.`Sequential`¿ Qué ?`Linear`¿ Qué ?`ReLU`¿ Qué ?`Sigmoid`¿ Qué ?`BCELoss`¿ Qué ?`Adam`¿ Qué ?`zero_grad`¿ Qué ?`backward`¿ Qué ?`step`¿ Qué ?`train`¿ Qué ?`eval`Cada concepto se mapea uno a uno. La diferencia es que PyTorch maneja automáticamente el autogrado (no es necesario implementar hacia atrás) en cada módulo, se ejecuta en GPU, y ha sido optimizado durante años.

Ahora, cuando ves el código PyTorch, sabes exactamente lo que está sucediendo en cada línea.

## Envío

Esta lección produce:
- `outputs/prompt-framework-architect.md`-- un prompt para diseñar arquitecturas de redes neuronales utilizando abstracciones de marcos

## Los ejercicios

1. Añadir un`SoftmaxCrossEntropyLoss`Softmax las predicciones, calcular la pérdida de entropía cruzada y manejar el pase hacia atrás combinado.

2. Implementar la programación de la tasa de aprendizaje en el optimizador: añadir un `set_lr()`El método y el cable en el calendario cosino de la lección 09. Entrenar el clasificador de círculos con calentamiento + cosino y comparar con LR constante.

3. Añadir un`save()`y `load()`Se puede verificar si un modelo cargado produce las mismas predicciones que el original.

4. Implemente la desintegración de peso (regularización L2) en el optimizador Adam.`weight_decay`Parámetro que reduce los pesos hacia cero cada paso.

5. Reemplazar el bucle de entrenamiento por muestra con una acumulación adecuada de gradientes mini-parcela: acumula los gradientes en todas las muestras de un lote, luego divida por tamaño del lote y haga un paso optimizador.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Module | "A layer" | The base abstraction in a framework -- anything with forward(), backward(), and parameters() |
| Sequential | "Stack layers in order" | A container that chains modules, applying them in sequence for forward and reverse for backward |
| Forward pass | "Run the network" | Computing the output by passing input through each module in order |
| Backward pass | "Compute gradients" | Propagating the loss gradient through each module in reverse to compute parameter gradients |
| Parameters | "The trainable weights" | All values in the network that the optimizer can update -- weights and biases |
| Optimizer | "The thing that updates weights" | An algorithm that uses gradients to update parameters, implementing SGD, Adam, or other rules |
| DataLoader | "The thing that feeds data" | An iterator that splits a dataset into batches, optionally shuffling between epochs |
| Training mode | "model.train()" | A flag that enables stochastic behavior like dropout and batch normalization with batch stats |
| Evaluation mode | "model.eval()" | A flag that disables dropout and uses running statistics for batch normalization |
| Zero grad | "Clear the gradients" | Resetting all parameter gradients to zero before computing the next batch's gradients |

## Leer más

- Paszke et al., "PyTorch: Un estilo imperativo, de alto rendimiento de la biblioteca de aprendizaje profundo" (2019) -- el documento que describe las decisiones de diseño de PyTorch
- Chollet, "Deep Learning with Python, Second Edition" (2021) -- Capítulo 3 abarca las partes internas de Keras con la misma abstracción de módulos/capas
- Johnson, "Tiny-DNN" (https://github.com/tiny-dnn/tiny-dnn) -- un marco de aprendizaje profundo de C++ con cabeceras solamente para comprender los elementos internos del marco
