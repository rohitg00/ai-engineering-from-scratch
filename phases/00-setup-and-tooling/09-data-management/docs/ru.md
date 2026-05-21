# Урок 9 — Управление данными (Data Management)

> Параллельный конспект к `en.md`. По ходу урока обновляется ответами на
> углубляющие вопросы и пометками про CRM-аналогии.

## Зачем этот урок

Любой AI/ML-проект начинается с данных. До модели нужно уметь:

1. **Найти и загрузить** датасет (Hugging Face Hub — стандарт де-факто).
2. **Понимать форматы** хранения (CSV / JSON / Parquet / Arrow) и зачем их
   столько вообще.
3. **Бить выборку на сплиты** (train / val / test) с фиксированным seed —
   чтобы эксперимент был воспроизводим.
4. **Не пихать тяжёлые файлы в git** (модели, выгрузки) — .gitignore / Git LFS / DVC.

Этот урок — про **инфраструктуру данных**, без неё дальнейшие фазы (классический
ML, NLP, LLM) будут опираться на ручную возню «скачал-распаковал-забыл-какой-seed-был».

## CRM-аналогия (для якоря)

| AI/ML | CRM/маркетинг |
|---|---|
| Датасет | Выгрузка из CRM (контакты, события, заказы) |
| Hugging Face Hub | Что-то типа "маркетплейса выгрузок" (только публичных) |
| `load_dataset(..., streaming=True)` | Не выгружать всю базу разом, а тащить пачками по 10к |
| CSV → Parquet | Экспорт из Excel-выгрузки в колоночный формат для BI/ClickHouse |
| Train / Val / Test split | Контрольная и тестовая группа в A/B-тесте, holdout-когорта |
| `seed=42` | Зафиксированный список ID-контактов, который любой коллега может воспроизвести |
| Git LFS / DVC | Версионирование "среза базы на 12 марта 2025" — чтобы потом доказать на каком именно срезе крутили модель |

## План конспекта

Заполняется по мере прохождения. Заголовки добавляю одновременно с тем, как
прохожу соответствующий блок теории.

- [x] Блок 1. Hugging Face datasets — что грузим и куда оно кэшируется
- [ ] Блок 2. Форматы файлов: CSV / JSON / Parquet / Arrow
- [ ] Блок 3. Streaming vs полное скачивание
- [ ] Блок 4. Train/Val/Test split и seed
- [ ] Блок 5. Большие файлы и git (.gitignore / LFS / DVC)
- [ ] Финал — разбор `code/data_utils.py` как референса

## Блок 1. Библиотека `datasets`

### Что это
Hugging Face'овский клиент к их Hub. Под капотом — **Apache Arrow**: данные
лежат на диске в колоночном бинарном формате и **мапятся в память** (memory
mapping), а не копируются в RAM. Отсюда два плюса: гигабайтный датасет «открывается»
мгновенно и потребляет мало памяти.

Главная ценность — единый интерфейс. Откуда бы данные ни приехали (Hub, локальный
CSV, pandas, генератор), наружу торчит одна и та же `Dataset`-абстракция.

### Главные сущности

| Класс | Это что | Когда возникает |
|---|---|---|
| `Dataset` | Одна таблица (один сплит). `len`, индексация, срезы. | `load_dataset(..., split=...)` или вручную |
| `DatasetDict` | Словарь сплитов: `{"train": Dataset, "test": Dataset}` | `load_dataset(...)` без `split=` |
| `IterableDataset` | Тот же датасет, но только итерируется. Нет `len`, нет `[i]`. | `streaming=True` |
| `Features` | Схема таблицы: `{колонка: тип}` с богатыми типами (`ClassLabel`, `Image`, `Audio`, `Sequence`). | `ds.features` у любого Dataset |

CRM-параллель: `Dataset` ≈ файл-выгрузка, `DatasetDict` ≈ папка из трёх
выгрузок (train/val/test), `IterableDataset` ≈ курсор по SQL-запросу /
поток событий Kafka, `Features` ≈ схема таблицы в БД.

### Типичные операции

Загрузка:
```python
load_dataset("repo")                            # DatasetDict
load_dataset("repo", split="train")             # Dataset
load_dataset("repo", "config_name", split="train")
load_dataset("repo", split="train", streaming=True)  # IterableDataset
```

Инспекция (это будешь делать постоянно):
```python
ds.column_names
ds.features
len(ds)
ds[0]        # одна строка как dict
ds[:5]       # ВНИМАНИЕ: dict со СПИСКАМИ, не список dict'ов
```

Преобразования (ленивые, с кэшем результата):
```python
ds.map(fn)                       # +колонки, преобразование
ds.filter(fn)
ds.shuffle(seed=42)
ds.select(range(100))
ds.train_test_split(test_size=0.2, seed=42)
ds.sort(col); ds.rename_column(a, b); ds.remove_columns([...]); ds.cast_column(...)
```

Экспорт:
```python
ds.to_pandas() / .to_csv / .to_json / .to_parquet / .to_list()
```

