# Расписания скорости обучения и разогрев

> Скорость обучения — самый важный гиперпараметр из всех. Не архитектура. Не размер набора данных. Не функция активации. Скорость обучения. Если вы не настраиваете больше ничего, настройте это.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Урок 03.06 (Оптимизаторы), Урок 03.08 (Инициализация весов)
**Время:** ~90 минут

## Цели обучения

- Реализовать с нуля расписания скорости обучения: постоянное, ступенчатое затухание, косинусное затухание, разогрев + косинус и 1cycle
- Продемонстрировать три режима сбоя при выборе скорости обучения: расхождение (слишком высокая), застревание (слишком низкая) и колебание (нет затухания)
- Объяснить, почему разогрев необходим для оптимизаторов на основе Adam и как он стабилизирует раннее обучение
- Сравнить скорость сходимости всех пяти расписаний на одной и той же задаче и выбрать подходящее для заданного бюджета обучения

## Проблема

Установите скорость обучения 0.1. Обучение расходится — потери улетают в бесконечность за 3 шага. Установите 0.0001. Обучение ползёт — после 100 эпох модель едва сдвинулась от случайного состояния. Установите 0.01. Обучение работает 50 эпох, затем потери колеблются вокруг минимума, которого модель никогда не может достичь, потому что шаги слишком велики.

Оптимальная скорость обучения не постоянна. Она меняется в процессе обучения. Вначале вам нужны большие шаги, чтобы быстро покрыть пространство. К концу обучения нужны крошечные шаги, чтобы устроиться в резком минимуме. Разница между моделью с точностью 90% и моделью с точностью 95% часто — просто в расписании.

Каждая крупная модель, опубликованная за последние три года, использует расписание скорости обучения. Llama 3 использовала пиковую lr=3e-4 с 2000 шагами разогрева и косинусным затуханием до 3e-5. GPT-3 использовала lr=6e-4 с разогревом на протяжении 375 миллионов токенов. Это не произвольные выборы. Это результат обширного перебора гиперпараметров, стоивших миллионы долларов.

Вам нужно понимать расписания, потому что значения по умолчанию не подойдут для вашей задачи. Когда вы дообучаете предобученную модель, правильное расписание отличается от обучения с нуля. Когда вы увеличиваете размер пакета, период разогрева нужно менять. Когда обучение ломается на шаге 10 000, вам нужно знать, проблема ли это расписания или что-то ещё.

## Концепция

### Постоянная скорость обучения

Самый простой подход. Выберите число, используйте его на каждом шаге.

```
lr(t) = lr_0
```

Редко оптимальна. Она либо слишком высока для конца обучения (колебание вокруг минимума), либо слишком низка для начала (потраченные впустую вычисления на крошечные шаги). Хорошо работает для маленьких моделей и отладки. Ужасный выбор для всего, что обучается дольше часа.

### Ступенчатое затухание

Старый подход из эпохи ResNet. Снижайте скорость обучения на коэффициент (обычно 10x) на фиксированных эпохах.

```
lr(t) = lr_0 * gamma^(floor(epoch / step_size))
```

Где gamma = 0.1 и step_size = 30 означает: lr падает в 10 раз каждые 30 эпох. ResNet-50 использовал это — lr=0.1, падение в 10 раз на эпохах 30, 60 и 90.

Проблема: оптимальные точки затухания зависят от набора данных и архитектуры. Перейдите к другой задаче, и вам понадобится заново настроить, когда снижать. Переходы резкие — потери могут скакнуть, когда скорость внезапно меняется.

### Косинусное затухание

Плавное затухание от максимальной скорости обучения до минимальной, следуя косинусной кривой:

```
lr(t) = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * t / T))
```

Где t — текущий шаг, а T — общее число шагов.

При t=0 косинусный член равен 1, поэтому lr = lr_max. При t=T косинусный член равен -1, поэтому lr = lr_min. Затухание сначала мягкое, ускоряется в середине и снова становится мягким ближе к концу.

