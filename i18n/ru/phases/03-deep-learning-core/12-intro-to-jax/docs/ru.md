# Введение в JAX

> PyTorch изменяет тензоры. TensorFlow строит графы. JAX компилирует чистые функции. Именно последнее меняет то, как вы думаете о глубоком обучении.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 03, Уроки 01-10, базовый NumPy
**Время:** ~90 минут

## Цели обучения

- Писать код нейронных сетей в виде чистых функций, используя функциональный API JAX (jax.numpy, jax.grad, jax.jit, jax.vmap)
- Объяснить ключевое различие в дизайне между eager-мутацией в PyTorch и функциональной моделью компиляции в JAX
- Применять JIT-компиляцию и векторизацию vmap для ускорения циклов обучения по сравнению с наивным Python
- Обучить простую сеть в JAX и сопоставить явное управление состоянием с объектно-ориентированным подходом PyTorch

## Проблема

Вы умеете строить нейронные сети в PyTorch. Вы определяете `nn.Module`, вызываете `.backward()`, делаете шаг оптимизатора. Это работает. Этим пользуются миллионы людей.

Но в ДНК PyTorch заложено ограничение: он отслеживает операции eager-способом, по одной, в Python. Каждое `tensor + tensor` — это отдельный запуск ядра. Каждый шаг обучения заново интерпретирует один и тот же код Python. Это прекрасно работает, пока вам не понадобится обучить модель с 540 миллиардами параметров на 2048 TPU. Тогда накладные расходы вас убивают.

Google DeepMind обучает Gemini на JAX. Anthropic обучал Claude на JAX. Это не мелкие проекты — это крупнейшие в мире запуски обучения нейронных сетей. Они выбрали JAX, потому что он рассматривает ваш цикл обучения как компилируемую программу, а не последовательность вызовов Python.

JAX — это NumPy с тремя суперспособностями: автоматическое дифференцирование, JIT-компиляция в XLA и автоматическая векторизация. Вы пишете функцию, обрабатывающую один пример. JAX даёт вам функцию, которая обрабатывает пакет, вычисляет градиенты, компилируется в машинный код и запускается на нескольких устройствах. И всё это без изменения исходной функции.

## Концепция

### Философия JAX

JAX — функциональный фреймворк. Никаких классов, никакого изменяемого состояния, никакого метода `.backward()`. Вместо этого:

| PyTorch | JAX |
|---------|-----|
| Класс `nn.Module` с состоянием | Чистая функция: `f(params, x) -> y` |
| `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| Eager-выполнение | JIT-компиляция через XLA |
| Ручной цикл `for x in batch:` | Автовекторизация `jax.vmap(f)` |
| `DataParallel` / `FSDP` | Автопараллелизм `jax.pmap(f)` |
| Изменяемый `model.parameters()` | Неизменяемый pytree массивов |

Это не вопрос стиля. Это ограничение компилятора. JIT-компиляция требует чистых функций — одни и те же входы всегда дают одни и те же выходы, без побочных эффектов. Именно это ограничение делает возможным ускорение в 100 раз.

### jax.numpy: знакомая поверхность

JAX заново реализует API NumPy для ускорителей:

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

Те же имена функций. Те же правила broadcasting. Та же семантика срезов. Но массивы находятся на GPU/TPU, и каждая операция трассируема компилятором.

Одно критическое отличие: массивы JAX неизменяемы. Никакого `a[0] = 5`. Вместо этого: `a = a.at[0].set(5)`. Первую неделю это ощущается неудобным, а потом щёлкает — именно неизменяемость делает преобразования вроде `grad`, `jit` и `vmap` компонуемыми.

### jax.grad: функциональное автодифференцирование

PyTorch прикрепляет градиенты к тензорам (`.grad`). JAX прикрепляет градиенты к функциям.

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

`jax.grad` принимает функцию и возвращает новую функцию, которая вычисляет градиент. Никакого вызова `.backward()`. Никакого вычислительного графа, хранящегося на тензорах. Градиент — это просто ещё одна функция, которую можно вызвать, скомпоновать или скомпилировать через JIT.

Это компонуется произвольным образом:

```python
d2f = jax.grad(jax.grad(f))
d2f(3.0)
```

Вторые производные. Третьи производные. Якобианы. Гессианы. Всё — композицией `grad`. PyTorch тоже так умеет (`torch.autograd.functional.hessian`), но это надстройка сбоку. В JAX это фундамент.

Ограничение: `grad` работает только с чистыми функциями. Никаких print-выражений внутри (они выполняются во время трассировки, а не выполнения). Никакой мутации внешнего состояния. Никакой генерации случайных чисел без явного управления ключами.

### jit: компиляция в XLA

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss

fast_step = jax.jit(train_step)
```

