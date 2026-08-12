# Введение в PyTorch

> Вы построили двигатель из поршней и коленвалов. Теперь изучите тот, на котором ездят все.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Урок 03.10 (Создайте свой мини-фреймворк)
**Время:** ~75 минут

## Цели обучения

- Строить и обучать нейронные сети с помощью nn.Module, nn.Sequential и autograd в PyTorch
- Использовать тензоры PyTorch, ускорение на GPU и стандартный цикл обучения (zero_grad, forward, loss, backward, step)
- Преобразовать компоненты вашего мини-фреймворка, написанного с нуля, в их эквиваленты в PyTorch
- Профилировать и сравнить скорость обучения между вашим фреймворком на чистом Python и PyTorch на одной и той же задаче

## Проблема

У вас есть работающий мини-фреймворк. Линейные слои, ReLU, дропаут, пакетная нормализация, Adam, DataLoader, цикл обучения. Он обучает 4-слойную сеть на задаче классификации круга на чистом Python.

Он же в 500 раз медленнее PyTorch на той же задаче.

Ваш мини-фреймворк обрабатывает по одному образцу за раз с помощью вложенных циклов Python. PyTorch направляет те же операции в оптимизированные ядра C++/CUDA, работающие на GPU. На одной NVIDIA A100 PyTorch обучает ResNet-50 (25,6 млн параметров) на ImageNet (1,28 млн изображений) примерно за 6 часов. Вашему фреймворку на той же задаче потребовалось бы примерно 3000 часов — если бы у него раньше не закончилась память.

Скорость — не единственный разрыв. В вашем фреймворке нет поддержки GPU. Нет автоматического дифференцирования — вы вручную написали backward() для каждого модуля. Нет сериализации. Нет распределённого обучения. Нет смешанной точности. Нет способа отладить поток градиентов без print-выражений.

PyTorch закрывает каждый из этих пробелов. И делает это, сохраняя ту же самую ментальную модель, которую вы уже построили: Module, forward(), parameters(), backward(), optimizer.step(). Понятия переносятся один в один. Синтаксис почти идентичен. Разница в том, что PyTorch оборачивает десятилетие инженерии систем в тот же интерфейс, который вы спроектировали с нуля.

## Концепция

### Почему PyTorch победил

В 2015 году TensorFlow требовал определить статический вычислительный граф до запуска чего-либо. Вы строили граф, компилировали его, а затем пропускали через него данные. Отладка означала разглядывание визуализаций графа. Изменение архитектуры означало перестройку графа с нуля.

PyTorch появился в 2017 году с другой философией: немедленным выполнением (eager execution). Вы пишете Python. Он выполняется немедленно. `y = model(x)` действительно вычисляет y прямо сейчас, а не «добавляет узел в граф, который вычислит y позже». Это означало, что стандартные инструменты отладки Python работали. print() работал. pdb работал. if/else в вашем прямом проходе работал.

К 2020 году рынок высказался. Доля PyTorch в исследовательских статьях по ML выросла с 7% (2017) до более чем 75% (2022). Meta, Google DeepMind, OpenAI, Anthropic и Hugging Face — все используют PyTorch как основной фреймворк. TensorFlow 2.x в ответ принял немедленное выполнение — молчаливое признание того, что дизайн PyTorch был верным.

Урок таков: опыт разработчика накапливается. Фреймворк, который на 10% медленнее, но на 50% быстрее отлаживается, побеждает каждый раз.

### Тензоры

Тензор — это многомерный массив с тремя критически важными свойствами: формой, типом данных и устройством.

```python
import torch

x = torch.zeros(3, 4)           # shape: (3, 4), dtype: float32, device: cpu
x = torch.randn(2, 3, 224, 224) # batch of 2 RGB images, 224x224
x = torch.tensor([1, 2, 3])     # from a Python list
```

**Форма** — это размерность. Скаляр имеет форму (), вектор — (n,), матрица — (m, n), пакет изображений — (batch, channels, height, width).

**Тип данных** определяет точность и объём памяти.