Это значение по умолчанию для большинства современных запусков обучения. Никаких гиперпараметров для настройки, кроме lr_max и lr_min. Косинусная форма соответствует эмпирическому наблюдению, что большая часть обучения происходит в середине тренировки — вы хотите разумный размер шага именно в этот критический период.

### Разогрев: почему вы начинаете с малого

Adam и другие адаптивные оптимизаторы поддерживают скользящие оценки среднего и дисперсии градиента. На шаге 0 эти оценки инициализированы нулём. Первые несколько обновлений градиента основаны на бессмысленной статистике. Если ваша скорость обучения в этот период велика, модель делает огромные, плохо направленные шаги.

Разогрев это исправляет. Начните с крошечной скорости обучения (часто lr_max / warmup_steps или даже ноль) и линейно наращивайте до lr_max в течение первых N шагов. К моменту достижения полной скорости обучения статистика Adam уже стабилизировалась.

```
lr(t) = lr_max * (t / warmup_steps)     for t < warmup_steps
```

Типичный разогрев: 1-5% от общего числа шагов обучения. Llama 3 обучалась на ~1.8 триллиона токенов и разогревалась в течение 2000 шагов. GPT-3 разогревалась на протяжении 375 миллионов токенов.

### Линейный разогрев + косинусное затухание

Современное значение по умолчанию. Наращивайте линейно, затем затухайте по косинусу:

```
if t < warmup_steps:
    lr(t) = lr_max * (t / warmup_steps)
else:
    progress = (t - warmup_steps) / (total_steps - warmup_steps)
    lr(t) = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * progress))
```

Именно это используют Llama, GPT, PaLM и большинство современных трансформеров. Разогрев предотвращает раннюю нестабильность. Косинусное затухание устраивает модель в хорошем минимуме.

### Политика 1cycle

Открытие Лесли Смита (2018): наращивайте скорость обучения от низкого значения до высокого в первой половине обучения, затем снижайте её обратно во второй половине. Контринтуитивно — зачем вам *увеличивать* скорость обучения посреди обучения?

Теория: высокая скорость обучения действует как регуляризация, добавляя шум в траекторию оптимизации. Модель исследует больше ландшафта потерь во время фазы наращивания, находя лучшие бассейны. Фаза снижения затем уточняет решение внутри найденного лучшего бассейна.

```
Phase 1 (0 to T/2):    lr ramps from lr_max/25 to lr_max
Phase 2 (T/2 to T):    lr ramps from lr_max to lr_max/10000
```

1cycle часто обучается быстрее, чем косинусное затухание, при фиксированном вычислительном бюджете. Компромисс: вы должны заранее знать общее число шагов.

### Формы расписаний

```mermaid
graph LR
    subgraph "Constant"
        C1["lr"] --- C2["lr"] --- C3["lr"]
    end

    subgraph "Step Decay"
        S1["0.1"] --- S2["0.1"] --- S3["0.01"] --- S4["0.001"]
    end

    subgraph "Cosine Annealing"
        CS1["lr_max"] --> CS2["gradual"] --> CS3["steep"] --> CS4["lr_min"]
    end

    subgraph "Warmup + Cosine"
        WC1["0"] --> WC2["lr_max"] --> WC3["cosine"] --> WC4["lr_min"]
    end
```

### Блок-схема принятия решений

```mermaid
flowchart TD
    Start["Choosing a LR schedule"] --> Know{"Know total<br/>training steps?"}

    Know -->|"Yes"| Budget{"Compute budget?"}
    Know -->|"No"| Constant["Use constant LR<br/>with manual decay"]

    Budget -->|"Large (days/weeks)"| WarmCos["Warmup + Cosine Decay<br/>(Llama/GPT default)"]
    Budget -->|"Small (hours)"| OneCycle["1cycle Policy<br/>(fastest convergence)"]
    Budget -->|"Moderate"| Cosine["Cosine Annealing<br/>(safe default)"]

    WarmCos --> Warmup["Warmup = 1-5% of steps"]
    OneCycle --> FindLR["Find lr_max with LR range test"]
    Cosine --> MinLR["Set lr_min = lr_max / 10"]
```