При первом вызове JAX трассирует функцию — записывает, какие операции происходят, не выполняя их. Затем передаёт эту трассировку в XLA (Accelerated Linear Algebra) — компилятор Google для TPU и GPU. XLA объединяет операции, устраняет избыточные копирования памяти и генерирует оптимизированный машинный код.

Последующие вызовы полностью пропускают Python. Скомпилированный код выполняется на ускорителе со скоростью C++.

Когда JIT помогает:
- Шаги обучения (одно и то же вычисление повторяется тысячи раз)
- Инференс (одна и та же модель, разные входы)
- Любая функция, вызываемая более одного раза со входами схожей формы

Когда JIT вредит:
- Функциям с управлением потоком выполнения Python, зависящим от значений (`if x > 0`, где x — трассируемый массив)
- Одноразовым вычислениям (накладные расходы на компиляцию превышают время выполнения)
- Отладке (трассировка скрывает реальное выполнение)

Ограничение на управление потоком выполнения реально. `jax.lax.cond` заменяет `if/else`. `jax.lax.scan` заменяет циклы `for`. Это не опционально — это цена компиляции.

### vmap: автоматическая векторизация

Вы пишете функцию, обрабатывающую один пример:

```python
def predict(params, x):
    return jnp.dot(params['w'], x) + params['b']
```

`vmap` поднимает её до обработки пакета:

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

`in_axes=(None, 0)` означает: не пакетировать по `params` (общие для всех), пакетировать по оси 0 `x`. Никакого ручного цикла `for`. Никакого изменения формы. Никакой протяжки размерности пакета через весь код. JAX сам определяет размерность пакета и векторизует всё вычисление.

Это не синтаксический сахар. `vmap` генерирует объединённый векторизованный код, который выполняется в 10-100 раз быстрее, чем цикл Python. И он компонуется с `jit` и `grad`:

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

Градиенты по отдельным примерам. Одна строка. В PyTorch это почти невозможно без хаков.

### pmap: параллелизм данных между устройствами

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

`pmap` реплицирует функцию на всех доступных устройствах (GPU/TPU) и разбивает пакет. Внутри функции `jax.lax.pmean` и `jax.lax.psum` синхронизируют градиенты между устройствами.

Google обучает Gemini на тысячах чипов TPU v5e с помощью `pmap` (и его преемника `shard_map`). Модель программирования: напишите версию для одного устройства, оберните её `pmap` — готово.

### Pytree: универсальная структура данных

JAX работает с «pytree» — вложенными комбинациями списков, кортежей, словарей и массивов. Параметры вашей модели — это pytree:

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

Каждое преобразование JAX — `grad`, `jit`, `vmap` — умеет обходить pytree. `jax.tree.map(f, tree)` применяет `f` к каждому листу. Именно так оптимизаторы обновляют все параметры одновременно:

```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

Никакого метода `.parameters()`. Никакой регистрации параметров. Структура дерева и есть модель.

### Функциональный подход против объектно-ориентированного

PyTorch хранит состояние внутри объектов:

```python
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)

    def forward(self, x):
        return self.linear(x)
