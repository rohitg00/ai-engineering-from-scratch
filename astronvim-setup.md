# Установка AstroNvim на Windows + WSL2

Полный пошаговый гайд для развёртывания AstroNvim как основного редактора
на машине с Windows и WSL2. Проверен на Windows 10 Pro + Ubuntu 24.04 LTS.

## Кому это нужно

Если ты:
- хочешь редактор легче, чем VS Code / Cursor;
- работаешь в основном внутри WSL (как мы по [setup.md](setup.md));
- готов потратить ~30 минут на разовую установку;

— этот гайд для тебя.

## Архитектура решения

**Neovim ставится внутрь WSL, а не на Windows.** Это не очевидно, поэтому объясняю.

Если поставить nvim на Windows, а открывать им файлы из WSL через UNC-путь
`\\wsl$\Ubuntu\...`:
- LSP, форматтеры, линтеры — это Windows-бинарники. Они не видят твой
  WSL-venv и пакеты, поставленные через `apt`/`pip` в Linux.
- Файлы читаются через 9P-мост. Treesitter и file-watchers заметно тормозят.
- `:terminal` внутри nvim откроет PowerShell, а не bash.

Поэтому правильная схема:

```
Windows Terminal  →  вкладка WSL Ubuntu  →  cd ~/repo  →  nvim
```

Windows-сторона нужна только для двух вещей: терминала (Windows Terminal)
и Nerd Font (шрифт рендерит Windows). Всё остальное — Linux.

## Предусловия

- Windows 10 версии 1903+ или Windows 11.
- WSL2 + установленный Linux-дистрибутив (рекомендую Ubuntu 24.04 LTS).
- Доступ к интернету.
- ~3 ГБ свободного места.

Проверка WSL — в PowerShell:

```powershell
wsl -l -v
```

Должен увидеть свой дистрибутив со статусом `Running` и `VERSION 2`.
Если `VERSION 1` — обнови до WSL2 (`wsl --set-version <Distro> 2`).

---

## Часть 1: Windows-сторона

### 1.1. Установить Windows Terminal

Проверка:

```powershell
wt --version
```

Если не распознано — установить через winget (в PowerShell):

```powershell
winget install --id Microsoft.WindowsTerminal -e
```

После установки **закрой и открой PowerShell заново**, чтобы PATH подхватил.

### 1.2. Установить Nerd Font (JetBrainsMono)

Без Nerd Font все иконки в AstroNvim будут квадратиками или `?`.

В PowerShell (обычный, без админа) — одна команда:

```powershell
$tmp = "$env:TEMP\nerd-fonts-jbm"; New-Item -ItemType Directory -Force -Path $tmp | Out-Null; $zip = "$tmp\JetBrainsMono.zip"; Invoke-WebRequest -Uri "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.zip" -OutFile $zip; Expand-Archive -Path $zip -DestinationPath $tmp -Force; $fontDir = "$env:LOCALAPPDATA\Microsoft\Windows\Fonts"; New-Item -ItemType Directory -Force -Path $fontDir | Out-Null; Get-ChildItem -Path $tmp -Filter "*.ttf" | ForEach-Object { $dest = Join-Path $fontDir $_.Name; Copy-Item $_.FullName -Destination $dest -Force; $name = $_.BaseName + " (TrueType)"; New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts" -Name $name -Value $dest -PropertyType String -Force | Out-Null }; Write-Host "Installed: $((Get-ChildItem $fontDir -Filter '*.ttf').Count) TTF files"
```

Что делает:
1. Скачивает `JetBrainsMono.zip` с GitHub Releases Nerd Fonts.
2. Распаковывает во временную папку.
3. Копирует все `.ttf` в `%LOCALAPPDATA%\Microsoft\Windows\Fonts` (per-user
   папка шрифтов на Windows 10+, не требует админа).
4. Регистрирует каждый шрифт в реестре `HKCU` — без этого Windows их не
   увидит.

Должен вывести что-то вроде `Installed: 24 TTF files`.