| dtype | Биты | Диапазон | Применение |
|-------|------|-------|----------|
| float32 | 32 | ~7 десятичных знаков | Обучение по умолчанию |
| float16 | 16 | ~3.3 десятичных знака | Смешанная точность |
| bfloat16 | 16 | Тот же диапазон, что у float32, но менее точный | Обучение LLM |
| int8 | 8 | от -128 до 127 | Квантованный инференс |

**Устройство** определяет, где происходят вычисления.

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
x = torch.randn(3, 4, device=device)
x = x.to("cuda")
x = x.cpu()
```

Каждая операция требует, чтобы все тензоры находились на одном устройстве. Это ошибка №1 в PyTorch, с которой сталкиваются новички: `RuntimeError: Expected all tensors to be on the same device`. Исправляется переносом всего на одно устройство перед вычислением.

**Изменение формы (reshaping)** выполняется за константное время — оно меняет метаданные, а не сами данные.

```python
x = torch.randn(2, 3, 4)
x.view(2, 12)      # reshape to (2, 12) -- must be contiguous
x.reshape(6, 4)    # reshape to (6, 4) -- works always
x.permute(2, 0, 1) # reorder dimensions
x.unsqueeze(0)     # add dimension: (1, 2, 3, 4)
x.squeeze()        # remove size-1 dimensions
```

### Autograd

Ваш мини-фреймворк требовал реализовать backward() для каждого модуля. PyTorch — нет. Он записывает каждую операцию над тензорами в направленный ациклический граф (вычислительный граф), а затем проходит этот граф в обратном направлении, чтобы автоматически вычислить градиенты.

```mermaid
graph LR
    x["x (leaf)"] --> mul["*"]
    w["w (leaf, requires_grad)"] --> mul
    mul --> add["+"]
    b["b (leaf, requires_grad)"] --> add
    add --> loss["loss"]
    loss --> |".backward()"| add
    add --> |"grad"| b
    add --> |"grad"| mul
    mul --> |"grad"| w
```

Ключевое отличие от вашего фреймворка: PyTorch использует автодифференцирование на основе ленты (tape-based). Каждая операция дописывается на «ленту» во время прямого прохода. Вызов `.backward()` воспроизводит ленту в обратном порядке.

```python
x = torch.randn(3, requires_grad=True)
y = x ** 2 + 3 * x
z = y.sum()
z.backward()
print(x.grad)  # dz/dx = 2x + 3
```

Три правила autograd:

1. Только листовые тензоры с `requires_grad=True` накапливают градиенты
2. Градиенты по умолчанию накапливаются — вызывайте `optimizer.zero_grad()` перед каждым обратным проходом
3. `torch.no_grad()` отключает отслеживание градиентов (используется во время оценки)

### nn.Module

`nn.Module` — базовый класс для каждого компонента нейронной сети в PyTorch. Вы уже построили эту абстракцию в Уроке 10. Версия PyTorch добавляет автоматическую регистрацию параметров, рекурсивное обнаружение модулей, управление устройствами и сериализацию словаря состояния.

```python
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()
        self.layer1 = nn.Linear(input_dim, hidden_dim)
        self.relu = nn.ReLU()
        self.layer2 = nn.Linear(hidden_dim, output_dim)

    def forward(self, x):
        x = self.layer1(x)
        x = self.relu(x)
        x = self.layer2(x)
        return x
