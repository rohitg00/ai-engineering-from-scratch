# Генерация изображений — диффузионные модели

> Диффузионная модель учится удалять шум. Обучите её убирать небольшое количество шума из зашумлённого изображения, повторите это в обратном направлении тысячу раз — и вы получите генератор изображений.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 4, урок 07 (U-Net), Фаза 1, урок 06 (вероятность), Фаза 3, урок 06 (оптимизаторы)
**Время:** ~75 минут

## Цели обучения

- Вывести прямой процесс зашумления `x_0 -> x_1 -> ... -> x_T` и объяснить, почему аналитическое выражение `q(x_t | x_0)` в замкнутой форме верно для любого t
- Реализовать целевую функцию обучения в стиле DDPM, которая предсказывает шум, добавленный на каждом шаге, и сэмплер, который проходит обратный путь от чистого шума к изображению
- Построить U-Net с обусловливанием по времени (достаточно маленький, чтобы обучаться на CPU), который предсказывает шум для любого шага по времени
- Объяснить разницу между сэмплированием DDPM и DDIM и когда уместен каждый из них (урок 23 подробно рассматривает flow matching и rectified flow)

## Проблема

GAN генерируют за один проход: шум на входе, изображение на выходе, один прямой проход. Они быстрые, но их сложно обучать. Диффузионные модели генерируют итеративно: начинаем с чистого шума, убираем шум небольшими шагами, изображение проявляется. Они медленные, но их легко обучать. Последние пять лет доминирует именно это свойство: любая небольшая команда может обучить диффузионную модель и получить приемлемые сэмплы; обучение GAN — это ремесло, которому учишься годами неудачных запусков.

Помимо стабильности обучения, именно итеративная структура диффузии открывает всё, что делает современная генерация изображений: обусловливание по тексту, инпейнтинг, редактирование изображений, повышение разрешения (super-resolution), управляемый стиль. Каждый шаг цикла сэмплирования — это место, куда можно внедрить новое ограничение. Именно этот механизм — причина, почему Stable Diffusion, Imagen, DALL-E 3, Midjourney и любая управляемая модель изображений, которую вы будете использовать, основаны на диффузии.

Этот урок строит минимальную DDPM: прямое зашумление, обратное удаление шума, цикл обучения. Следующий урок (Stable Diffusion) встраивает это в производственную систему с VAE, текстовым энкодером и направлением без классификатора (classifier-free guidance).

## Концепция

### Прямой процесс

Возьмите изображение `x_0`. Добавьте небольшое количество гауссовского шума, чтобы получить `x_1`. Добавьте ещё немного, чтобы получить `x_2`. Продолжайте так T шагов, пока `x_T` не станет почти неотличим от чистого гауссовского шума.

```
q(x_t | x_{t-1}) = N(x_t; sqrt(1 - beta_t) * x_{t-1},  beta_t * I)
```

`beta_t` — это небольшое расписание дисперсии, обычно линейное от 0.0001 до 0.02 на протяжении T=1000 шагов. Каждый шаг немного уменьшает сигнал и добавляет свежий шум.

### Скачок в замкнутой форме

Добавление шума по одному шагу за раз — это марковская цепь, но математика сворачивается: можно сэмплировать `x_t` напрямую из `x_0` за один шаг.

```
Define alpha_t = 1 - beta_t
Define alpha_bar_t = prod_{s=1..t} alpha_s

Then:
  q(x_t | x_0) = N(x_t; sqrt(alpha_bar_t) * x_0,  (1 - alpha_bar_t) * I)

Equivalently:
  x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon
  where epsilon ~ N(0, I)
```

Это единственное уравнение — вся причина, почему диффузия практична. Во время обучения вы выбираете случайный `t`, сэмплируете `x_t` напрямую из `x_0` и обучаетесь за один шаг — не нужно симулировать всю марковскую цепь.

### Обратный процесс

Прямой процесс фиксирован. Обратный процесс `p(x_{t-1} | x_t)` — это то, чему учится нейронная сеть. Диффузионные модели не предсказывают `x_{t-1}` напрямую; они предсказывают шум `epsilon`, добавленный на шаге t, а математика выводит `x_{t-1}` из этого предсказания.

```mermaid
flowchart LR
    X0["x_0<br/>(clean image)"] --> Q1["q(x_t|x_0)<br/>add noise"]
    Q1 --> XT["x_t<br/>(noisy)"]
    XT --> MODEL["model(x_t, t)"]
    MODEL --> EPS["predicted epsilon"]
    EPS --> LOSS["MSE against<br/>true epsilon"]

    XT -.->|sampling| STEP["p(x_{t-1}|x_t)"]
    STEP -.-> XT1["x_{t-1}"]
    XT1 -.->|repeat 1000x| X0S["x_0 (sampled)"]

    style X0 fill:#dcfce7,stroke:#16a34a
    style MODEL fill:#fef3c7,stroke:#d97706
    style LOSS fill:#fecaca,stroke:#dc2626
    style X0S fill:#dbeafe,stroke:#2563eb
```