```

JAX использует чистые функции с явным состоянием:

```python
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

Параметры передаются извне. Ничего не хранится. Ничего не мутируется. Это делает каждую функцию тестируемой, компонуемой и компилируемой. Также это значит, что вы сами управляете параметрами — либо используете библиотеку вроде Flax или Equinox.

### Экосистема JAX

JAX даёт вам примитивы. Библиотеки дают вам эргономику:

| Library | Роль | Стиль |
|---------|------|-------|
| **Flax** (Google) | Слои нейронных сетей | `nn.Module` с явным состоянием |
| **Equinox** (Patrick Kidger) | Слои нейронных сетей | На основе pytree, питонично |
| **Optax** (DeepMind) | Оптимизаторы + расписания LR | Компонуемые преобразования градиентов |
| **Orbax** (Google) | Чекпоинтинг | Сохранение/восстановление pytree |
| **CLU** (Google) | Метрики + логирование | Утилиты для цикла обучения |

Optax — стандартная библиотека оптимизаторов. Она отделяет преобразование градиента (Adam, SGD, отсечение) от обновления параметров, что делает композицию тривиальной:

```python
optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adam(learning_rate=1e-3),
)
```

### Когда использовать JAX, а когда PyTorch

| Factor | JAX | PyTorch |
|--------|-----|---------|
| Поддержка TPU | Первоклассная (Google создал оба) | Поддерживается сообществом (torch_xla) |
| Поддержка GPU | Хорошая (CUDA через XLA) | Лучшая в своём классе (нативный CUDA) |
| Отладка | Сложная (трассировка + компиляция) | Простая (eager, построчно) |
| Экосистема | Ориентирована на исследования (Flax, Equinox) | Массивная (HuggingFace, torchvision и др.) |
| Найм | Нишевый (Google/DeepMind/Anthropic) | Массовый (повсеместно) |
| Крупномасштабное обучение | Превосходное (XLA, pmap, mesh) | Хорошее (FSDP, DeepSpeed) |
| Скорость прототипирования | Медленнее (функциональные накладные расходы) | Быстрее (мутируй и вперёд) |
| Продакшен-инференс | TensorFlow Serving, Vertex AI | TorchServe, Triton, ONNX |
| Кто использует | DeepMind (Gemini), Anthropic (Claude) | Meta (Llama), OpenAI (GPT), Stability AI |

Честный ответ: используйте PyTorch, если у вас нет конкретной причины использовать JAX. Эти причины таковы: доступ к TPU, потребность в градиентах по отдельным примерам, обучение на множестве устройств в массовом масштабе или работа в Google/DeepMind/Anthropic.

### Случайные числа в JAX

У JAX нет глобального состояния случайности. Каждая случайная операция требует явного PRNG-ключа:

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

Сначала это раздражает. Но это гарантирует воспроизводимость между устройствами и компиляциями — свойство, которое `torch.manual_seed` в PyTorch не может гарантировать в конфигурациях с несколькими GPU.

```figure
batchnorm-effect
```

## Создаём

### Шаг 1: Настройка и данные

Мы обучим 3-слойный MLP на MNIST, используя JAX и Optax. 784 входа, два скрытых слоя по 256 и 128 нейронов, 10 выходных классов.

```python
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
```

### Шаг 2: Инициализация параметров

Никакого класса. Просто функция, которая возвращает pytree:

```python
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
```

He-инициализация, сделанная вручную. Три PRNG-ключа, разделённых из одного seed. Каждый вес — неизменяемый массив во вложенном словаре.

### Шаг 3: Прямой проход

```python
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
```

Чистые функции. На входе params, на выходе предсказание. Никакого `self`, никакого хранимого состояния. `loss_fn` вычисляет кросс-энтропию с нуля — softmax, логарифм, отрицательное среднее.

### Шаг 4: Шаг обучения, скомпилированный через JIT