```

Когда вы присваиваете `nn.Module` или `nn.Parameter` как атрибут в `__init__`, PyTorch автоматически его регистрирует. `model.parameters()` рекурсивно собирает каждый зарегистрированный параметр. Именно поэтому вам никогда не нужно вручную собирать веса, как вы делали в мини-фреймворке.

Ключевые строительные блоки:

| Модуль | Что делает | Параметры |
|--------|-------------|------------|
| nn.Linear(in, out) | Линейное преобразование: Wx + b | in*out + out |
| nn.Conv2d(in_ch, out_ch, k) | 2D-свёртка | in_ch*out_ch*k*k + out_ch |
| nn.BatchNorm1d(features) | Нормализация активаций | 2 * features |
| nn.Dropout(p) | Случайное обнуление | 0 |
| nn.ReLU() | max(0, x) | 0 |
| nn.GELU() | Линейный блок с гауссовской функцией ошибки | 0 |
| nn.Embedding(vocab, dim) | Таблица поиска | vocab * dim |
| nn.LayerNorm(dim) | Нормализация по отдельному образцу | 2 * dim |

### Функции потерь и оптимизаторы

PyTorch поставляет готовые к продакшену версии всего, что вы построили.

**Функции потерь** (из `torch.nn`):

| Функция потерь | Задача | Вход |
|------|------|-------|
| nn.MSELoss() | Регрессия | Любая форма |
| nn.CrossEntropyLoss() | Многоклассовая классификация | Логиты (не softmax) |
| nn.BCEWithLogitsLoss() | Бинарная классификация | Логиты (не sigmoid) |
| nn.L1Loss() | Регрессия (устойчивая) | Любая форма |
| nn.CTCLoss() | Выравнивание последовательностей | Логарифмы вероятностей |

Примечание: `CrossEntropyLoss` внутренне объединяет `LogSoftmax` + `NLLLoss`. Передавайте сырые логиты, а не выходы softmax. Это частая ошибка, которая молча приводит к неверным градиентам.

**Оптимизаторы** (из `torch.optim`):

| Оптимизатор | Когда использовать | Типичная скорость обучения (LR) |
|-----------|-------------|-----------|
| SGD(params, lr, momentum) | CNN, хорошо настроенные конвейеры | 0.01--0.1 |
| Adam(params, lr) | Отправная точка по умолчанию | 1e-3 |
| AdamW(params, lr, weight_decay) | Трансформеры, дообучение | 1e-4--1e-3 |
| LBFGS(params) | Малый масштаб, второй порядок | 1.0 |

### Цикл обучения

Каждый цикл обучения в PyTorch следует одному и тому же 5-шаговому паттерну. Вы уже знаете это из Урока 10.

```mermaid
sequenceDiagram
    participant D as DataLoader
    participant M as Model
    participant L as Loss fn
    participant O as Optimizer

    loop Each Epoch
        D->>M: batch = next(dataloader)
        M->>L: predictions = model(batch)
        L->>L: loss = criterion(predictions, targets)
        L->>M: loss.backward()
        O->>M: optimizer.step()
        O->>O: optimizer.zero_grad()
    end
```

Канонический паттерн:

```python
for epoch in range(num_epochs):
    model.train()
    for inputs, targets in train_loader:
        inputs, targets = inputs.to(device), targets.to(device)
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()
```

Пять строк внутри цикла по пакетам. Пять строк, которые обучили GPT-4, Stable Diffusion и LLaMA. Архитектура меняется. Данные меняются. Эти пять строк — нет.

### Dataset и DataLoader

`Dataset` в PyTorch — это абстрактный класс с двумя методами: `__len__` и `__getitem__`. `DataLoader` оборачивает его пакетированием, перемешиванием и многопроцессной загрузкой данных.

```python
from torch.utils.data import Dataset, DataLoader

class MNISTDataset(Dataset):
    def __init__(self, images, labels):
        self.images = images
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.images[idx], self.labels[idx]

loader = DataLoader(dataset, batch_size=64, shuffle=True, num_workers=4)
```

`num_workers=4` запускает 4 процесса для параллельной загрузки данных, пока GPU обучается на текущем пакете. На задачах, ограниченных скоростью диска (большие изображения, аудио), это само по себе может удвоить скорость обучения.

### Обучение на GPU

Перенос модели на GPU:

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = model.to(device)
```

Это рекурсивно переносит каждый параметр и буфер на GPU. Затем переносите каждый пакет во время обучения:

```python
inputs, targets = inputs.to(device), targets.to(device)
```

**Смешанная точность** вдвое снижает использование памяти и вдвое увеличивает пропускную способность на современных GPU (A100, H100, RTX 4090), выполняя прямой/обратный проход в float16 и сохраняя мастер-веса в float32:

