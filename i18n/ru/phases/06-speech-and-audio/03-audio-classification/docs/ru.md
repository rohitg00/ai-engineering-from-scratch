# Классификация аудио — от k-NN на MFCC до AST и BEATs

> Всё — от «лай собаки против сирены» до «на каком это языке» — это классификация аудио. Признаки — это мел-спектры. Архитектура меняется каждое десятилетие. Метрики оценивания остаются прежними: AUC, F1 и полнота по классам (per-class recall).

**Тип:** Build**Языки:** Python**Предварительные требования:** Фаза 6 · 02 (Spectrograms & Mel), Фаза 3 · 06 (CNNs), Фаза 5 · 08 (CNNs & RNNs for Text)**Время:** ~75 минут
## Проблема

Вам попадается 10-секундный клип. Вы хотите узнать: «что это?» Городской звук (сирена, дрель, собака), голосовая команда (да/нет/стоп), определение языка (en/es/ar), эмоция говорящего (злость/нейтральность) или звук окружающей среды (внутри/снаружи, гул толпы). Всё это — *классификация аудио*, и в 2026 году базовая архитектура уже зрелая: log-mel → CNN или трансформер → softmax.

Основная сложность — не в сети. Она в данных. Аудио-наборы данных страдают от жёсткого дисбаланса классов, сильного дрейфа домена (чистый звук против шумного) и шума в метках (кто решил, что это «уличный гул», а не «шум ресторана»?). 80% проблемы — это курирование данных, аугментация и оценивание, а не замена CNN на трансформер.

## Концепция

![Лестница классификации аудио: от k-NN на MFCC до AST и BEATs](../assets/audio-classification.svg)

**k-NN на MFCC (базовый метод 1990-х).** Разверните MFCC каждого клипа в вектор, вычислите косинусное сходство с размеченным банком примеров, верните голос большинства среди top K. Неожиданно силён на чистых небольших наборах данных (Speech Commands, ESC-50). Работает без GPU.

**2D CNN на log-mel (2015-2019).** Рассматривайте log-mel `(T, n_mels)` как изображение. Примените ResNet-18 или архитектуру в духе VGG. Выполните глобальный усредняющий пулинг по оси времени. Softmax по классам. Всё ещё базовый вариант в большинстве соревнований kaggle 2026 года.

**Audio Spectrogram Transformer, AST (2021-2024).** Разбейте log-mel на патчи (например, 16×16), добавьте позиционные эмбеддинги, подайте в ViT. Современный уровень (SOTA) на AudioSet (mAP 0.485) для обучения с учителем.

**BEATs и WavLM-base (2024-2026).** Самообучаемое предварительное обучение на миллионах часов аудио. Дообучите модель под свою задачу, используя всего 1-10% размеченных данных, которые потребовались бы иначе. В 2026 году это отправная точка по умолчанию для неречевого аудио. BEATs-iter3 обходит AST на 1-2 mAP на AudioSet, используя при этом 1/4 вычислений.

**Энкодер Whisper как замороженный backbone (2024).** Возьмите энкодер Whisper, отбросьте декодер, прикрепите линейный классификатор. Показатели, близкие к SOTA, на определении языка и простой классификации событий без единой аугментации аудио. Базовый вариант из разряда «бесплатный сыр».

### Дисбаланс классов — главная сложность

ESC-50: 50 классов по 40 клипов — сбалансированный, простой набор. UrbanSound8K: 10 классов, дисбаланс 10:1. AudioSet: 632 класса с длинным хвостом 100 000:1. Методы, которые работают:

- Сбалансированное сэмплирование во время обучения (не при оценивании).
- Mixup: линейная интерполяция двух клипов (и их меток) в качестве аугментации.
- SpecAugment: маскирование случайных полос по времени и частоте. Просто; критически важно.

### Оценивание

- Многоклассовая взаимоисключающая классификация (Speech Commands): top-1 accuracy, top-5 accuracy.
- Многоклассовая мультиметочная классификация (AudioSet, в стиле UrbanSound): средняя точность (mean average precision, mAP).
- Сильный дисбаланс: полнота по классам (per-class recall) + macro F1.

Цифры 2026 года, которые стоит знать:

| Бенчмарк | Базовый уровень | SOTA 2026 | Источник |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## Создаём

### Шаг 1: извлечение признаков

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### Шаг 2: сводка фиксированной длины

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