Проверка:

```powershell
[System.Reflection.Assembly]::LoadWithPartialName("System.Drawing"); (New-Object System.Drawing.Text.InstalledFontCollection).Families | Where-Object { $_.Name -like "*JetBrains*" } | Select-Object Name
```

Должен показать длинный список:
- `JetBrainsMono NF` — Nerd Font (символы шире одной ячейки).
- `JetBrainsMono NFM` — **Nerd Font Mono** (иконки в одну ячейку — это нужно для терминала).
- `JetBrainsMono NFP` — Proportional (для текста, не для терминала).
- `NL` варианты — без лигатур.

Нам нужен **`JetBrainsMono NFM`**.

---

## Часть 2: WSL-сторона

Открой Windows Terminal → стрелка `∨` рядом с `+` → выбери свой WSL-дистрибутив.
Все команды ниже — в bash внутри WSL.

### 2.1. Обновить систему

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2. Базовые пакеты

```bash
sudo apt install -y ripgrep fd-find unzip curl git build-essential python3-pip python3-venv xclip
```

Что и зачем:
- `ripgrep`, `fd-find` — быстрый поиск (Telescope их использует).
- `unzip`, `curl` — для скачивания и распаковки.
- `git` — должен быть, но на всякий случай.
- `build-essential` — gcc/make для компиляции Treesitter-парсеров.
- `python3-pip`, `python3-venv` — для Python-LSP и Mason.
- `xclip` — запасной канал буфера обмена (основной будет через win32yank).

### 2.3. Node.js LTS

Через NodeSource — в репах Ubuntu обычно старая версия.

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

Нужен для нескольких LSP-серверов (TypeScript, JSON, YAML и т.д.).

### 2.4. Neovim 0.10+ из официального tarball

В репах Ubuntu 24.04 nvim 0.9.5, а AstroNvim v4 требует ≥ 0.10. Ставим
prebuilt бинарь:

```bash
curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz
sudo rm -rf /opt/nvim && sudo tar -C /opt -xzf nvim-linux-x86_64.tar.gz
echo 'export PATH="$PATH:/opt/nvim-linux-x86_64/bin"' >> ~/.bashrc && source ~/.bashrc
rm nvim-linux-x86_64.tar.gz
```

Проверка: `nvim --version | head -n 1` → должно быть `NVIM v0.10.x` или
выше.

### 2.5. lazygit

В стандартных репах Ubuntu 24.04 lazygit нет. Ставим из релиза:

```bash
LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\K[^"]*') && curl -Lo lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz" && tar xf lazygit.tar.gz lazygit && sudo install lazygit /usr/local/bin && rm lazygit lazygit.tar.gz
```

AstroNvim вызывает lazygit по `<leader>gg` или через `<leader>tl`.

### 2.6. win32yank — мост буфера обмена WSL ↔ Windows

Без этого `y` в nvim не попадает в Windows-буфер.

```bash
curl -sLo /tmp/win32yank.zip https://github.com/equalsraf/win32yank/releases/latest/download/win32yank-x64.zip && unzip -p /tmp/win32yank.zip win32yank.exe > /tmp/win32yank.exe && chmod +x /tmp/win32yank.exe && sudo mv /tmp/win32yank.exe /usr/local/bin/ && rm /tmp/win32yank.zip
```

`/usr/local/bin/win32yank.exe` — WSL умеет запускать `.exe` напрямую,
Neovim автоматически подхватывает его как clipboard provider.

### 2.7. Симлинк для `fd`

В Ubuntu пакет `fd-find` ставит бинарь как `fdfind` (конфликт с другим
пакетом). Telescope ждёт имя `fd`:

```bash
mkdir -p ~/.local/bin && ln -sf $(which fdfind) ~/.local/bin/fd
```

`~/.local/bin` уже в PATH по умолчанию в Ubuntu 24.04.

### 2.8. Проверка зависимостей

```bash
nvim --version | head -n 1
lazygit --version
node --version
rg --version | head -n 1
fd --version
which win32yank.exe
```