```python
from torch.amp import autocast, GradScaler

scaler = GradScaler()
for inputs, targets in loader:
    with autocast(device_type="cuda"):
        outputs = model(inputs)
        loss = criterion(outputs, targets)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
    optimizer.zero_grad()
```

### Сравнение: мини-фреймворк, PyTorch и JAX

| Характеристика | Мини-фреймворк (урок 10) | PyTorch | JAX |
|---------|---------------------|---------|-----|
| Автодифференцирование | Ручной backward() | Autograd на основе ленты | Функциональные преобразования |
| Выполнение | Немедленное (циклы Python) | Немедленное (ядра C++) | Трассировка + JIT-компиляция |
| Поддержка GPU | Нет | Да (CUDA, ROCm, MPS) | Да (CUDA, TPU) |
| Скорость (MNIST MLP) | ~300 с/эпоху | ~0.5 с/эпоху | ~0.3 с/эпоху |
| Система модулей | Собственный класс Module | nn.Module | Функции без состояния (Flax/Equinox) |
| Отладка | print() | print(), pdb, breakpoint() | Сложнее (трассировка JIT ломает print) |
| Экосистема | Отсутствует | Hugging Face, Lightning, timm | Flax, Optax, Orbax |
| Кривая обучения | Вы её построили | Умеренная | Крутая (функциональная парадигма) |
| Использование в продакшене | Игрушечные задачи | Meta, OpenAI, Anthropic, HF | Google DeepMind, Midjourney |

```figure
dropout-mask
```

## Создаём

3-слойный MLP, обученный на MNIST, с использованием только примитивов PyTorch. Без высокоуровневых обёрток. Без `torchvision.datasets`. Мы скачиваем и разбираем сырые данные сами.

### Шаг 1: Загрузка MNIST из необработанных файлов

MNIST поставляется в виде 4 gzip-файлов: обучающие изображения (60 000 x 28 x 28), обучающие метки, тестовые изображения (10 000 x 28 x 28), тестовые метки. Мы скачиваем их и разбираем бинарный формат.

```python
import torch
import torch.nn as nn
import struct
import gzip
import urllib.request
import os

def download_mnist(path="./mnist_data"):
    base_url = "https://storage.googleapis.com/cvdf-datasets/mnist/"
    files = [
        "train-images-idx3-ubyte.gz",
        "train-labels-idx1-ubyte.gz",
        "t10k-images-idx3-ubyte.gz",
        "t10k-labels-idx1-ubyte.gz",
    ]
    os.makedirs(path, exist_ok=True)
    for f in files:
        filepath = os.path.join(path, f)
        if not os.path.exists(filepath):
            urllib.request.urlretrieve(base_url + f, filepath)

def load_images(filepath):
    with gzip.open(filepath, "rb") as f:
        magic, num, rows, cols = struct.unpack(">IIII", f.read(16))
        data = f.read()
        images = torch.frombuffer(bytearray(data), dtype=torch.uint8)
        images = images.reshape(num, rows * cols).float() / 255.0
    return images

def load_labels(filepath):
    with gzip.open(filepath, "rb") as f:
        magic, num = struct.unpack(">II", f.read(8))
        data = f.read()
        labels = torch.frombuffer(bytearray(data), dtype=torch.uint8).long()
    return labels
```

### Шаг 2: Определение модели

3-слойный MLP: 784 -> 256 -> 128 -> 10. Активации ReLU. Дропаут для регуляризации. Без пакетной нормализации — для простоты.

```python
class MNISTModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(784, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 10),
        )

    def forward(self, x):
        return self.net(x)
```

Выходной слой выдаёт 10 сырых логитов (по одному на цифру). Без softmax — `CrossEntropyLoss` обрабатывает это внутренне.

Количество параметров: 784*256 + 256 + 256*128 + 128 + 128*10 + 10 = 235 146. Крошечное по современным меркам. У GPT-2 small — 124 млн. Это обучается за секунды.

### Шаг 3: Цикл обучения

Каноническая схема: прямой проход — вычисление функции потерь — обратный проход — шаг оптимизатора.

```python
def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)
    return total_loss / total, correct / total


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            total_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)
    return total_loss / total, correct / total
```