Импорт извне:
```python
Dataset.from_pandas(df) / .from_dict(d) / .from_csv(path) / .from_parquet(path) / .from_generator(gen)
```

### Streaming-режим

`IterableDataset` устроен принципиально иначе:
- нет `len`, нет индексации;
- только `for row in ds`, `ds.take(n)`, `ds.skip(n)`;
- `map`/`filter`/`shuffle(buffer_size=...)` ленивые, применяются на лету;
- `shuffle` — буферный (как в TF Dataset), не полный.

Используется, когда данных слишком много, чтобы хранить локально (Common Crawl, C4).

### Кэш

Всё кэшируется в `~/.cache/huggingface/datasets/`:
- сами таблицы в `*.arrow`-файлах;
- метаданные (`dataset_info.json`, `state.json`);
- результаты `map(...)` тоже кэшируются по fingerprint функции и входа.

Поэтому второй запуск той же ячейки — мгновенный. Force-перекачка:
`load_dataset(..., download_mode="force_redownload")`.

### Грабли, которые легко словить

1. **`ds[:5]` — это dict со списками, не список словарей.** Arrow колоночный.
   Если нужен список строк — `[ds[i] for i in range(5)]` или
   `ds.select(range(5)).to_list()`.
2. **`load_dataset` без `split=` возвращает `DatasetDict`.** На нём `len(...)`,
   `ds[0]`, `column_names` упадут — это словарь, а не таблица. Сначала достань сплит:
   `ds["train"]`.
3. **`shuffle` не бесплатный** на больших `Dataset` — переписывает Arrow-файл.
   Лучше один раз перетасовать и закэшировать, чем дёргать в каждом запуске.
4. **`map(..., batched=True)` в разы быстрее**, если функция векторизуется.
   Дефолт — `batched=False`, и легко не заметить.
5. **У `IterableDataset` нет `len`.** При тренировке считают шаги, а не эпохи.
6. **Gated-датасеты** требуют `huggingface-cli login` или `HF_TOKEN`. Публичные
   (как `rotten_tomatoes`, `imdb`) работают без логина.

### Что почитать, чтобы закрепить
- `help(datasets.load_dataset)` — все параметры (`path`, `name`, `split`,
  `streaming`, `cache_dir`, `download_mode`, `revision`).
- `dir(ds)` — все методы у конкретного датасета.
- Dataset Viewer прямо в браузере на странице датасета на Hub — посмотреть схему
  и пару строк **до** загрузки.

---

## Закладка: где остановились (2026-05-21)

**Сделано:**
- Установлены `datasets` + `huggingface_hub` через `uv pip install` (поймана
  ловушка PEP 668 в uv-venv — занесена в memory).
- Разобран Блок 1 теории целиком (выше в этом файле).

**В подвешенном состоянии:**
- В ноутбуке `scratch/phase-0/lesson-09/01_first_dataset.ipynb` запущено
  `load_dataset("Qwen/WebWorldData", split="train")` без `streaming=True`.
  Это 52.2 ГБ одним JSONL. Pavel начал прерывание; на момент паузы НЕ
  подтверждено что:
  1. Kernel реально прерван (`Kernel → Interrupt Kernel` или Restart).
  2. Каталог `~/.cache/huggingface/hub/datasets--Qwen--WebWorldData/`
     удалён (в WSL под `pavel`, а не в Git Bash под Windows-юзером).

**Что сделать при возвращении (по порядку):**

1. В WSL-терминале:
   ```bash
   du -sh ~/.cache/huggingface/
   ls -la ~/.cache/huggingface/hub/ | grep -i webworld
   ```
2. Удалить недокачку:
   ```bash
   rm -rf ~/.cache/huggingface/hub/datasets--Qwen--WebWorldData
   rm -rf ~/.cache/huggingface/datasets/downloads/*.incomplete
   ```
3. Подтвердить освобождение места: `du -sh ~/.cache/huggingface/` и `df -h ~`.
4. Решить, как идти дальше для упражнения 1:
   - **A.** Тот же `Qwen/WebWorldData` со `streaming=True`. Тогда упражнение 1
     закроется не полностью: у `IterableDataset` нет `len()` и индексации.
   - **B.** Мелкий датасет: `rotten_tomatoes` (~8 МБ), `imdb` (~84 МБ),
     `glue/mrpc` (~1 МБ), `ag_news` (~30 МБ). На нём пройти весь набор
     операций (`len`, `ds[0]`, `column_names`, `features`).
   - Рекомендация: сначала **B** (быстро уложить механику API), потом
     отдельно поиграть с **A** в Блоке 3 (streaming).

**Что осталось по плану урока:**
- Блок 2 — форматы (CSV / JSON / Parquet / Arrow) и их трейдоффы.
- Блок 3 — streaming подробно (продолжение Блока 1, но руками).
- Блок 4 — train/val/test split + seed.
- Блок 5 — большие файлы и git (.gitignore / Git LFS / DVC).
- Финал — `code/data_utils.py` как референс.
- Упражнения 1-4 из `en.md` + опциональный quiz.
