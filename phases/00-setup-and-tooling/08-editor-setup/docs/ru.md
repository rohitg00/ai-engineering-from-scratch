# Урок 8 — Настройка редактора (AstroNvim edition)

> Параллельный конспект к `en.md`. Оригинальный урок построен вокруг VS Code;
> здесь то же самое переложено на AstroNvim, потому что это основной редактор
> в текущей конфигурации (см. `astronvim-setup.md` в корне репо).
>
> Когда позже пересяду на Cursor или VS Code — пройду урок заново уже под них.

## Что должен уметь редактор для AI-работы

Урок постулирует пять уровней:

```
5. Remote development  — открыть и редактировать файлы на удалённой GPU-машине
4. Terminal integration — где гонять скрипты, nvidia-smi, тренировки
3. AI-specific settings — format-on-save, type checking, rulers
2. Extensions           — Python LSP, Jupyter, линтер, форматтер, Git
1. Base editor          — собственно текстовый редактор
```

В Neovim-логике это устроено иначе, чем в VSCode. Маппинг:

| Слой | VS Code | Neovim |
|---|---|---|
| Base editor | VS Code (Electron, GUI) | Neovim (терминальное приложение) |
| Extensions | Один магазин расширений | **Два разных уровня**: плагины (Lua/Vim код) + LSP-серверы (отдельные процессы) |
| Settings | `settings.json` в `.vscode/` | Lua-файлы в `~/.config/nvim/` + опции конкретных плагинов |
| Terminal | Integrated terminal | Встроенный `:terminal`, плюс шорткаты AstroNvim (F7, `<Space>tf`) |
| Remote | Расширение Remote-SSH | `ssh user@box && nvim` (легковесно) или `distant.nvim` (тяжёлый аналог Remote-SSH) |

### Ключевая концепция: plugin ≠ LSP-server

В VS Code разработчик ставит одно расширение `ms-python.vscode-pylance` — и
сразу есть автокомплит, типы, инспекция импортов. В Neovim это **разделено
на два уровня**:

- **Плагин** (Lua-код) — отвечает за UI и интеграцию с редактором. Например
  `nvim-cmp` рисует попап автокомплита. Сам по себе ничего не знает про Python.
- **LSP-сервер** — отдельный процесс (Python/Node/Rust бинарь), который читает
  код и говорит редактору: «эта переменная имеет тип `pd.DataFrame`, у неё
  есть метод `.groupby`». Для Python это, например, `pyright` или
  `basedpyright`.

Между ними — два склеивающих компонента:

- **`nvim-lspconfig`** — плагин-клей: запускает LSP-сервер и стримит
  сообщения в Neovim.
- **`mason.nvim`** — менеджер: ставит LSP-серверы, форматтеры, линтеры
  (`:Mason` — UI).

AstroNvim из коробки включает оба этих "транспортных" слоя. Остаётся через
Mason поставить конкретные **языковые** инструменты для Python.

### Аналогия с Docker (урок 07)

То же устройство, что у Docker:

| Docker | Neovim LSP |
|---|---|
| `dockerd` (демон, делает работу) | `pyright` / `basedpyright` (LSP-сервер) |
| `docker` CLI (клиент) | `nvim-lspconfig` (плагин-клиент) |
| `apt` (ставит docker) | Mason (ставит pyright) |

Конструкция знакомая.

## Что ставится для Python в AstroNvim

В файле `~/.config/nvim/lua/community.lua` после снятия предохранителя
(`if true then return {} end`) и добавления python-pack:

```lua
return {
  "AstroNvim/astrocommunity",
  { import = "astrocommunity.pack.lua" },
  { import = "astrocommunity.pack.python" },
}
```

`astrocommunity.pack.python` — это **готовая связка плагинов и Mason-конфигов**
для Python. При первом запуске после правки:

1. `lazy.nvim` качает Python-специфичные плагины (`venv-selector.nvim` —
   переключение venv'ов; `neotest-python` — запуск pytest).
2. Mason при следующем запуске ставит бинарники LSP-серверов, форматтеров,
   тайпчекеров.

### Что реально ставит python-pack (на 2026-05)

| Инструмент | Роль | Что используем |
|---|---|---|
| `basedpyright` | LSP — тайпчекинг, автокомплит | **Да** (форк pyright, активнее обновляется) |
| `ruff` | LSP — линтер + форматтер | **Да** (один инструмент для всего стиля) |
| `pyrefly` | Тайпчекер от Meta (Rust) | Нет, экспериментальный — ставится для сравнения |
| `ty` | Тайпчекер от Astral (Rust) | Нет, экспериментальный |
| `debugpy` | DAP — отладчик | Понадобится на уроке 12 фазы 0 |
| `black` | Форматтер | Нет, `ruff format` его заменяет |
| `isort` | Сортировщик импортов | Нет, `ruff` это умеет |

Pack ставит лишнее «на всякий случай», чтобы ты потом выбрал. По умолчанию
используем `basedpyright` + `ruff`.

### Почему именно ruff

Раньше Python-мир был зоопарком: Black форматировал, flake8 линтил, isort
сортировал импорты, pylint искал баги — у каждого свой процесс, свой конфиг,
свои конфликты.

**Ruff** написан на Rust одной командой (Astral — те же, кто сделал `uv`).
Он покрывает 99% правил flake8 + isort + ещё пары десятков плагинов, умеет
форматировать как Black, и стартует за миллисекунды.

**`basedpyright` + `ruff` не пересекаются:**
- `basedpyright` отвечает за **типы**.
- `ruff` отвечает за **стиль и форматирование**.

Это два разных уровня контроля, и они уживаются рядом.

## AI-specific settings (блок 3 урока)

Урок (en.md) рекомендует 5 настроек редактора для AI-работы. В Neovim
они либо уже работают, либо настраиваются одной правкой `astrocore.lua`:

| Настройка | Откуда в Neovim |
|---|---|
| `editor.formatOnSave: true` | **Из коробки** — `conform.nvim` из AstroNvim вызывает `ruff format` при `:w` |
| Type checking | **Из коробки** — `basedpyright` по умолчанию в режиме `basic` |
| Rulers (вертикальные линии) | Добавляется как `colorcolumn = "88,120"` в `~/.config/nvim/lua/plugins/astrocore.lua`, секция `options.opt` |
| Notebook output scrolling | N/A — это про VSCode Jupyter, в Neovim см. блок 4 |
| Auto-save afterDelay | Не делаем. В Neovim `<Space>w` (write) — одна клавиша, мгновенно. Autosave в vim-культуре считается шумным, добавлять не нужно |

### Что про `colorcolumn` нужно знать

- `88` — ширина, на которой обрывает строки `ruff format` (как Black).
- `120` — soft-граница для комментариев и докстрингов.

### Что я понял на этом блоке

- В файле `~/.config/nvim/lua/plugins/astrocore.lua` (как и в `community.lua`)
  на первой строке стоит **killswitch**: `if true then return {} end`. Пока он
  там — весь файл при загрузке возвращает пустую таблицу, и никакие настройки
  не применяются. Нужно удалить эту строку, чтобы конфиг ожил.
- Структура опций: `opts.options.opt.<vim_option>`. Все обычные vim-опции
  (`relativenumber`, `wrap`, `colorcolumn` и т.д.) лежат именно тут.
- `opts.options.g` — для глобальных vim-переменных (`vim.g.<...>`), не для
  опций редактора. Случайно положить туда `colorcolumn = "88,120"` —
  получить ошибку от lua_ls `Cannot assign 'string' to 'table<string, any>'`.

### `relativenumber` — что это и зачем

В AstroNvim по умолчанию включён `relativenumber = true`. На текущей строке
показывается её абсолютный номер, а на соседних — **расстояние** от курсора.
Удобно для motion-команд: видишь `7` строк до нужного места — нажимаешь
`7k` или `7j` и сразу там.

Если поначалу путает (как путало меня при правке `astrocore.lua`) — можно
отключить, добавив `relativenumber = false` в `opt = {...}`. Но привыкание
обычно стоит того.

## Jupyter workflow в Neovim (блок 4 урока)

В VSCode для работы с `.ipynb` ставят `ms-toolsai.jupyter` — ячейки, выводы,
графики прямо внутри редактора. В Neovim это **открытый вопрос** с тремя
разными ответами разной сложности:

| Подход | Что | Когда брать |
|---|---|---|
| **1. Jupyter в браузере из nvim-терминала** | `F7` → `jupyter lab` → работа в браузере, как обычно | По умолчанию. Сейчас |
| **2. `.py` с `# %%` ячейками + REPL** | Файл с маркерами `# %%` (jupytext-совместимо), отправка блоков в IPython через `iron.nvim` / `vim-slime` | Когда захочется git-friendly формат и не нужны inline-картинки |
| **3. `molten-nvim` с inline-графикой** | Полная замена Jupyter UI в Neovim. Графики рендерятся **прямо в окне** | Требует терминал с графическим протоколом (`kitty`, `wezterm`, `ghostty`). Windows Terminal **не подходит** |

### Что выбираем сейчас

**Подход 1.** Запускаем `jupyter lab` из `F7`-терминала AstroNvim, работаем
в браузере. Jupyter из урока 06 уже установлен в `.venv` курса
(`jupyterlab 4.5.7`, `IPython 9.13.0`).

Подходы 2/3 поставим в фазах 2-3, когда **реально** часто понадобится
переключаться между скриптами и тетрадями. Это just-in-time по
[`feedback_just_in_time_learning.md`](../../../.claude/projects/.../memory/feedback_just_in_time_learning.md).

## Terminal + Remote (блок 5 урока)

### Terminal в AstroNvim — три способа

| Шорткат | Что |
|---|---|
| `<Space>tf` или `F7` | Floating terminal (плавающее окно) |
| `<Space>th` | Horizontal split — терминал снизу |
| `<Space>tv` | Vertical split — терминал справа |

Выход из terminal mode в normal: `Ctrl+\` → `Ctrl+n`.

Полезный сценарий из урока — два терминала: в одном `python train.py`, в
другом `watch -n 1 nvidia-smi`. Это `<Space>th` + `<Space>tv` параллельно.

### Remote development — отложено

В VSCode для удалённой работы ставят `ms-vscode-remote.remote-ssh`. В Neovim:

- **Базовый путь:** `ssh user@gpu-box` → `nvim` уже на той стороне. Работает
  без настройки и подходит для подавляющего большинства случаев.
- **Аналог Remote-SSH:** `distant.nvim` — плагин, который открывает
  удалённые файлы как локальные. В курсе не нужен.

Sсh-ключи и `~/.ssh/config` (с алиасами вроде `Host gpu-box ...`) — настроим
тогда, когда появится реальная удалённая машина. До этого момента — заметка
на полях.

## Что закрыто и что отложено

| Часть урока | Статус |
|---|---|
| Base editor + extensions (для AstroNvim это lazy.nvim plugins + Mason LSP) | ✓ |
| Python LSP (basedpyright + ruff) | ✓ |
| Format-on-save | ✓ — работает из коробки |
| Type checking | ✓ — basedpyright `basic` |
| Rulers (88, 120) | ✓ — `colorcolumn` в astrocore.lua |
| Autosave | Сознательно пропущен — `<Space>w` достаточно |
| Jupyter | ✓ подход 1 (browser); подходы 2/3 — отложены до классического ML |
| Terminal integration | ✓ из коробки (`F7`, `<Space>tf/th/tv`) |
| Remote SSH | Отложено — нет удалённой машины |
| Debugger (DAP) | `debugpy` установлен Mason'ом, но настройка — на уроке 12 фазы 0 |
| Lint-on-save отдельно | Не нужно — ruff и линтит, и форматирует |

## Шорткаты, которые осели после урока

| Шорткат | Что |
|---|---|
| `K` (normal) | Hover-документация под курсором |
| `gd` (normal) | Go-to-definition |
| `<C-o>` (normal) | Назад после прыжка |
| `dd` (normal) | Вырезать строку |
| `o` (normal) | Открыть новую строку под курсором + insert |
| `O` (normal) | То же, но над |
| `cw` (normal) | Change word — заменить слово |
| `I` (normal) | Insert в начало строки (первый non-whitespace) |
| `:Mason` | UI менеджера LSP / форматтеров / линтеров |
| `:LspInfo` | Какие LSP-серверы прицеплены к буферу |
| `:checkhealth <name>` | Диагностика конкретного компонента |
| `F7` / `<Space>tf` | Плавающий терминал |
| `Ctrl+\` `Ctrl+n` | Выйти из terminal-mode в normal |

## Что важно вынести из урока

1. **VSCode-расширение ≠ Neovim-плагин.** В Neovim "расширение" — это два
   разных уровня (plugin + LSP-server), которые соединяются через
   `nvim-lspconfig` и менеджатся через Mason. Конструкция та же, что у
   Docker (демон + клиент + менеджер пакетов).
2. **AstroNvim даёт готовый transport-слой**, но языковые серверы (pyright,
   ruff и т.д.) активируются через **astrocommunity packs**.
3. **Killswitch `if true then return {} end`** — стандартная мина AstroNvim
   template'а. Любой файл в `~/.config/nvim/lua/plugins/` или `lua/community.lua`,
   куда вносишь правки, начинается с этой строки. Снять — обязательно.
4. **`opts.options.opt` ≠ `opts.options.g`.** Первое — vim options (типы
   валидируются), второе — vim global variables (свободная форма). Положить
   `colorcolumn` в `g` — мгновенно получить ошибку от lua_ls.
5. **Format-on-save + type checking — из коробки** после активации
   python-pack. Не надо ничего настраивать вручную.