### Функция потерь при обучении

Для каждого шага обучения:

1. Сэмплируйте реальное изображение `x_0`.
2. Сэмплируйте шаг по времени `t` равномерно из [1, T].
3. Сэмплируйте шум `epsilon ~ N(0, I)`.
4. Вычислите `x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon`.
5. Предскажите `epsilon_theta(x_t, t)` с помощью сети.
6. Минимизируйте `|| epsilon - epsilon_theta(x_t, t) ||^2`.

Вот и всё. Нейронная сеть учится предсказывать шум на любом шаге по времени. Функция потерь — MSE. Здесь нет состязательной игры, нет коллапса, нет колебаний.

### Сэмплер (DDPM)

Чтобы сгенерировать изображение: начните с `x_T ~ N(0, I)` и идите назад по одному шагу за раз.

```
for t = T, T-1, ..., 1:
    eps = model(x_t, t)
    x_{t-1} = (1 / sqrt(alpha_t)) * (x_t - (beta_t / sqrt(1 - alpha_bar_t)) * eps) + sqrt(beta_t) * z
    where z ~ N(0, I) if t > 1, else 0
return x_0
```

Ключевой момент в том, что хотя обратное условное распределение в общем случае неизвестно в замкнутой форме, для этого конкретного гауссовского прямого процесса оно известно. Некрасивые на вид коэффициенты — это то, что даёт правило Байеса.

### Почему 1000 шагов

Расписание прямого зашумления подбирается так, чтобы каждый шаг добавлял ровно столько шума, чтобы обратный шаг был почти гауссовским. Если шагов слишком мало, обратный шаг далёк от гауссовского, и сеть не может хорошо его смоделировать. Если шагов слишком много, сэмплирование становится дорогим при убывающей отдаче. T=1000 с линейным расписанием — это значение по умолчанию для DDPM.

### DDIM: сэмплирование в 20 раз быстрее

Обучение остаётся тем же. Меняется сэмплирование. DDIM (Song et al., 2020) определяет детерминированный обратный процесс, который пропускает шаги по времени без переобучения. Сэмплирование за 50 шагов с DDIM даёт качество, близкое к 1000-шаговому DDPM. Любая производственная система использует DDIM или ещё более быстрый вариант (DPM-Solver, Euler ancestral).

### Обусловливание по времени

Сети `epsilon_theta(x_t, t)` нужно знать, на каком шаге по времени она убирает шум. Современные диффузионные модели внедряют `t` через синусоидальные эмбеддинги времени (та же идея, что и позиционное кодирование в трансформерах), которые добавляются к картам признаков на каждом уровне U-Net.

```
t_embedding = sinusoidal(t)
feature_map += MLP(t_embedding)
```

Без обусловливания по времени сети приходится угадывать уровень шума по самому изображению, что работает, но значительно менее эффективно с точки зрения количества необходимых примеров.

```figure
cv-diffusion-image
```

## Создаём

### Шаг 1: расписание шума

```python
import torch

def linear_beta_schedule(T=1000, beta_start=1e-4, beta_end=2e-2):
    return torch.linspace(beta_start, beta_end, T)


def precompute_schedule(betas):
    alphas = 1.0 - betas
    alphas_cumprod = torch.cumprod(alphas, dim=0)
    return {
        "betas": betas,
        "alphas": alphas,
        "alphas_cumprod": alphas_cumprod,
        "sqrt_alphas_cumprod": torch.sqrt(alphas_cumprod),
        "sqrt_one_minus_alphas_cumprod": torch.sqrt(1.0 - alphas_cumprod),
        "sqrt_recip_alphas": torch.sqrt(1.0 / alphas),
    }

schedule = precompute_schedule(linear_beta_schedule(T=1000))
```

Вычислите один раз, извлекайте по индексу во время обучения и сэмплирования.

### Шаг 2: прямая диффузия (q_sample)

```python
def q_sample(x0, t, noise, schedule):
    sqrt_a = schedule["sqrt_alphas_cumprod"][t].view(-1, 1, 1, 1)
    sqrt_one_minus_a = schedule["sqrt_one_minus_alphas_cumprod"][t].view(-1, 1, 1, 1)
    return sqrt_a * x0 + sqrt_one_minus_a * noise
```