Обратите внимание на `torch.no_grad()` во время оценки. Это отключает autograd, снижая использование памяти и ускоряя инференс. Без него PyTorch строит вычислительный граф, который вы никогда не используете.

### Шаг 4: Соединяем всё вместе

```python
def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    download_mnist()
    train_images = load_images("./mnist_data/train-images-idx3-ubyte.gz")
    train_labels = load_labels("./mnist_data/train-labels-idx1-ubyte.gz")
    test_images = load_images("./mnist_data/t10k-images-idx3-ubyte.gz")
    test_labels = load_labels("./mnist_data/t10k-labels-idx1-ubyte.gz")

    train_dataset = torch.utils.data.TensorDataset(train_images, train_labels)
    test_dataset = torch.utils.data.TensorDataset(test_images, test_labels)
    train_loader = torch.utils.data.DataLoader(
        train_dataset, batch_size=64, shuffle=True
    )
    test_loader = torch.utils.data.DataLoader(
        test_dataset, batch_size=256, shuffle=False
    )

    model = MNISTModel().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    num_params = sum(p.numel() for p in model.parameters())
    print(f"Device: {device}")
    print(f"Parameters: {num_params:,}")
    print(f"Train samples: {len(train_dataset):,}")
    print(f"Test samples: {len(test_dataset):,}")
    print()

    for epoch in range(10):
        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device
        )
        test_loss, test_acc = evaluate(
            model, test_loader, criterion, device
        )
        print(
            f"Epoch {epoch+1:2d} | "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
            f"Test Loss: {test_loss:.4f} | Test Acc: {test_acc:.4f}"
        )

    torch.save(model.state_dict(), "mnist_mlp.pt")
    print(f"\nModel saved to mnist_mlp.pt")
    print(f"Final test accuracy: {test_acc:.4f}")
```

Ожидаемый результат после 10 эпох: ~97.8% точности на тесте. Время обучения на CPU: ~30 секунд. На GPU: ~5 секунд. На вашем мини-фреймворке с той же архитектурой: ~45 минут.

## Применяем

### Быстрое сравнение мини-фреймворка и PyTorch

| Мини-фреймворк (Урок 10) | PyTorch |
|---------------------------|---------|
| `model = Sequential(Linear(784, 256), ReLU(), ...)` | `model = nn.Sequential(nn.Linear(784, 256), nn.ReLU(), ...)` |
| `pred = model.forward(x)` | `pred = model(x)` |
| `optimizer.zero_grad()` | `optimizer.zero_grad()` |
| `grad = criterion.backward()` затем `model.backward(grad)` | `loss.backward()` |
| `optimizer.step()` | `optimizer.step()` |
| Без GPU | `model.to("cuda")` |
| Ручной backward для каждого модуля | Autograd обрабатывает всё |

Интерфейс почти идентичен. Разница — во всём, что находится под капотом.

### Сохранение и загрузка моделей

```python
torch.save(model.state_dict(), "model.pt")

model = MNISTModel()
model.load_state_dict(torch.load("model.pt", weights_only=True))
model.eval()
```

Всегда сохраняйте `state_dict()` (словарь параметров), а не объект модели. Сохранение объекта модели использует pickle, что ломается при рефакторинге кода. Словари состояния переносимы.

### Планирование скорости обучения

```python
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
    optimizer, T_max=10
)
for epoch in range(10):
    train_one_epoch(model, train_loader, criterion, optimizer, device)
    scheduler.step()
```

PyTorch поставляет более 15 планировщиков: StepLR, ExponentialLR, CosineAnnealingLR, OneCycleLR, ReduceLROnPlateau. Все подключаются к одному и тому же интерфейсу оптимизатора.

## Публикуем

Этот урок создаёт два артефакта:

- `outputs/prompt-pytorch-debugger.md` -- промпт для диагностики распространённых ошибок обучения в PyTorch
- `outputs/skill-pytorch-patterns.md` -- справочник навыков по паттернам обучения в PyTorch

## Упражнения

