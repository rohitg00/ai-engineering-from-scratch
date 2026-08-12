# CNN и RNN для текста

> Свёртки выучивают n-граммы. Рекуррентности запоминают. Оба подхода превзойдены вниманием (attention). Оба всё ещё важны на ограниченном железе.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 3 · 11 (введение в PyTorch), Фаза 5 · 03 (эмбеддинги слов), Фаза 4 · 02 (свёртки с нуля)
**Время:** ~75 минут

## Проблема

TF-IDF и Word2Vec порождали плоские векторы, игнорирующие порядок слов. Классификатор, построенный на них, не мог отличить `dog bites man` от `man bites dog`. Порядок слов иногда несёт сигнал.

Два семейства архитектур закрыли этот пробел до появления трансформеров.

**Свёрточные сети для текста (TextCNN).** Применяются 1D-свёртки к последовательностям эмбеддингов слов. Фильтр шириной 3 — это обучаемый детектор триграмм: он охватывает три слова и выдаёт оценку. Стек фильтров разной ширины (2, 3, 4, 5) обнаруживает паттерны разного масштаба. Max-pooling сводит всё к представлению фиксированного размера. Плоско, параллельно, быстро.

**Рекуррентные сети (RNN, LSTM, GRU).** Обрабатывают токены по одному, поддерживая скрытое состояние, которое переносит информацию вперёд. Последовательно, с памятью, гибко по длине входа. Доминировали в моделировании последовательностей с 2014 по 2017 год, затем появилось внимание (attention).

Этот урок строит оба подхода, а затем называет ту неудачу, которая мотивировала появление внимания.

## Концепция

**TextCNN** (Ким, 2014). Токены эмбеддятся. 1D-свёртка шириной `k` скользит фильтром по последовательным `k`-граммам эмбеддингов, порождая карту признаков. Глобальный max-pooling по этой карте выбирает наиболее сильную активацию. Max-pooled выходы нескольких ширин фильтра конкатенируются. Подаются на голову классификатора.

Почему это работает. Фильтр — это обучаемая n-грамма. Max-pooling инвариантен к позиции, поэтому «not good» активирует один и тот же признак в начале или середине отзыва. Три ширины фильтра по 100 фильтров каждая дают 300 обученных детекторов n-грамм. Обучение параллельно; нет последовательной зависимости.

**RNN.** На каждом временном шаге `t` скрытое состояние `h_t = f(W * x_t + U * h_{t-1} + b)`. `W`, `U`, `b` разделяются по времени. Скрытое состояние в момент `T` — это сводка всего префикса. Для классификации пулинг применяется по `h_1 ... h_T` (max, mean или last).

Обычные RNN страдают от затухающих градиентов. **LSTM** добавляет гейты, решающие, что забыть, что сохранить и что вывести, стабилизируя градиенты на длинных последовательностях. **GRU** упрощает LSTM до двух гейтов; работает похоже, но с меньшим числом параметров.

**Двунаправленные RNN** запускают одну RNN вперёд, а другую назад, конкатенируя скрытые состояния. Представление каждого токена видит и левый, и правый контекст. Необходимо для задач разметки.

```figure
rnn-unroll
```

## Создаём

### Шаг 1: TextCNN в PyTorch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class TextCNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, n_classes, filter_widths=(2, 3, 4), n_filters=64, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.convs = nn.ModuleList([
            nn.Conv1d(embed_dim, n_filters, kernel_size=k)
            for k in filter_widths
        ])
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids).transpose(1, 2)
        pooled = []
        for conv in self.convs:
            c = F.relu(conv(x))
            p = F.max_pool1d(c, c.size(2)).squeeze(2)
            pooled.append(p)
        h = torch.cat(pooled, dim=1)
        return self.fc(self.dropout(h))
```

`transpose(1, 2)` преобразует `[batch, seq_len, embed_dim]` в `[batch, embed_dim, seq_len]`, потому что `nn.Conv1d` трактует среднюю ось как каналы. Pooled-выход имеет фиксированный размер независимо от длины входа.

### Шаг 2: классификатор на LSTM

```python
class LSTMClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_classes, bidirectional=True, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=bidirectional)
        factor = 2 if bidirectional else 1
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_dim * factor, n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids)
        out, _ = self.lstm(x)
        pooled = out.max(dim=1).values
        return self.fc(self.dropout(pooled))
```

Max-pool по последовательности, а не пулинг по последнему состоянию. Для классификации max-pooling обычно превосходит взятие последнего скрытого состояния, потому что информация в конце длинной последовательности склонна доминировать в последнем состоянии.

### Шаг 3: демонстрация затухающего градиента (интуиция)

Обычная RNN без гейтинга не может выучить дальние зависимости. Рассмотрим игрушечную задачу: предсказать, встречался ли токен `A` где-либо в последовательности. Если `A` находится в позиции 1, а последовательность длиной 100 токенов, градиент от функции потерь должен пройти назад через 99 умножений рекуррентного веса. Если вес меньше 1, градиент затухает. Если больше 1 — взрывается.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTM исправляют это с помощью **состояния ячейки (cell state)**, которое проходит через сеть только с аддитивными взаимодействиями (гейт забывания масштабирует его мультипликативно, но градиенты всё равно текут по этой «магистрали»). GRU делает нечто похожее с меньшим числом параметров. Оба дают стабильное обучение на последовательностях длиной 100+ шагов.

### Шаг 4: почему этого всё равно было недостаточно

Три проблемы сохранялись даже с LSTM.

1. **Последовательное узкое место.** Обучение RNN на последовательности длиной 1000 требует 1000 последовательных шагов прямого/обратного прохода. Нельзя распараллелить по времени.
2. **Вектор контекста фиксированного размера в схемах энкодер-декодер.** Декодер видит только финальное скрытое состояние энкодера, сжатое по всему входу. Длинные входы теряют детали. Урок 09 разбирает это напрямую.
3. **Потолок точности на дальних зависимостях.** LSTM превосходят обычные RNN, но всё равно с трудом переносят конкретную информацию через 200+ шагов.

Внимание (attention) решило все три проблемы. Трансформеры полностью отказались от рекуррентности. Урок 10 — это поворотная точка.

## Применяем

`nn.LSTM`, `nn.GRU` и `nn.Conv1d` из PyTorch готовы для продакшена. Код обучения стандартный.

Hugging Face поставляет предобученные эмбеддинги, которые можно подключить как входной слой:

```python
from transformers import AutoModel