Должны видеть версии всех инструментов и путь к win32yank.

---

## Часть 3: AstroNvim

### 3.1. Бэкап старого конфига (если есть)

AstroNvim не любит, когда в стандартных папках уже что-то лежит:

```bash
[ -d ~/.config/nvim ] && mv ~/.config/nvim ~/.config/nvim.bak
[ -d ~/.local/share/nvim ] && mv ~/.local/share/nvim ~/.local/share/nvim.bak
[ -d ~/.local/state/nvim ] && mv ~/.local/state/nvim ~/.local/state/nvim.bak
[ -d ~/.cache/nvim ] && mv ~/.cache/nvim ~/.cache/nvim.bak
```

### 3.2. Клонировать AstroNvim v4 template

```bash
git clone --depth 1 https://github.com/AstroNvim/template ~/.config/nvim
rm -rf ~/.config/nvim/.git
```

Удаление `.git` нужно, чтобы потом этот конфиг можно было класть в свой
репозиторий, если захочешь синхронизировать между машинами.

### 3.3. Первый запуск

```bash
nvim
```

При первом запуске `lazy.nvim` сам скачает ~30–50 плагинов. Жди 1–3 минуты,
пока бегут зелёные/жёлтые строки. Когда закончит — нажми Enter, потом
`:q` чтобы выйти.

Запусти второй раз — теперь Mason доустановит LSP-серверы и форматтеры.
Это ещё 1–2 минуты.

---

## Часть 4: настройка Windows Terminal

### 4.1. Шрифт (для всех профилей)

1. Открой Windows Terminal.
2. Открой настройки: стрелка `∨` рядом с `+` → **Settings** (или `Ctrl + ,`
   при активном окне WT — важно, чтобы фокус был именно на WT).
3. Слева под **Профили** → **По умолчанию** → **Оформление**.
4. **Начертание шрифта** → `JetBrainsMono NFM` (если нет в списке — поставь
   галочку **«Показать все шрифты»**).
5. **Размер шрифта** → 12 (или на вкус).

### 4.2. Default profile = Ubuntu

Слева → **Запуск** → **Профиль по умолчанию** → выбери свой Linux-дистрибутив.
Теперь Windows Terminal при запуске сразу будет открывать WSL.

### 4.3. Сохрани

Кнопка **Сохранить** внизу справа.

### 4.4. Перезапусти

**Полностью закрой** все окна Windows Terminal (важно — без этого новый
шрифт не применится), открой заново.

### Альтернатива: через JSON

Если GUI не работает — можно редактировать конфиг напрямую:

```powershell
nvim "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json"
```

В блоке `"profiles": { "defaults": { ... } }` добавь:

```json
"defaults":
{
    "font":
    {
        "face": "JetBrainsMono NFM",
        "size": 12
    }
},
```

---

## Часть 5: проверка работоспособности

### 5.1. Иконки

В Ubuntu-вкладке Windows Terminal:

```bash
cd ~/<твой репозиторий> && nvim
```

В дереве файлов слева должны быть видны: иконки папок, питон-логотип у
`.py`, докер-иконка у `Dockerfile`, иконка markdown у `.md`. Если вместо
них квадратики или `?` — шрифт не применился. Проверь шаг 4.

Можно проверить рендер шрифта отдельно — выйди из nvim и в bash:

```bash
python3 -c "print('  ')"
```

Должен напечатать три иконки: файл, папка, питон. Если квадратики — шрифт
не подключён в Windows Terminal.

### 5.2. Буфер обмена

Внутри nvim:
1. Открой любой файл.
2. Поставь курсор на слово (стрелочками или `h j k l`).
3. Нажми `yiw` (yank inner word).
4. Переключись в любое Windows-приложение (Блокнот, браузер).
5. `Ctrl + V` — должно вставиться скопированное слово.

Если работает — мост через `win32yank.exe` собран правильно.

### 5.3. Healthcheck

