# Урок 06 — Python Environments

> Dependency hell — это реально. Virtual environments — это лекарство.

**Тип:** Build
**Языки:** Python
**Пререквизиты:** Фаза 0, Урок 01
**Время:** ~30 минут

## Чему учимся

- Создавать изолированные окружения через `uv`, `venv`, `conda`.
- Писать `pyproject.toml` с optional dependency groups и генерировать lockfile для воспроизводимости.
- Диагностировать типовые ошибки: глобальные установки, смешивание pip/conda, CUDA mismatch.
- Применять стратегию «environment на фазу» в проектах с конфликтующими зависимостями.

---

## Блок 1 — Проблема: dependency hell

### Что это вообще

Любой `pip install <пакет>` без активного venv ставит пакет **в один общий
каталог** — туда, где живёт твой системный Python. Это значит, что **все
проекты на машине делят одно хранилище пакетов**.

Пока у тебя один проект — проблемы нет. Проблема начинается, когда проектов
становится больше одного и они требуют **разных версий одного и того же пакета**.

### Каноничный пример из AI

- **Проект A** — fine-tuning старой модели, требует `torch==2.1.0` с CUDA 11.8.
- **Проект B** — генерация изображений на свежем diffusers, требует `torch==2.4.0` с CUDA 12.4.

В системном Python `torch` может быть установлен **только в одной версии**.
Ставишь `2.4.0` — проект A падает с импорта. Ставишь `2.1.0` — проект B
ругается «требуется ≥ 2.4». Это и есть **dependency hell**.

### Почему в AI это острее, чем в «обычной» разработке

В обычном backend-приложении конфликт версий — это спор о версиях фреймворка
(Django 4 vs Django 5). Неприятно, но переживаемо.

В AI каждая ML-библиотека **тащит свой собственный CUDA-бинарник** —
скомпилированный код, который умеет говорить с GPU только через конкретную
версию CUDA runtime. У PyTorch свой, у JAX свой, у TensorFlow свой. Когда они
оказываются в одном глобальном Python, они начинают перетирать друг другу
библиотеки на уровне C-кода, и ты получаешь segfault'ы и `CUDA error: ...`,
которые ничем не лечатся, кроме «снести всё и поставить заново».

Плюс: модели на HuggingFace часто пинят строго конкретную версию `transformers`
или `torch` — и она у каждой модели своя.

### Решение (которое разберём дальше)

Каждый проект сидит в **своём собственном изолированном Python**. Активируешь
проект A — видишь его пакеты. Активируешь проект B — видишь его пакеты.
Они физически в разных папках, не пересекаются, конфликта нет.

### Руками

Чтобы прочувствовать проблему, посмотрим на «общую корзину» — твой системный
Python и что в неё уже сложено.

См. шаги в чате (`which python3`, `python3 -m site`, `python3 -m pip list`).

### Важная деталь Ubuntu 24.04 — PEP 668