### Реальные цифры из опубликованных моделей

```mermaid
graph TD
    subgraph "Published LR Configs"
        L3["Llama 3 (405B)<br/>Peak: 3e-4<br/>Warmup: 2000 steps<br/>Schedule: Cosine to 3e-5"]
        G3["GPT-3 (175B)<br/>Peak: 6e-4<br/>Warmup: 375M tokens<br/>Schedule: Cosine to 0"]
        R50["ResNet-50<br/>Peak: 0.1<br/>Warmup: none<br/>Schedule: Step decay x0.1 at 30,60,90"]
        B["BERT (340M)<br/>Peak: 1e-4<br/>Warmup: 10K steps<br/>Schedule: Linear decay"]
    end
```

```figure
lr-schedule
```

## Создаём

### Шаг 1: Функции расписания

Каждая функция принимает текущий шаг и возвращает скорость обучения на этом шаге.

```python
import math


def constant_schedule(step, lr=0.01, **kwargs):
    return lr


def step_decay_schedule(step, lr=0.1, step_size=100, gamma=0.1, **kwargs):
    return lr * (gamma ** (step // step_size))


def cosine_schedule(step, lr=0.01, total_steps=1000, lr_min=1e-5, **kwargs):
    if step >= total_steps:
        return lr_min
    return lr_min + 0.5 * (lr - lr_min) * (1 + math.cos(math.pi * step / total_steps))


def warmup_cosine_schedule(step, lr=0.01, total_steps=1000, warmup_steps=100, lr_min=1e-5, **kwargs):
    if total_steps <= warmup_steps:
        return lr * (step / max(warmup_steps, 1))
    if step < warmup_steps:
        return lr * step / warmup_steps
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    return lr_min + 0.5 * (lr - lr_min) * (1 + math.cos(math.pi * progress))


def one_cycle_schedule(step, lr=0.01, total_steps=1000, **kwargs):
    mid = max(total_steps // 2, 1)
    if step < mid:
        return (lr / 25) + (lr - lr / 25) * step / mid
    else:
        progress = (step - mid) / max(total_steps - mid, 1)
        return lr * (1 - progress) + (lr / 10000) * progress
```

### Шаг 2: Визуализация всех расписаний

Выведите текстовый график, показывающий, как каждое расписание эволюционирует в процессе обучения.

```python
def visualize_schedule(name, schedule_fn, total_steps=500, **kwargs):
    steps = list(range(0, total_steps, total_steps // 20))
    if total_steps - 1 not in steps:
        steps.append(total_steps - 1)

    lrs = [schedule_fn(s, total_steps=total_steps, **kwargs) for s in steps]
    max_lr = max(lrs) if max(lrs) > 0 else 1.0

    print(f"\n{name}:")
    for s, lr_val in zip(steps, lrs):
        bar_len = int(lr_val / max_lr * 40)
        bar = "#" * bar_len
        print(f"  Step {s:4d}: lr={lr_val:.6f} {bar}")
```

### Шаг 3: Обучающая сеть

Простая двухслойная сеть на наборе данных «круг», как в предыдущих уроках, но теперь мы варьируем расписание.