```python
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
```

`jax.value_and_grad` возвращает и значение потерь, и градиенты за один проход. Декоратор `@jax.jit` компилирует обе функции в XLA. После первого вызова каждый шаг обучения выполняется, не затрагивая Python.

### Шаг 5: Цикл обучения

```python
optimizer = optax.adam(learning_rate=1e-3)

X_train, y_train, X_test, y_test = get_mnist_data()
X_train, X_test = jnp.array(X_train), jnp.array(X_test)
y_train, y_test = jnp.array(y_train), jnp.array(y_test)

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
```

10 эпох. ~97% точности на тесте. Первая эпоха медленная (JIT-компиляция). Эпохи 2-10 быстрые.

Обратите внимание, чего здесь нет: никакого `.zero_grad()`, никакого `.backward()`, никакого `.step()`. Всё обновление — один составной вызов функции. Градиенты вычисляются, преобразуются Adam и применяются к параметрам — всё внутри `train_step`.

## Применяем

### Flax: стандарт Google

Flax — самая распространённая библиотека нейронных сетей для JAX. Она возвращает `nn.Module`, но с явным управлением состоянием:

```python
import flax.linen as nn

class MLP(nn.Module):
    @nn.compact
    def __call__(self, x):
        x = nn.Dense(256)(x)
        x = nn.relu(x)
        x = nn.Dense(128)(x)
        x = nn.relu(x)
        x = nn.Dense(10)(x)
        return x

model = MLP()
params = model.init(jax.random.PRNGKey(0), jnp.ones((1, 784)))
logits = model.apply(params, x_batch)
```

Та же структура, что в PyTorch, но `params` отделены от модели. `model.init()` создаёт params. `model.apply(params, x)` выполняет прямой проход. У объекта модели нет состояния.

### Equinox: питоничная альтернатива

Equinox (автор Patrick Kidger) представляет модели как pytree:

```python
import equinox as eqx

model = eqx.nn.MLP(
    in_size=784, out_size=10, width_size=256, depth=2,
    activation=jax.nn.relu, key=jax.random.PRNGKey(0)
)
logits = model(x)
```

Сама модель — это pytree. Никакой `.apply()` не нужен. Параметры — это просто листья модели. Это ближе к тому, как «мыслит» JAX.

### Optax: компонуемые оптимизаторы

Optax отделяет преобразование градиента от обновления:

```python
schedule = optax.warmup_cosine_decay_schedule(
    init_value=0.0, peak_value=1e-3,
    warmup_steps=1000, decay_steps=50000
)

optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adamw(learning_rate=schedule, weight_decay=0.01),
)
```

Отсечение градиентов, разогрев скорости обучения, затухание весов — всё компонуется как цепочка преобразований. Каждое преобразование видит градиенты, изменяет их и передаёт следующему. Никакого монолитного класса оптимизатора.

## Публикуем

**Установка:**

```bash
pip install jax jaxlib optax flax
```

Для поддержки GPU:

```bash
pip install jax[cuda12]
```

Для TPU (Google Cloud):

```bash
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
```

**Подводные камни производительности:**

- Первый вызов JIT медленный (компиляция). Прогрейтесь перед бенчмаркингом.
- Избегайте циклов Python по массивам JAX внутри JIT. Используйте `jax.lax.scan` или `jax.lax.fori_loop`.
- `jax.debug.print()` работает внутри JIT. Обычный `print()` — нет.
- Профилируйте с помощью `jax.profiler` или TensorBoard. Компиляция XLA может скрывать узкие места.
- JAX по умолчанию заранее выделяет 75% памяти GPU. Установите `XLA_PYTHON_CLIENT_PREALLOCATE=false`, чтобы отключить это.

**Чекпоинтинг:**

```python
import orbax.checkpoint as ocp
checkpointer = ocp.PyTreeCheckpointer()
checkpointer.save('/tmp/model', params)
restored = checkpointer.restore('/tmp/model')
```