На свежей Ubuntu (24.04) `pip` **не положен в системный Python намеренно**.
Это часть стандарта [PEP 668](https://peps.python.org/pep-0668/) —
«externally-managed environments». Системный Python принадлежит дистрибутиву,
половина системных утилит на нём держится, и любой `pip install` может
перетереть зависимости и сломать ОС. Поэтому Ubuntu:

- **не кладёт `pip` в системный `python3`** — `python3 -m pip` → `No module named pip`;
- если ты его поставишь через `apt install python3-pip`, попытка `pip install <пакет>`
  отвалится с `error: externally-managed-environment` и подскажет «делай venv»;
- обойти этот запрет можно флагом `--break-system-packages`, но именно «break»
  в названии — намёк на то, что ты получишь сломанную систему.

Итог: на современных дистрибутивах **dependency hell на системном Python
физически невозможен** — за тебя его запретили. Это сильный аргумент за то,
чтобы с самого начала привыкать к venv'ам.

### Gotcha Ubuntu 24.04: venv тоже не идёт «из коробки»

После чистой установки Ubuntu 24.04 первая же команда `python3 -m venv ...`
падает с ошибкой:

```
The virtual environment was not created successfully because ensurepip is not
available.  On Debian/Ubuntu systems, you need to install the python3-venv
package using the following command.

    apt install python3.12-venv
```

Причина: в Debian-семействе **пакет Python разрезан на мелкие части**:

| Пакет | Что внутри |
|---|---|
| `python3.12-minimal` | Интерпретатор + минимум stdlib (без чего apt не запустится) |
| `python3.12` | Полный stdlib |
| `python3.12-venv` | Модуль `venv` + `ensurepip` (механизм, кладущий pip внутрь нового venv) |
| `python3-pip` | Системный pip (которого по PEP 668 трогать нельзя) |
| `python3-full` | Мета-пакет — ставит всё вышеперечисленное скопом |

Базовая Ubuntu ставит только `python3.12-minimal` + `python3.12`. Модуль
`venv` физически в системе **есть** (`python3 -m venv --help` работает), но
он не может закончить создание venv — потому что внутрь нового venv нужно
положить pip, а механизм `ensurepip` лежит в отдельном пакете
`python3.12-venv`. Поэтому venv падает на полпути.

**Лечится одной командой:** `sudo apt install python3.12-venv`. После этого
venv будет работать. Это **разовая** установка на систему, а не на проект.

---

## Блок 2 — Что такое virtual environment физически

`venv` — это **папка**, в которую кладётся:

| Объект | Что это |
|---|---|
| Симлинк/копия Python-интерпретатора | Ссылка на системный `/usr/bin/python3.12` (не дублирование) |
| `bin/activate`, `Activate.ps1`, ... | Скрипты активации для разных shell'ов |
| Свой `pip`, `pip3`, `pip3.12` | **Реальные** исполняемые файлы (в отличие от системного Python, где pip нет) |
| `lib/python3.X/site-packages/` | Собственное пустое хранилище пакетов |
| `pyvenv.cfg` | Конфиг venv |

Содержимое `pyvenv.cfg` (типичное):

```
home = /usr/bin                             # где базовый Python
include-system-site-packages = false        # КЛЮЧЕВОЕ — изоляция от /usr/lib/python3/dist-packages
version = 3.12.3
executable = /usr/bin/python3.12
```

Параметр `include-system-site-packages = false` — это и есть технический
механизм изоляции. Когда venv-овский Python стартует, он читает этот файл
и не добавляет системные `dist-packages` в свой `sys.path`.

Свежий venv в `site-packages` содержит только `pip` и `pip-XX.dist-info` —
ничего из системных пакетов туда не попадает.

---

## Блок 3 — Активация и изоляция

### Что делает `source .venv/bin/activate`

1. Сохраняет текущий `PATH` в `_OLD_VIRTUAL_PATH` (чтобы `deactivate` мог откатить).
2. Добавляет `<venv>/bin/` **в начало** `PATH` → теперь `python`, `pip` и т.п. находятся первыми из venv.
3. Экспортирует `VIRTUAL_ENV=<полный путь>`.
4. Меняет prompt — добавляет префикс `(имя_venv)`.

Никакой магии в Python нет. Просто из-за изменённого `PATH` команда `python`
запускает `<venv>/bin/python`, а тот через `pyvenv.cfg` знает, где его
`site-packages`. `deactivate` — это просто откат `PATH` + удаление
`VIRTUAL_ENV`.

### Картина «до/после» активации

| Проверка | До | После |
|---|---|---|
| `which python3` | `/usr/bin/python3` | `<venv>/bin/python3` |
| `which pip` | `not found` (на Ubuntu 24.04) | `<venv>/bin/pip` |
| `$VIRTUAL_ENV` | пусто | `<полный путь к venv>` |
| Первый элемент `$PATH` | твой обычный | `<venv>/bin` |
| `python3 -m site` → `sys.path` | содержит `/usr/lib/python3/dist-packages` | содержит `<venv>/lib/.../site-packages`, **БЕЗ** dist-packages |
| `python3 -m site` → `ENABLE_USER_SITE` | `True` | `False` (≈ `~/.local/lib/...` тоже отключён) |
| prompt | `pavel@Home-PC:~$` | `(имя_venv) pavel@Home-PC:~$` |

### Доказательство изоляции

Сценарий: ставим `requests==2.34.2` в активный venv. После этого:

```bash
# В активном venv
python3 -c "import requests; print(requests.__version__, requests.__file__)"
# → 2.34.2 /tmp/play-venv/lib/python3.12/site-packages/requests/__init__.py

# В обход активации, через абсолютный путь к системному Python
/usr/bin/python3 -c "import requests; print(requests.__version__)"
# → либо ModuleNotFoundError (если в системе requests'а не было)
# → либо ДРУГАЯ ВЕРСИЯ из /usr/lib/python3/dist-packages/ (если apt уже поставил)
```

**Главная мысль:** изоляция работает **в обе стороны**. На одной машине
одновременно могут жить две разные версии одной и той же библиотеки — в
venv и в системе — и они **не пересекаются**, потому что у двух Python'ов
разные `sys.path` и разные `site-packages`. Это и есть лекарство от
dependency hell: версии разделены физически.

### Откуда в системе появляется библиотека вроде `requests` без твоего участия

Через apt — `python3-requests` ставится как **зависимость** какой-нибудь
системной утилиты Ubuntu (например, `command-not-found`, `software-properties`).
Проверить, какой пакет принёс файл:

```bash
dpkg -S /usr/lib/python3/dist-packages/requests/__init__.py
```

Покажет `python3-requests: /usr/lib/...` и при желании можно `apt rdepends
python3-requests`, чтобы увидеть, кто зависит от него.

### Деактивация

`deactivate` (без аргументов) — откатывает всё:

- `PATH` восстанавливается из `_OLD_VIRTUAL_PATH`;
- `VIRTUAL_ENV` сбрасывается;
- prompt возвращается к исходному.

Сам каталог venv'а на диске **не трогается** — его можно активировать снова
в любой момент или физически удалить через `rm -rf <venv>`. Никакой
«регистрации» venv в системе нет, всё хранится в самой папке.

---

## Блок 4 — Инструменты: `venv` vs `uv` vs `conda`

| Возможность | `venv` (stdlib) | `uv` (Astral) | `conda` (Miniconda) |
|---|---|---|---|
| Создать isolated env | ✅ | ✅ | ✅ |
| Установка пакетов | через `pip` | свой `uv pip` (та же UI, 10-100× быстрее) | свой `conda install` |
| Управление Python-версиями | ❌ | ✅ (`uv python install 3.12`) | ✅ |
| Lockfile для воспроизводимости | ❌ | ✅ (`uv.lock` автоматом) | ✅ (`environment.yml`) |
| Не-Python зависимости (CUDA toolkit, MKL, GDAL) | ❌ | ❌ | ✅ |
| Чтение `pyproject.toml` | ❌ | ✅ нативно | через pip |
| Размер инструмента | 0 (stdlib) | один бинарник ~30МБ | ~500МБ Miniconda |

**Когда какой:**

- **`venv`** — когда нужно быстро поставить что-то на машине без интернета или прав ставить `uv`. Всегда работает, но без свистулек.
- **`uv`** — **стандарт для курса и для AI/ML в целом.** Делает всё, что venv + pip + pyenv + pip-tools, и в 10-100 раз быстрее. От Astral (создатели `ruff`).
- **`conda`** — берём, **только если нужна не-Python зависимость без `sudo apt`** (свой CUDA toolkit, MKL, специфические C-библиотеки). На WSL CUDA приходит с Windows-драйвера, conda обычно не нужен. Внутри conda-env **нельзя мешать `pip install`** — теряется учёт зависимостей.

Не путать **Miniconda** (~500МБ, голый менеджер) с **Anaconda** (~3ГБ дистрибутив с кучей предустановленного мусора).

`uv` ставится одной командой:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Кладёт бинарник в `~/.local/bin/uv` и дописывает PATH в `~/.bashrc`. После
этого `uv` сразу же по умолчанию подтягивает свой managed Python (например,
`cpython-3.12.13` в `~/.local/share/uv/python/...`) — этот Python не привязан
к PEP 668 и без ограничений Ubuntu.

---

## Блок 5 — Реальная venv для курса (Упражнение 1)

Используем существующую `.venv` в корне репо (она уже создана через uv с
prompt `ai-engineering-from-scratch`). Активируем, проверяем содержимое,
доставляем недостающие core-пакеты.

```bash
cd ~/ai-engineering-from-scratch
source .venv/bin/activate
uv pip install scikit-learn          # доставить недостающее
```

### Gotcha №1: имя пакета на PyPI ≠ имя модуля для `import`

Главная путаница для новичков. То, что ты пишешь в `pip install`, и то, что
ты пишешь в `import`, — **разные вещи**. Они часто совпадают, но не всегда.

| `pip install ...` (PyPI-имя) | `import ...` (имя модуля) |
|---|---|
| `scikit-learn` | `sklearn` |
| `Pillow` | `PIL` |
| `beautifulsoup4` | `bs4` |
| `PyYAML` | `yaml` |
| `opencv-python` | `cv2` |
| `python-dateutil` | `dateutil` |
| `huggingface-hub` | `huggingface_hub` |

Дополнительный кейс — пакет `sklearn` на PyPI **намеренно сломан** мейнтейнерами:
`pip install sklearn` падает с сообщением «use scikit-learn». Это сделано,
чтобы все перешли на правильное имя.

### Gotcha №2: мета-пакеты не имеют своего модуля

`jupyter` на PyPI — это **мета-пакет**: при установке он тащит за собой
`jupyter_core`, `jupyter_client`, `jupyterlab`, `notebook`, `ipykernel`
и т.п., но **никакого `import jupyter`** не предоставляет. Проверять
установку нужно через зависимости: `import jupyter_core`,
`import jupyterlab` и т.п.

Скрипт `env_setup.sh` именно так и делает:
```bash
verify_package "jupyter" "jupyter_core"
#               pypi      импорт
```

### Корректная проверка core-пакетов

```bash
for pair in "numpy:numpy" "matplotlib:matplotlib" "jupyter:jupyter_core" \
            "scikit-learn:sklearn" "pandas:pandas"; do
    pkg="${pair%:*}"
    mod="${pair#*:}"
    python -c "import $mod; print(f'  {\"$pkg\":12} -> import $mod ({$mod.__version__})')"
done
```

### Smoke test — numpy работает

```bash
python -c "
import numpy as np
a = np.random.randn(3, 3)
b = np.random.randn(3, 3)
c = a @ b
print(f'  Matrix multiply: ({a.shape}) @ ({b.shape}) = ({c.shape})')
"
```

Если matmul напечатал `(3, 3) @ (3, 3) = (3, 3)` — numpy здоров, venv готов
к работе.

---

## Блок 6 — `pyproject.toml` и lockfile (Упражнение 3)

`pyproject.toml` — современный единый файл конфигурации Python-проекта
(PEP 518, PEP 621). Заменяет `setup.py` + `setup.cfg` + `requirements.txt`
+ `MANIFEST.in`.

### Структура (для проекта-разработки)

```toml
[build-system]                                    # КАК собирать (нужно для упаковки)
requires = ["setuptools>=64"]
build-backend = "setuptools.build_meta"

[project]                                         # ЧТО за пакет
name = "playground-project"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [                                  # базовые зависимости
    "numpy>=1.26",
]

[project.optional-dependencies]                   # ОПЦИОНАЛЬНЫЕ группы
torch = ["torch>=2.3", "torchvision>=0.18"]
llm = ["anthropic>=0.39", "openai>=1.50"]
```

Плюс инструментальные секции — `[tool.ruff]`, `[tool.pytest.ini_options]`
и т.п. — для конфигов tools, не обязательная часть стандарта.

### Установка с extras

```bash
uv pip install -e .                  # только базовые deps
uv pip install -e ".[torch]"         # базовые + torch group
uv pip install -e ".[torch,llm]"     # базовые + обе группы
```

`-e` = **editable install**: pip кладёт в `site-packages` не копию файлов
проекта, а `.pth`-файл с путём к исходникам. Изменения в коде подхватываются
без переустановки — стандартный режим разработки.

### Гott'cha: `--extra` — это имя группы, не пакета

Если в `pyproject.toml` нет секции `[project.optional-dependencies]`, то
`uv pip compile pyproject.toml --extra numpy` упадёт с
`error: Requested extras not found: numpy`. Извлечения не привязаны к
именам пакетов — это **именованные группы**, которые ты сам определяешь
в `[project.optional-dependencies]`.

### Lockfile через `uv pip compile`

```bash
uv pip compile pyproject.toml -o requirements.lock --extra torch --extra llm
```

Резолвит все зависимости + транзитивные, пишет точные версии в файл.
**Ничего не ставит** — только описывает «идеальный мир версий», который
должен получиться.

### Что показывает lockfile

Из 5 пакетов в `pyproject.toml` → **56 пакетов** в lockfile.

Каждая строка имеет комментарий `# via <кто потребовал>` — это **граф
зависимостей в виде текста**. Удобно прослеживать цепочки.

Полезные наблюдения на нашем lockfile:

- `torch==2.12.0` тянет **18 NVIDIA-пакетов** (`nvidia-cudnn-cu13`,
  `nvidia-cublas`, `triton` и др.) — ~2-3 ГБ. Суффикс `-cu13` = CUDA major
  version 13; если на машине CUDA 12 — эти бинарники не подойдут.
  Это **физическая причина** «CUDA mismatch».
- `numpy` приходит из двух источников (`pyproject.toml` + `torchvision`),
  uv резолвит в одну версию, удовлетворяющую обоим.
- `anthropic` + `openai` тянут общую базу: `pydantic`, `httpx`, `anyio`.
  Если бы версии конфликтовали — uv упал бы с сообщением о конфликте.
- `typing-extensions` — лидер по `via`: на него ссылаются 7 пакетов
  (`pydantic`, `torch`, оба SDK, и др.). Утилитарный «backport системы
  типов» — стандарт современного Python.

### Воспроизводимость

```bash
uv pip install -r requirements.lock      # установить ровно тот набор
```

`requirements.lock` коммитится в git. На любой машине, в любой момент
времени, эта команда даст **идентичный** результат. Это и есть
воспроизводимость билдов.

Полный workflow `uv` для проектов (`uv lock` + `uv sync` + собственный
`uv.lock`) — продвинутее, умеет инвалидироваться при изменениях в
`pyproject.toml`. Но для большинства задач `uv pip compile` достаточно.

---

## Блок 7 — Изоляция руками (Упражнение 2)

Цель: убедиться руками, что два venv с разными версиями одного пакета
не пересекаются.

Сценарий:
1. `uv venv /tmp/numpy-old-venv --python 3.12` — новый venv.
2. `uv pip install "numpy==1.26.4"` — старая numpy.
3. Репо-venv хранит `numpy==2.4.4`.
4. Кросс-проверка через **абсолютные пути** к Python, без активации:

```bash
/tmp/numpy-old-venv/bin/python -c "import numpy; print(numpy.__version__)"
# → 1.26.4

~/ai-engineering-from-scratch/.venv/bin/python -c "import numpy; print(numpy.__version__)"
# → 2.4.4
```

Каждый Python смотрит в **свой** `site-packages` через свой `pyvenv.cfg`.
Никакой общей точки разделения нет — это две физически отдельные папки.

---

## Блок 8 — Per-phase strategy и Common Mistakes

### Per-phase strategy

Курс на 20 фаз. У них **разные** dependency-стеки:

| Фазы | Что нужно |
|---|---|
| 0-3 (setup, math, python) | numpy, pandas, matplotlib, jupyter — мелочи |
| 4-7 (NN, CNN, RNN, transformers) | torch + CUDA (700МБ-2ГБ) |
| 8-10 (LLM training, RLHF) | transformers, datasets, accelerate — пины на конкретные torch |
| 11+ (LLM APIs, RAG) | anthropic, openai, langchain — никакого torch не нужно |

Один общий venv на весь курс — **плохо**, потому что:
- Конфликты: HF может пинить torch 2.3, а потом тебе понадобится torch 2.5.
- Размер: тащить 2ГБ torch для фазы 11 (где он не нужен) — расточительно.
- Скорость: чем больше пакетов в venv, тем медленнее резолвится новая установка.

Рекомендуемая структура (из en.md):

```
ai-engineering-from-scratch/
├── .venv/                          ← lightweight для фаз 0-3 (numpy/pandas/jupyter)
├── phases/
│   ├── 04-neural-networks/.venv/   ← PyTorch env
│   ├── 08-transformers/.venv/      ← возможно отдельный torch+transformers
│   └── 11-llm-apis/.venv/          ← только API SDKs, без torch
```

Каждый venv обслуживает **группу родственных фаз**, а не одну фазу. Если две
соседние фазы одинаковы по deps — можно одну venv шарить через симлинк или
просто переиспользовать активацию.

### Common Mistakes — что мы уже встретили по ходу урока

| Ошибка | Когда увидели |
|---|---|
| **Global pip install** | Блок 1: `python3 -m pip install requests` → `No module named pip` (Ubuntu 24.04 защищает через PEP 668) |
| **Mixing pip + conda** | Не делали — `conda` не используем; обсудили концептуально в Блоке 4 |
| **Forgot to activate** | Блок 3: видели разницу до/после `source activate` — `which python`, `$PATH`, `$VIRTUAL_ENV` |
| **Committing .venv to git** | Проверили: `.venv/` уже в `.gitignore` репо ✓ |
| **CUDA version mismatch** | Блок 6: видели в lockfile — `nvidia-cudnn-cu13` (CUDA 13) против `nvidia-cusparselt-cu13`. Если на машине CUDA 12 — эти бинарники не подойдут. |
| **Имя PyPI ≠ имя модуля** | Блок 5: `pip install sklearn` → namespace `sklearn` намеренно сломан; правильно `pip install scikit-learn` |
| **Мета-пакет без модуля** | Блок 5: `import jupyter` падает, нужно `import jupyter_core` |

### Упражнение 4 — поставить пакет глобально

Из en.md: «Deliberately install a package globally (without activating a venv),
notice where it goes, then uninstall it.»

**Уже сделано в Блоке 1**: `python3 -m pip install requests` → `No module
named pip`. Ubuntu 24.04 (PEP 668) **физически запрещает** глобальную установку
— и это правильно. Удалять нечего, потому что и установить не получилось.
Урок усвоен на уровне ОС: глобально ставить нельзя, всё в venv.

---

## Итоги урока 06

✅ Прошли:

- **Блок 1** — проблема dependency hell + PEP 668 (Ubuntu запрещает глобальный pip).
- **Блок 2** — что такое venv физически (папка с симлинком + свой `site-packages`).
- **Блок 3** — активация (`PATH`, `$VIRTUAL_ENV`, prompt) и изоляция (две версии requests на одной машине).
- **Блок 4** — инструменты: `venv` vs `uv` vs `conda`. uv выбран как стандарт курса.
- **Блок 5** (Упр. 1) — реальная рабочая venv для курса + два gotcha: PyPI-имя ≠ import-имя, мета-пакеты.
- **Блок 6** (Упр. 3) — `pyproject.toml` + lockfile через `uv pip compile`. 5 пакетов → 56 пакетов в lockfile.
- **Блок 7** (Упр. 2) — изоляция руками: две версии numpy в двух venv.
- **Блок 8** — per-phase strategy + сводка по Common Mistakes (большинство уже прошли по ходу).
- **Упр. 4** — закрыто Ubuntu PEP 668 (глобальный install запрещён).

🔧 На машине после урока:

- `/home/pavel/.local/bin/uv` — менеджер пакетов.
- `/home/pavel/.local/share/uv/python/cpython-3.12.13-linux-x86_64-gnu/` — uv-managed Python.
- `~/ai-engineering-from-scratch/.venv/` — рабочая venv курса с core stack.
- `~/ai-engineering-from-scratch/scratch/lesson-06/playground-project/` — учебный pyproject + lockfile.

### Корзины, которые видит системный Python

`sys.path` (из `python3 -m site`):

| Путь | Что лежит | Кто кладёт |
|---|---|---|
| `/usr/lib/python3.12/` | stdlib (`os`, `sys`, `json`, ...) | apt (пакет `python3.12-minimal`) |
| `/usr/lib/python3.12/lib-dynload/` | скомпилированные модули stdlib | apt |
| `/usr/local/lib/python3.12/dist-packages/` | пакеты, поставленные локальным админом | `sudo pip install --break-system-packages` |
| `/usr/lib/python3/dist-packages/` | пакеты, на которых держится сама ОС (`apt_pkg`, `dbus`, ...) | `apt install python3-*` |
| `~/.local/lib/python3.12/site-packages/` (USER_SITE) | пользовательские пакеты | `pip install --user --break-system-packages` |

В нашем курсе мы **не будем класть туда ничего**. Всё — в venv внутри проекта.