1. **Добавьте пакетную нормализацию.** Вставьте `nn.BatchNorm1d` после каждого линейного слоя (перед активацией). Сравните точность на тесте и скорость обучения с версией, использующей только дропаут. Пакетная нормализация должна достигать 98%+ за меньшее число эпох.

2. **Реализуйте поиск скорости обучения.** Обучайте одну эпоху с экспоненциально растущей скоростью обучения (от 1e-7 до 1.0). Постройте график потерь в зависимости от LR. Оптимальная LR — прямо перед тем, как потери начинают расти. Используйте это, чтобы подобрать лучшую LR для модели MNIST.

3. **Перенесите на GPU со смешанной точностью.** Добавьте `torch.amp.autocast` и `GradScaler` в цикл обучения. Измерьте пропускную способность (образцов в секунду) с включённой и выключенной смешанной точностью на GPU. На A100 ожидайте ускорение примерно в 2 раза.

4. **Постройте собственный Dataset.** Скачайте Fashion-MNIST (тот же формат, что у MNIST, но с предметами одежды). Реализуйте класс `FashionMNISTDataset(Dataset)` с `__getitem__` и `__len__`. Обучите тот же MLP и сравните точность. Fashion-MNIST сложнее — ожидайте ~88% против ~98%.

5. **Замените Adam на SGD с моментом.** Обучите с `SGD(params, lr=0.01, momentum=0.9)`. Сравните кривые сходимости. Затем добавьте планировщик `CosineAnnealingLR` и посмотрите, догонит ли SGD Adam к 10-й эпохе.

## Ключевые термины

| Термин | Что говорят | Что это значит на самом деле |
|------|----------------|----------------------|
| Тензор | «Многомерный массив» | Типизированный, привязанный к устройству массив со встроенной в каждую операцию поддержкой автоматического дифференцирования |
| Autograd | «Автоматическое обратное распространение ошибки» | Система на основе ленты, которая записывает операции во время прямого прохода, а затем воспроизводит их в обратном порядке для вычисления точных градиентов |
| nn.Module | «Слой» | Базовый класс для любого дифференцируемого вычислительного блока — регистрирует параметры, поддерживает вложенность, обрабатывает режимы train/eval |
| state_dict | «Веса модели» | OrderedDict, отображающий имена параметров на тензоры — переносимое, сериализуемое представление обученной модели |
| .backward() | «Вычислить градиенты» | Обход вычислительного графа в обратном порядке с вычислением и накоплением градиентов для каждого листового тензора с requires_grad=True |
| .to(device) | «Перенести на GPU» | Рекурсивный перенос всех параметров и буферов на указанное устройство (CPU, CUDA, MPS) |
| DataLoader | «Конвейер данных» | Итератор, который пакетирует, перемешивает и опционально распараллеливает загрузку данных из Dataset |
| Смешанная точность | «Использовать float16» | Обучение с прямым/обратным проходом в float16 ради скорости при сохранении мастер-весов в float32 ради численной устойчивости |
| Немедленное выполнение | «Запустить прямо сейчас» | Операции выполняются немедленно при вызове, а не откладываются до этапа компиляции — ключевое проектное решение, которое отличает PyTorch от TF 1.x |
| zero_grad | «Сбросить градиенты» | Обнуление градиентов всех параметров перед следующим обратным проходом, поскольку PyTorch по умолчанию накапливает градиенты |

## Дополнительные материалы

- Paszke et al., "PyTorch: An Imperative Style, High-Performance Deep Learning Library" (2019) -- оригинальная статья, объясняющая компромиссы в проектировании PyTorch
- PyTorch Tutorials: "Learning PyTorch with Examples" (https://pytorch.org/tutorials/beginner/pytorch_with_examples.html) -- официальный путь от тензоров к nn.Module
- PyTorch Performance Tuning Guide (https://pytorch.org/tutorials/recipes/recipes/tuning_guide.html) -- смешанная точность, воркеры DataLoader, закреплённая память и другие оптимизации для продакшена
- Horace He, "Making Deep Learning Go Brrrr" (https://horace.io/brrr_intro.html) -- почему обучение на GPU быстрое, со специфичными для PyTorch стратегиями оптимизации