Внутри nvim:

```
:checkhealth astrocore
:checkhealth mason
```

`astrocore` должен быть полностью OK. У `mason` обязательно зелёные галочки
у `python`, `node`, `npm`, `pip`, `python venv`, `git`, `cc/gcc`, `unzip`,
`curl`. Жёлтые WARNING про Go, Ruby, PHP, Java, Julia — игнорировать,
если не пишешь на них.

`:checkhealth` без аргументов покажет всё. Игнорируй ошибки про:
- `luarocks` — большинству плагинов не нужен;
- `kitty/wezterm/ghostty`, `magick/convert` — рендер картинок в терминале,
  Windows Terminal такого не умеет в принципе;
- `tectonic/pdflatex`, `mmdc` — LaTeX/Mermaid превью.

---

## Базовые шорткаты для старта

Leader-клавиша в AstroNvim — **пробел**. Когда нажмёшь `<Space>` в normal
mode и подождёшь, снизу появится cheatsheet.

| Шорткат | Что |
|---|---|
| `<Space>` | Главное меню AstroNvim |
| `<Space>ff` | **F**ind **f**ile — поиск файла по имени (Telescope) |
| `<Space>fw` | **F**ind **w**ord — grep по содержимому (live grep) |
| `<Space>fb` | **F**ind **b**uffer — переключение между открытыми файлами |
| `<Space>e` | Открыть/закрыть дерево файлов слева (Neo-tree) |
| `F7` | Плавающий терминал |
| `<Space>tf` | То же |
| `<Space>th` | Терминал горизонтальным сплитом |
| `<Space>tv` | Терминал вертикальным сплитом |
| `<Space>tl` | Lazygit внутри nvim |
| `<Space>gg` | То же |
| `<Space>w` | **W**rite — сохранить |
| `<Space>q` | **Q**uit — выйти |
| `<Space>c` | **C**lose buffer — закрыть текущий файл |
| `gd` | **G**oto **d**efinition (LSP) |
| `K` | Hover-документация (LSP) |
| `<Space>la` | LSP **a**ction — рефакторинги |

Выйти из режима терминала в normal mode: `Ctrl+\` потом `Ctrl+n`.

---

## Возможные грабли

**`Ctrl + ,` не открывает настройки Windows Terminal.**
Фокус должен быть на окне Windows Terminal. Если активно VS Code, IDE или
другое приложение с тем же шорткатом — открывается оно. Кликни мышкой по
окну WT и повтори.

**Иконки `?` после установки шрифта.**
Windows Terminal не перечитал шрифты. Полностью закрой все его окна и
открой заново. Если не помогло — проверь, что выбран именно `JetBrainsMono
NFM` (с буквой M), а не `JetBrainsMono NF`.

**Long-running команды в WSL медленно стартуют.**
Если кажется, что `apt`, `curl` тормозят — это нормально на первом запуске
WSL после загрузки Windows. Дай WSL прогреться 5–10 секунд.

**`echo -e "\uXXXX"` в bash не печатает Unicode.**
Это особенность bash. Используй `printf '\uXXXX\n'` или
`python3 -c "print('\uXXXX')"`.

**Шрифт в выпадающем списке Windows Terminal отсутствует.**
Поставь галочку **«Показать все шрифты»** — по умолчанию WT фильтрует только
моноширинные, но Nerd Font Mono (`NFM`) иногда не помечается как моно в
метаданных шрифта.

---

## Что не входит в этот гайд

- **LSP под конкретный язык** (Python pyright + ruff, TypeScript и т.д.) —
  настраивается в `~/.config/nvim/lua/plugins/` отдельно.
- **Свой конфиг в git** — после установки шаблона можно вынести
  `~/.config/nvim` в свой репозиторий и синхронизировать между машинами.
- **Темы и UI tweaks** — AstroNvim из коробки достаточно красив; темы
  меняются через `<Space>ft` (find theme).

Если что-то из этого понадобится — добавится отдельным разделом или
отдельным файлом.