```python
import random


def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def relu(x):
    return max(0.0, x)


def relu_deriv(x):
    return 1.0 if x > 0 else 0.0


def make_circle_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        x = random.uniform(-2, 2)
        y = random.uniform(-2, 2)
        label = 1.0 if x * x + y * y < 1.5 else 0.0
        data.append(([x, y], label))
    return data


def train_with_schedule(schedule_fn, schedule_name, data, epochs=300, base_lr=0.05, **kwargs):
    random.seed(0)
    hidden_size = 8
    total_steps = epochs * len(data)

    std = math.sqrt(2.0 / 2)
    w1 = [[random.gauss(0, std) for _ in range(2)] for _ in range(hidden_size)]
    b1 = [0.0] * hidden_size
    w2 = [random.gauss(0, std) for _ in range(hidden_size)]
    b2 = 0.0

    step = 0
    epoch_losses = []

    for epoch in range(epochs):
        total_loss = 0
        correct = 0

        for x, target in data:
            lr = schedule_fn(step, lr=base_lr, total_steps=total_steps, **kwargs)

            z1 = []
            h = []
            for i in range(hidden_size):
                z = w1[i][0] * x[0] + w1[i][1] * x[1] + b1[i]
                z1.append(z)
                h.append(relu(z))

            z2 = sum(w2[i] * h[i] for i in range(hidden_size)) + b2
            out = sigmoid(z2)

            error = out - target
            d_out = error * out * (1 - out)

            for i in range(hidden_size):
                d_h = d_out * w2[i] * relu_deriv(z1[i])
                w2[i] -= lr * d_out * h[i]
                for j in range(2):
                    w1[i][j] -= lr * d_h * x[j]
                b1[i] -= lr * d_h
            b2 -= lr * d_out

            total_loss += (out - target) ** 2
            if (out >= 0.5) == (target >= 0.5):
                correct += 1
            step += 1

        avg_loss = total_loss / len(data)
        accuracy = correct / len(data) * 100
        epoch_losses.append(avg_loss)

    return epoch_losses
```

### Шаг 4: Сравнение всех расписаний

Обучите одну и ту же сеть с каждым расписанием и сравните итоговые потери и поведение сходимости.

```python
def compare_schedules(data):
    configs = [
        ("Constant", constant_schedule, {}),
        ("Step Decay", step_decay_schedule, {"step_size": 15000, "gamma": 0.1}),
        ("Cosine", cosine_schedule, {"lr_min": 1e-5}),
        ("Warmup+Cosine", warmup_cosine_schedule, {"warmup_steps": 3000, "lr_min": 1e-5}),
        ("1cycle", one_cycle_schedule, {}),
    ]

    print(f"\n{'Schedule':<20} {'Start Loss':>12} {'Mid Loss':>12} {'End Loss':>12} {'Best Loss':>12}")
    print("-" * 70)

    for name, schedule_fn, extra_kwargs in configs:
        losses = train_with_schedule(schedule_fn, name, data, epochs=300, base_lr=0.05, **extra_kwargs)
        mid_idx = len(losses) // 2
        best = min(losses)
        print(f"{name:<20} {losses[0]:>12.6f} {losses[mid_idx]:>12.6f} {losses[-1]:>12.6f} {best:>12.6f}")
```

### Шаг 5: Слишком высокая LR против слишком низкой

Продемонстрируйте три режима сбоя: слишком высокая (расхождение), слишком низкая (ползание) и в самый раз.

```python
def lr_sensitivity(data):
    learning_rates = [1.0, 0.1, 0.01, 0.001, 0.0001]

    print("\nLR Sensitivity (constant schedule, 100 epochs):")
    print(f"  {'LR':>10} {'Start Loss':>12} {'End Loss':>12} {'Status':>15}")
    print("  " + "-" * 52)

    for lr in learning_rates:
        losses = train_with_schedule(constant_schedule, f"lr={lr}", data, epochs=100, base_lr=lr)
        start = losses[0]
        end = losses[-1]

        if end > start or math.isnan(end) or end > 1.0:
            status = "DIVERGED"
        elif end > start * 0.9:
            status = "BARELY MOVED"
        elif end < 0.15:
            status = "CONVERGED"
        else:
            status = "LEARNING"

        end_str = f"{end:.6f}" if not math.isnan(end) else "NaN"
        print(f"  {lr:>10.4f} {start:>12.6f} {end_str:>12} {status:>15}")
```

## Применяем

PyTorch предоставляет планировщики в `torch.optim.lr_scheduler`:

```python
import torch
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR, OneCycleLR, StepLR

model = nn.Sequential(nn.Linear(10, 64), nn.ReLU(), nn.Linear(64, 1))
optimizer = optim.Adam(model.parameters(), lr=3e-4)

scheduler = CosineAnnealingLR(optimizer, T_max=1000, eta_min=1e-5)

for step in range(1000):
    loss = train_step(model, optimizer)
    scheduler.step()
```