Просто, но эффективно: среднее + дисперсия по времени дают фиксированный 26-мерный эмбеддинг для MFCC с 13 коэффициентами. Работает мгновенно. Ещё в 2017 году превосходило современные на тот момент нейросетевые базовые модели на ESC-50.

### Шаг 3: k-NN

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)

def knn_classify(q, bank, labels, k=5):
    sims = sorted(range(len(bank)), key=lambda i: -cosine(q, bank[i]))[:k]
    votes = Counter(labels[i] for i in sims)
    return votes.most_common(1)[0][0]
```

### Шаг 4: переход на CNN по log-mel

На PyTorch:

```python
import torch.nn as nn

class AudioCNN(nn.Module):
    def __init__(self, n_mels=80, n_classes=50):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Linear(128, n_classes)

    def forward(self, x):  # x: (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

3 млн параметров. Обучается за ~10 минут на ESC-50 на одной RTX 4090. Точность 80%+.

### Шаг 5: вариант по умолчанию в 2026 году — дообучение BEATs

```python
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
model = ASTForAudioClassification.from_pretrained(
    "MIT/ast-finetuned-audioset-10-10-0.4593",
    num_labels=50,
    ignore_mismatched_sizes=True,
)

inputs = ext(audio, sampling_rate=16000, return_tensors="pt")
logits = model(**inputs).logits
```

Для BEATs используйте `microsoft/BEATs-base` через библиотеку `beats`; API в transformers имеет ту же форму.

## Применяем

Стек 2026 года:

| Ситуация | С чего начать |
|-----------|-----------|
| Крошечный набор данных (<1000 клипов) | k-NN по средним MFCC (ваш базовый вариант) + аугментация аудио |
| Средний набор данных (1K–100K) | Дообучение BEATs или AST |
| Большой набор данных (>100K) | Обучение с нуля или дообучение энкодера Whisper |
| Реальное время, edge-устройства | CNN на 40 MFCC, квантованная до int8 (в стиле KWS) |
| Мультиметочная классификация (AudioSet) | BEATs-iter3 с функцией потерь BCE + mixup + SpecAugment |
| Определение языка | MMS-LID, базовый вариант SpeechBrain VoxLingua107 |

Правило принятия решения: **начинайте с замороженного backbone, а не с новой модели с нуля**. Дообучение головы BEATs даёт 95% от SOTA за часы, а не за недели.

## Публикуем

Сохраните как `outputs/skill-classifier-designer.md`. Выберите архитектуру, аугментации, стратегию балансировки классов и метрику оценивания для заданной задачи классификации аудио.

## Упражнения

1. **Лёгкое.** Запустите `code/main.py`. Он обучает базовый вариант k-NN на MFCC на синтетическом наборе данных из 4 классов (чистые тона разной высоты). Приведите матрицу ошибок.
2. **Среднее.** Замените `summarize` на [mean, var, skew, kurtosis]. Превосходит ли пулинг по 4 моментам вариант mean+var на том же синтетическом наборе данных?
3. **Сложное.** Используя `torchaudio`, обучите 2D CNN на ESC-50 fold 1. Приведите точность 5-fold кросс-валидации. Добавьте SpecAugment (time mask = 20, freq mask = 10) и приведите изменение (delta).

## Ключевые термины

| Термин | Как говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| AudioSet | ImageNet среди аудио | Набор данных Google из 2 млн клипов, 632 класса, слабо размеченный, с YouTube. |
| ESC-50 | Небольшой бенчмарк для классификации | 50 классов × 40 клипов звуков окружающей среды. |
| AST | Audio Spectrogram Transformer | ViT на патчах log-mel; SOTA 2021 года. |
| BEATs | Самообучаемое аудио | Модель Microsoft, iter3 лидирует на AudioSet по состоянию на 2026 год. |
| Mixup | Аугментация парами | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Аугментация на основе маскирования | Обнуление случайных полос по времени и частоте спектрограммы. |
| mAP | Основная метрика для мультиметочной классификации | Средняя точность (mean average precision) по классам и порогам. |

## Дополнительные материалы

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) — эталонная архитектура 2021–2024 годов.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) — вариант по умолчанию с 2024 года.
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) — доминирующая аугментация аудио.
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) — 50-классовый бенчмарк, который до сих пор актуален.
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) — таксономия YouTube из 632 классов; всё ещё золотой стандарт.