**Этот урок создаёт:**
- `outputs/prompt-jax-optimizer.md` -- промпт для выбора правильной конфигурации оптимизатора JAX
- `outputs/skill-jax-patterns.md` -- навык, охватывающий функциональные паттерны в JAX

## Упражнения

1. Добавьте дропаут в MLP. В JAX дропаут требует PRNG-ключ — протяните ключ через прямой проход и разделяйте его для каждого слоя дропаута. Сравните точность на тесте с дропаутом и без него.

2. Используйте `jax.vmap`, чтобы вычислить градиенты по отдельным примерам для пакета из 32 изображений MNIST. Вычислите норму градиента для каждого примера. У каких примеров градиенты самые большие и почему?

3. Замените ручную функцию прямого прохода на универсальную `mlp_forward(params, x)`, работающую для любого числа слоёв. Используйте `jax.tree.leaves`, чтобы автоматически определять глубину.

4. Проведите бенчмарк шага обучения с `@jax.jit` и без него. Замерьте время 100 шагов для каждого варианта. Насколько велико ускорение на вашем оборудовании? Каковы накладные расходы на компиляцию при первом вызове?

5. Реализуйте отсечение градиентов, скомпоновав `optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))`. Обучите с отсечением и без него. Постройте график нормы градиента в процессе обучения, чтобы увидеть эффект.

## Ключевые термины

| Термин | Что говорят | Что это значит на самом деле |
|------|----------------|----------------------|
| XLA | «То, что делает JAX быстрым» | Accelerated Linear Algebra — компилятор, который объединяет операции и генерирует оптимизированные ядра для GPU/TPU из вычислительного графа |
| JIT | «Компиляция на лету (just-in-time)» | JAX трассирует функцию при первом вызове, компилирует в XLA, а затем при последующих вызовах выполняет скомпилированную версию |
| Pure function | «Без побочных эффектов» | Функция, выход которой зависит только от входов — никакого глобального состояния, никакой мутации, никакой случайности без явных ключей |
| vmap | «Автопакетирование» | Преобразует функцию, обрабатывающую один пример, в функцию, обрабатывающую пакет, без переписывания кода |
| pmap | «Автопараллелизм» | Реплицирует функцию на нескольких устройствах и разбивает входной пакет |
| Pytree | «Вложенный словарь массивов» | Любая вложенная структура из списков, кортежей, словарей и массивов, которую JAX может обходить и преобразовывать |
| Tracing | «Запись вычисления» | JAX выполняет функцию с абстрактными значениями, чтобы построить вычислительный граф, не вычисляя реальных результатов |
| Functional autodiff | «grad от функции» | Вычисление производных путём преобразования функций, а не прикреплением хранилища градиентов к тензорам |
| Optax | «Библиотека оптимизаторов JAX» | Компонуемая библиотека преобразований градиентов — Adam, SGD, отсечение, планирование — которые объединяются в цепочку |
| Flax | «nn.Module для JAX» | Библиотека нейронных сетей Google для JAX, добавляющая абстракции слоёв при сохранении явного состояния |

## Дополнительные материалы

- Документация JAX: https://jax.readthedocs.io/ -- официальная документация с отличными руководствами по grad, jit и vmap
- "JAX: composable transformations of Python+NumPy programs" (Bradbury et al., 2018) -- оригинальная статья, объясняющая философию дизайна
- Документация Flax: https://flax.readthedocs.io/ -- библиотека нейронных сетей Google для JAX
- Patrick Kidger, "Equinox: neural networks in JAX via callable PyTrees and filtered transformations" (2021) -- питоничная альтернатива Flax
- DeepMind, "Optax: composable gradient transformation and optimisation" -- стандартная библиотека оптимизаторов
- "You Don't Know JAX" (Colin Raffel, 2020) -- практическое руководство по подводным камням и паттернам JAX от одного из авторов T5