Для разогрева + косинуса используйте lambda-планировщик или `get_cosine_schedule_with_warmup` из HuggingFace:

```python
from transformers import get_cosine_schedule_with_warmup

scheduler = get_cosine_schedule_with_warmup(
    optimizer,
    num_warmup_steps=2000,
    num_training_steps=100000,
)
```

Функция HuggingFace — то, что используют большинство скриптов дообучения Llama и GPT. Когда сомневаетесь, используйте разогрев + косинус с разогревом = 3-5% от общего числа шагов. Это работает почти для всего.

## Публикуем

Этот урок создаёт:
- `outputs/prompt-lr-schedule-advisor.md` — промпт, который рекомендует правильное расписание скорости обучения и гиперпараметры для вашей конфигурации обучения

## Упражнения

1. Реализуйте экспоненциальное затухание: lr(t) = lr_0 * gamma^t, где gamma = 0.999. Сравните с косинусным затуханием на наборе данных «круг».

2. Реализуйте тест диапазона скорости обучения (Лесли Смит): обучайтесь несколько сотен шагов, экспоненциально увеличивая LR от 1e-7 до 1. Постройте график потерь в зависимости от LR. Оптимальная максимальная LR находится прямо перед тем, как потери начинают расти.

3. Обучитесь с разогревом + косинусом, варьируя длину разогрева: 0%, 1%, 5%, 10%, 20% от общего числа шагов. Найдите оптимальную точку, где обучение наиболее стабильно.

4. Реализуйте косинусное затухание с тёплыми перезапусками (SGDR): сбрасывайте скорость обучения до lr_max каждые T шагов и затухайте снова. Сравните со стандартным косинусом на более длинном запуске обучения.

5. Постройте «хирурга расписания», который отслеживает потери обучения и автоматически переключается с разогрева на косинус, когда потери стабилизируются, и снижает lr, если потери выходят на плато слишком надолго.

## Ключевые термины

| Термин | Что говорят | Что это значит на самом деле |
|------|----------------|----------------------|
| Learning rate | «Насколько быстро модель учится» | Скаляр, на который умножается градиент для определения размера обновления параметра |
| Schedule | «Менять LR со временем» | Функция, отображающая шаг обучения в скорость обучения, спроектированная для оптимизации сходимости |
| Warmup | «Начать с малой LR» | Линейное наращивание LR от почти нуля до целевого значения в течение первых N шагов для стабилизации статистики оптимизатора |
| Cosine annealing | «Плавное затухание LR» | Снижение LR по косинусной кривой от lr_max до lr_min на протяжении обучения |
| Step decay | «Снижать LR на контрольных точках» | Умножение LR на коэффициент (обычно 0.1) на фиксированных интервалах эпох |
| 1cycle policy | «Вверх, затем вниз» | Метод Лесли Смита, наращивающий LR вверх, а затем вниз за один цикл для более быстрой сходимости |
| LR range test | «Найти лучшую скорость обучения» | Кратковременное обучение с увеличением LR для нахождения значения, при котором потери начинают расходиться |
| Cosine with warm restarts | «Сбросить и повторить» | Периодический сброс LR до lr_max и повторное затухание (SGDR) |
| Eta min | «Нижняя граница для LR» | Минимальная скорость обучения, до которой затухает расписание |
| Peak learning rate | «Максимальная LR» | Наивысшая LR, достигнутая во время обучения, обычно после разогрева |

## Дополнительные материалы

- Loshchilov & Hutter, "SGDR: Stochastic Gradient Descent with Warm Restarts" (2017) — представила косинусное затухание и тёплые перезапуски
- Smith, "Super-Convergence: Very Fast Training of Neural Networks Using Large Learning Rates" (2018) — статья про политику 1cycle
- Touvron et al., "Llama 2: Open Foundation and Fine-Tuned Chat Models" (2023) — документирует расписание разогрев + косинус, используемое в масштабе
- Goyal et al., "Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour" (2017) — правило линейного масштабирования и разогрев для обучения с большими пакетами