Однострочная замкнутая форма. `t` — это пакет шагов по времени, по одному на изображение в пакете.

### Шаг 3: маленький U-Net с обусловливанием по времени

```python
import torch.nn as nn
import torch.nn.functional as F
import math

def timestep_embedding(t, dim=64):
    half = dim // 2
    freqs = torch.exp(-math.log(10000) * torch.arange(half, device=t.device) / half)
    args = t[:, None].float() * freqs[None]
    emb = torch.cat([args.sin(), args.cos()], dim=-1)
    return emb


class TinyUNet(nn.Module):
    def __init__(self, img_channels=3, base=32, t_dim=64):
        super().__init__()
        self.t_mlp = nn.Sequential(
            nn.Linear(t_dim, base * 4),
            nn.SiLU(),
            nn.Linear(base * 4, base * 4),
        )
        self.t_dim = t_dim
        self.enc1 = nn.Conv2d(img_channels, base, 3, padding=1)
        self.enc2 = nn.Conv2d(base, base * 2, 4, stride=2, padding=1)
        self.mid = nn.Conv2d(base * 2, base * 2, 3, padding=1)
        self.dec1 = nn.ConvTranspose2d(base * 2, base, 4, stride=2, padding=1)
        self.dec2 = nn.Conv2d(base * 2, img_channels, 3, padding=1)
        self.time_proj = nn.Linear(base * 4, base * 2)

    def forward(self, x, t):
        t_emb = timestep_embedding(t, self.t_dim)
        t_emb = self.t_mlp(t_emb)
        t_proj = self.time_proj(t_emb)[:, :, None, None]

        h1 = F.silu(self.enc1(x))
        h2 = F.silu(self.enc2(h1)) + t_proj
        h3 = F.silu(self.mid(h2))
        d1 = F.silu(self.dec1(h3))
        d2 = torch.cat([d1, h1], dim=1)
        return self.dec2(d2)
```

Двухуровневый U-Net с обусловливанием по времени, внедрённым в бутылочном горлышке. Увеличьте глубину и ширину для работы с реальными изображениями.

### Шаг 4: цикл обучения

```python
def train_step(model, x0, schedule, optimizer, device, T=1000):
    model.train()
    x0 = x0.to(device)
    bs = x0.size(0)
    t = torch.randint(0, T, (bs,), device=device)
    noise = torch.randn_like(x0)
    x_t = q_sample(x0, t, noise, schedule)
    pred = model(x_t, t)
    loss = F.mse_loss(pred, noise)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()
```

Это весь цикл обучения целиком. Никакой игры GAN, никакой специализированной функции потерь, один вызов MSE.

### Шаг 5: сэмплер (DDPM)

```python
@torch.no_grad()
def sample(model, schedule, shape, T=1000, device="cpu"):
    model.eval()
    x = torch.randn(shape, device=device)
    betas = schedule["betas"].to(device)
    sqrt_one_minus_a = schedule["sqrt_one_minus_alphas_cumprod"].to(device)
    sqrt_recip_alphas = schedule["sqrt_recip_alphas"].to(device)

    for t in reversed(range(T)):
        t_batch = torch.full((shape[0],), t, dtype=torch.long, device=device)
        eps = model(x, t_batch)
        coef = betas[t] / sqrt_one_minus_a[t]
        mean = sqrt_recip_alphas[t] * (x - coef * eps)
        if t > 0:
            x = mean + torch.sqrt(betas[t]) * torch.randn_like(x)
        else:
            x = mean
    return x
```

1000 прямых проходов, чтобы получить один пакет сэмплов. В реальном коде вы бы заменили это на 50-шаговый сэмплер DDIM.

### Шаг 6: сэмплер DDIM (детерминированный, ~в 20 раз быстрее)

```python
@torch.no_grad()
def sample_ddim(model, schedule, shape, steps=50, T=1000, device="cpu", eta=0.0):
    model.eval()
    x = torch.randn(shape, device=device)
    alphas_cumprod = schedule["alphas_cumprod"].to(device)

    ts = torch.linspace(T - 1, 0, steps + 1).long()
    for i in range(steps):
        t = ts[i]
        t_prev = ts[i + 1]
        t_batch = torch.full((shape[0],), t, dtype=torch.long, device=device)
        eps = model(x, t_batch)
        a_t = alphas_cumprod[t]
        a_prev = alphas_cumprod[t_prev] if t_prev >= 0 else torch.tensor(1.0, device=device)
        x0_pred = (x - torch.sqrt(1 - a_t) * eps) / torch.sqrt(a_t)
        sigma = eta * torch.sqrt((1 - a_prev) / (1 - a_t) * (1 - a_t / a_prev))
        dir_xt = torch.sqrt(1 - a_prev - sigma ** 2) * eps
        noise = sigma * torch.randn_like(x) if eta > 0 else 0
        x = torch.sqrt(a_prev) * x0_pred + dir_xt + noise
    return x
```

