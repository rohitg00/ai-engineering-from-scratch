# Распознавание и верификация говорящего

> ASR отвечает на вопрос «что было сказано?». Распознавание говорящего отвечает на вопрос «кто это сказал?». Математика выглядит одинаково — эмбеддинги плюс косинус, — но каждое продакшен-решение упирается в одно-единственное число: EER.

**Тип:** Build**Языки:** Python**Предварительные требования:** Фаза 6 · 02 (Spectrograms & Mel), Фаза 5 · 22 (Embedding Models)**Время:** ~45 минут
## Проблема

Пользователь произносит кодовую фразу. Вы хотите узнать: это тот человек, за которого он себя выдаёт (*верификация*, 1:1), или это первый подходящий человек из вашей базы зарегистрированных говорящих (*идентификация*, 1:N)? Или ни то, ни другое — это неизвестный говорящий (*открытое множество*, open-set)?

До 2018 года: GMM-UBM + i-vectors. Приемлемый EER, но хрупкость к смене канала (телефон против ноутбука) и к эмоциям. 2018–2022: x-vectors (backbone TDNN, обученный с угловым отступом). С 2022 года: эмбеддинги ECAPA-TDNN и WavLM-large. К 2026 году в этой области доминируют три модели и одна метрика.

Эта метрика — **EER**, Equal Error Rate (уровень равных ошибок). Установите порог принятия решения так, чтобы частота ложных принятий (False Accept Rate) равнялась частоте ложных отказов (False Reject Rate). Точка их пересечения и есть EER. Она фигурирует в каждой статье, каждом лидерборде, каждом решении о закупке.

## Концепция

![Конвейер регистрации и верификации: эмбеддинг + косинус + EER](../assets/speaker-verification.svg)

**Конвейер.** Регистрация: записывается 5–30 секунд речи целевого говорящего; вычисляется эмбеддинг фиксированной размерности (192-d для ECAPA-TDNN, 256-d для WavLM-large). Верификация: берётся эмбеддинг тестового высказывания; вычисляется косинусное сходство; результат сравнивается с порогом.

**ECAPA-TDNN (2020, всё ещё доминирует в 2026).** Emphasized Channel Attention, Propagation and Aggregation — Time-Delay Neural Network. Блоки 1D-свёрток со squeeze-excitation, пулинг с многоголовым вниманием, затем линейный слой до 192-d. Обучена на VoxCeleb 1+2 (2700 говорящих, 1,1 млн высказываний) с функцией потерь Additive Angular Margin (AAM-softmax).

**WavLM-SV (2022+).** Дообучение предобученного SSL-backbone WavLM-large с AAM-функцией потерь. Выше качество, но медленнее — 300+ МБ против 15 МБ.

**x-vector (базовый вариант).** TDNN + статистический пулинг. Классика; всё ещё полезна на CPU / edge-устройствах.

**AAM-softmax.** Стандартный softmax с добавленным отступом `m` в угловом пространстве: `cos(θ + m)` для правильного класса. Заставляет классы разделяться по углу. Типично `m=0.2`, масштаб `s=30`.

### Скоринг

- **Косинус** между эмбеддингами регистрации и теста. Решение принимается по порогу.
- **PLDA (Probabilistic LDA).** Проецирует эмбеддинги в латентное пространство, где для пары «тот же говорящий / разные говорящие» есть отношение правдоподобия в замкнутой форме. Добавляется поверх косинуса и даёт снижение EER на +10–20%. Стандарт до 2020 года; сейчас используется только в закрытых (closed-set) сценариях.
- **Нормализация оценок.** `S-norm` или `AS-norm`: нормализует каждую оценку относительно когорты средних и стандартных отклонений самозванцев. Необходима для кросс-доменного оценивания.

### Цифры, которые стоит знать (2026)