encoder = AutoModel.from_pretrained("bert-base-uncased")
for param in encoder.parameters():
    param.requires_grad = False


class BertCNN(nn.Module):
    def __init__(self, n_classes, filter_widths=(2, 3, 4), n_filters=64):
        super().__init__()
        self.encoder = encoder
        self.convs = nn.ModuleList([nn.Conv1d(768, n_filters, kernel_size=k) for k in filter_widths])
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, input_ids, attention_mask):
        with torch.no_grad():
            out = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        x = out.transpose(1, 2)
        pooled = [F.max_pool1d(F.relu(conv(x)), kernel_size=conv(x).size(2)).squeeze(2) for conv in self.convs]
        return self.fc(torch.cat(pooled, dim=1))
```

Чек-лист «используйте, когда это подходит под ограничения».

- **Инференс на edge-устройствах / on-device.** TextCNN с эмбеддингами GloVe в 10-100 раз меньше трансформера. Если ваша цель развёртывания — телефон, это тот самый стек.
- **Потоковая / онлайн-классификация.** RNN обрабатывает по одному токену за раз; трансформерам нужна вся последовательность целиком. Для текста, поступающего в реальном времени, LSTM всё ещё побеждают.
- **Крошечные модели для базовых вариантов.** Быстрая итерация на новой задаче. Обучите TextCNN за 5 минут на CPU.
- **Разметка последовательностей при ограниченных данных.** BiLSTM-CRF (урок 06) всё ещё продакшен-архитектура для NER на 1-10 тыс. размеченных предложений.

Всё остальное отправляется к трансформеру.

## Публикуем

Сохраните как `outputs/prompt-text-encoder-picker.md`:

```markdown
---
name: text-encoder-picker
description: Pick a text encoder architecture for a given constraint set.
phase: 5
lesson: 08
---

Given constraints (task, data volume, latency budget, deploy target, compute budget), output:

1. Encoder architecture: TextCNN, BiLSTM, BiLSTM-CRF, transformer fine-tune, or "use a pretrained transformer as a frozen encoder + small head".
2. Embedding input: random init, GloVe / fastText frozen, or contextualized transformer embeddings.
3. Training recipe in 5 lines: optimizer, learning rate, batch size, epochs, regularization.
4. One monitoring signal. For RNN/CNN models: attention mechanism absence means they miss long-range deps; check per-length accuracy. For transformers: fine-tuning collapse if LR too high; check train loss.

Refuse to recommend fine-tuning a transformer when data is under ~500 labeled examples without showing that a TextCNN / BiLSTM baseline has plateaued. Flag edge deployment as needing architecture-before-everything.
```

## Упражнения

1. **Лёгкое.** Обучите TextCNN на игрушечном наборе данных с 3 классами (данные придумайте сами). Проверьте, что ширины фильтра (2, 3, 4) превосходят одну ширину (3) по среднему F1.
2. **Среднее.** Реализуйте max-pool, mean-pool и пулинг по последнему состоянию для классификатора на LSTM. Сравните на небольшом наборе данных; задокументируйте, какой пулинг побеждает, и выдвиньте гипотезу почему.
3. **Сложное.** Постройте BiLSTM-CRF тегер NER (объедините урок 06 и этот урок). Обучите на CoNLL-2003. Сравните с базовым вариантом только на CRF из урока 06 и с дообученным BERT. Сообщите время обучения, память и F1.

## Ключевые термины

| Термин | Как говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| TextCNN | CNN для текста | Стек 1D-свёрток по эмбеддингам слов с глобальным max-pool. Ким (2014). |
| RNN | Рекуррентная сеть | Скрытое состояние обновляется на каждом временном шаге: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | RNN с гейтингом | Добавляет гейты входа / забывания / выхода + состояние ячейки. Обучается стабильно на длинных последовательностях. |
| GRU | Более простой LSTM | Два гейта вместо трёх. Похожая точность, меньше параметров. |
| Двунаправленный (bidirectional) | Оба направления | Конкатенация прямой и обратной RNN. Каждый токен видит обе стороны своего контекста. |
| Затухающий градиент | Обучающий сигнал угасает | Повторное умножение на веса <1 в обычных RNN делает градиенты ранних шагов практически нулевыми. |

## Дополнительные материалы

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) — статья про TextCNN. Восемь страниц. Читается легко.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — статья про LSTM. Неожиданно ясная.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) — диаграммы, которые сделали LSTM понятными для всех.