`eta=0` полностью детерминирован (один и тот же входной шум всегда даёт один и тот же результат). `eta=1` восстанавливает DDPM.

## Применяем

Для производственной работы используйте `diffusers`:

```python
from diffusers import DDPMScheduler, UNet2DModel

unet = UNet2DModel(sample_size=32, in_channels=3, out_channels=3, layers_per_block=2)
scheduler = DDPMScheduler(num_train_timesteps=1000)
```

Библиотека поставляется с готовыми планировщиками (DDPM, DDIM, DPM-Solver, Euler, Heun), настраиваемыми U-Net, конвейерами для text-to-image и image-to-image, а также вспомогательными средствами для дообучения LoRA.

Для исследований `k-diffusion` (Katherine Crowson) содержит наиболее точные эталонные реализации и лучшие варианты сэмплирования.

## Публикуем

Этот урок производит:

- `outputs/prompt-diffusion-sampler-picker.md` — промпт, который выбирает DDPM / DDIM / DPM-Solver / Euler в зависимости от целевого качества, бюджета задержки и типа обусловливания.
- `outputs/skill-noise-schedule-designer.md` — навык, который создаёт линейное, косинусное или сигмоидное расписание beta по заданным T и целевому уровню искажения, а также диагностические графики отношения сигнал/шум во времени.

## Упражнения

1. **(Легко)** Визуализируйте прямой процесс: возьмите одно изображение и постройте график `x_t` при `t in [0, 100, 250, 500, 750, 1000]`. Убедитесь, что `x_1000` выглядит как чистый гауссовский шум.
2. **(Средне)** Обучите TinyUNet на наборе данных synthetic-circles в течение 20 эпох и сэмплируйте 16 кругов. Сравните сэмплирование DDPM (1000 шагов) и DDIM (50 шагов) — дают ли они похожие изображения из одного и того же начального шума (seed)?
3. **(Сложно)** Реализуйте косинусное расписание шума (Nichol & Dhariwal, 2021): `alpha_bar_t = cos^2((t/T + s) / (1 + s) * pi / 2)`. Обучите ту же модель с линейным и косинусным расписаниями и покажите, что косинусное расписание даёт лучшие сэмплы при малом числе шагов.

## Ключевые термины

| Термин | Как говорят люди | Что это на самом деле означает |
|------|----------------|----------------------|
| Прямой процесс | «Добавляем шум со временем» | Фиксированная марковская цепь, которая превращает изображение в гауссовский шум за T шагов |
| Обратный процесс | «Убираем шум шаг за шагом» | Обученное распределение, которое идёт от шума обратно к изображению |
| Предсказание epsilon | «Предсказываем шум» | Цель обучения: `epsilon_theta(x_t, t)` предсказывает шум, добавленный на шаге t |
| Расписание beta | «Величины шума» | Последовательность из T небольших дисперсий, определяющая, сколько шума добавляется на каждом шаге |
| alpha_bar_t | «Накопленный коэффициент сохранения» | Произведение (1 - beta_s) до момента t; чем больше t, тем меньше сигнала остаётся |
| Сэмплер DDPM | «Анцестральный, стохастический» | Сэмплирует каждый x_{t-1} из его условного гауссовского распределения; 1000 шагов |
| Сэмплер DDIM | «Детерминированный, быстрый» | Переписывает сэмплирование как детерминированное ОДУ; 20-100 шагов с сопоставимым качеством |
| Обусловливание по времени | «Сообщаем модели, какой t» | Синусоидальный эмбеддинг t, внедрённый в U-Net, чтобы она знала уровень шума |

## Дополнительные материалы

- [Denoising Diffusion Probabilistic Models (Ho et al., 2020)](https://arxiv.org/abs/2006.11239) — статья, которая сделала диффузию практичной и превзошла GAN по FID
- [Improved DDPM (Nichol & Dhariwal, 2021)](https://arxiv.org/abs/2102.09672) — косинусное расписание и v-параметризация
- [DDIM (Song, Meng, Ermon, 2020)](https://arxiv.org/abs/2010.02502) — детерминированный сэмплер, который сделал возможным инференс в реальном времени
- [Elucidating the Design Space of Diffusion (Karras et al., 2022)](https://arxiv.org/abs/2206.00364) — единый взгляд на все проектные решения диффузии; лучший актуальный источник