| Модель | VoxCeleb1-O EER | Параметры | Пропускная способность (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (классический) | 3,10% | 5 млн | 400× RT |
| ECAPA-TDNN | 0,87% | 15 млн | 200× RT |
| WavLM-SV large | 0,42% | 316 млн | 20× RT |
| Pyannote 3.1 сегментация + эмбеддинг | 0,65% | 6 млн | 100× RT |
| ReDimNet (2024) | 0,39% | 24 млн | 100× RT |

### Диаризация

«Кто когда говорил» в клипе с несколькими говорящими. Конвейер: VAD → сегментация → эмбеддинг каждого сегмента → кластеризация (агломеративная или спектральная) → сглаживание границ. Современный стек: `pyannote.audio` 3.1, который объединяет сегментацию говорящих + эмбеддинг + кластеризацию за один вызов. SOTA-DER 2026 года на AMI составляет ~15% (против 23% в 2022).

```figure
sp-eer-crossover
```

## Постройте это

### Шаг 1: игрушечный эмбеддинг из статистик MFCC

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

Далеко не SOTA — только для обучения. `code/main.py` использует это как proof-of-concept на синтетических данных говорящих.

### Шаг 2: косинусное сходство + порог

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### Шаг 3: EER по парам оценок сходства

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

Возвращает (eer, threshold_at_eer). Указывайте оба значения.

### Шаг 4: продакшен со SpeechBrain

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### Шаг 5: диаризация с pyannote

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## Применение

Стек 2026 года:

| Ситуация | Выбор |
|-----------|------|
| Закрытая (closed-set) верификация 1:1, edge-устройство | ECAPA-TDNN + косинусный порог |
| Открытая (open-set) верификация, облако | WavLM-SV + AS-norm |
| Диаризация (встречи, подкасты) | `pyannote/speaker-diarization-3.1` |
| Защита от подделки (replay / детекция дипфейков) | AASIST или RawNet2 |
| Крошечное встраиваемое решение (KWS + регистрация) | Titanet-Small (NeMo) |

## Ловушки

- **Несовпадение канала.** Модель, обученная на VoxCeleb (веб-видео), ≠ аудио телефонного звонка. Всегда оценивайте на целевом канале.
- **Короткие высказывания.** EER резко ухудшается при менее чем 3 секундах тестового аудио.
- **Регистрация с шумом.** Одна зашумлённая запись при регистрации отравляет якорь. Используйте ≥3 чистых образца и усредняйте.
- **Фиксированный порог для разных условий.** Всегда подбирайте порог на отложенном dev-наборе из целевого домена.
- **Косинус на ненормализованных эмбеддингах.** Сначала выполните L2-нормализацию; иначе доминирует величина вектора.

## Отправьте это в продакшен

Сохраните как `outputs/skill-speaker-verifier.md`. Выберите модель, протокол регистрации, план подбора порога и меры защиты от мошенничества.

## Упражнения

1. **Лёгкое.** Запустите `code/main.py`. Строит синтетических «говорящих» (с разными тональными профилями), регистрирует их, вычисляет EER на списке из 100 тестовых пар.
2. **Среднее.** Используйте SpeechBrain ECAPA на 30 высказываниях VoxCeleb1 (5 говорящих × по 6 каждый). Вычислите EER с косинусом и с PLDA.
3. **Сложное.** Постройте полный конвейер регистрация → диаризация → верификация с `pyannote.audio`. Оцените DER на dev-наборе AMI.

## Ключевые термины

| Термин | Что говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| EER | Заглавная метрика | Порог, при котором False Accept = False Reject. |
| Verification | 1:1 | «Это Алиса?» |
| Identification | 1:N | «Кто говорит?» |
| Open-set | Возможен неизвестный | Тестовый набор может содержать незарегистрированных говорящих. |
| Enrollment | Регистрация | Вычисление референсного эмбеддинга говорящего. |
| AAM-softmax | Функция потерь | Softmax с аддитивным угловым отступом; заставляет кластеры разделяться. |
| PLDA | Классический скоринг | Probabilistic LDA; скоринг по отношению правдоподобия поверх эмбеддингов. |
| DER | Метрика диаризации | Diarization Error Rate — пропуски + ложные срабатывания + путаница. |

## Дополнительное чтение

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) — классическая статья о глубоких эмбеддингах.
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) — доминирующая архитектура 2020–2026.
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) — SSL-backbone для SV и диаризации.
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) — продакшен-стек диаризации + эмбеддингов.
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) — актуальные позиции по EER среди моделей.
