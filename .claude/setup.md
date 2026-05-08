# Памятка: настройка проекта на новой Windows-машине

Эти шаги мы прошли один раз вместе. Этот документ — чтобы быстро повторить
их на любой Windows-машине, с которой будем работать. Делается всё тобой
в терминале и GUI; Claude только подсказывает и проверяет.

## Prerequisites (должно быть на машине)

- Windows 10 build 19041+ или Windows 11 (для WSL2).
- **Cursor** (Windows GUI) — где живёт редактор.
- **Claude Desktop** (Windows GUI) — где запускается Claude.
- **Git for Windows** (Git Bash) — нужен на старте, до настройки WSL.

## Шаги

### 1. WSL2 + Ubuntu

Проверить, что есть:

```powershell
wsl --status
```
- **Где:** PowerShell.

Если WSL не установлен или нет дистрибутива:

```powershell
wsl --install -d Ubuntu-24.04
```
- **Где:** PowerShell **от администратора**.
- После установки потребуется ребут.
- На первом запуске Ubuntu попросит создать UNIX-пользователя и пароль
  (строчные латинские буквы, без пробелов).

### 2. Базовая проверка Ubuntu

```bash
whoami && pwd && uname -a && ls -la ~
```
- **Где:** Ubuntu shell.
- В выводе `uname -a` должно быть `microsoft-standard-WSL2`.
- Запомнить имя пользователя — оно понадобится для UNC-путей.

### 3. Git identity в WSL

Проверить:

```bash
cat ~/.gitconfig
```

Если пусто или нужна правка — настроить:

```bash
git config --global user.name "PavelEgorov-ru"
git config --global user.email "<твой email на GitHub>"
git config --global init.defaultBranch main
git config --global pull.rebase false
```
- **Где:** Ubuntu shell.

### 4. SSH-ключ для GitHub

Проверить, есть ли уже:

```bash
ls -la ~/.ssh/
```
- Ищем `id_ed25519` (или `id_rsa`) и одноимённый `.pub`.

Если ключа нет — сгенерировать:

```bash
ssh-keygen -t ed25519 -C "<твой email>"
```
- **Где:** Ubuntu shell.
- На все вопросы — Enter (без passphrase) или задать passphrase по желанию.

Показать публичный ключ:

```bash
cat ~/.ssh/id_ed25519.pub
```
- Скопировать вывод и добавить на https://github.com/settings/ssh/new
  (вручную через браузер; Claude в этом не помогает).

Проверить, что GitHub принимает:

```bash
ssh -T git@github.com
```
- На вопрос про fingerprint при первом подключении ответить `yes`.
- **Успех:** `Hi PavelEgorov-ru! You've successfully authenticated...`.

### 5. Склонировать форк и переключиться на `dev`

```bash
cd ~ && git clone git@github.com:PavelEgorov-ru/ai-engineering-from-scratch.git
```
- **Где:** Ubuntu shell. Клон ляжет в `~/ai-engineering-from-scratch`
  (Linux-FS, не `/mnt/c/...`).

```bash
cd ~/ai-engineering-from-scratch && git checkout dev
```
- Создаст локальную ветку `dev`, отслеживающую `origin/dev`.
- На `dev` лежат правила (`.claude/CLAUDE.md`) и эта памятка.

### 6. Cursor + WSL

В Cursor (Windows GUI):

1. **Поставить расширение WSL.** `Ctrl+Shift+X` → искать `WSL` → ставить
   расширение от **Anysphere** с описанием «Open any folder in the
   Windows Subsystem for Linux».
2. **Открыть пустое окно.** `Ctrl+Shift+N` (`File → New Window`) — чтобы
   не цеплять текущий workspace.
3. **Подключиться к WSL.** В новом окне: `Ctrl+Shift+P` →
   `WSL: Connect to WSL` → Enter. В левом нижнем углу должно появиться
   `WSL: Ubuntu`.
4. **Открыть папку.** `File → Open Folder` → ввести
   `/home/<твой WSL-юзер>/ai-engineering-from-scratch` → Enter →
   `Yes, I trust the authors`.

### 7. Финальная проверка

В терминале нового Cursor-окна (он откроется в репо):

```bash
pwd && git status && git log --oneline -2
```
- Ожидаем: путь `/home/<user>/ai-engineering-from-scratch`, ветка `dev`,
  `nothing to commit, working tree clean`, верхний коммит —
  `chore(claude): add project working rules`.

## Что после этого делает Claude

- Читает `.claude/CLAUDE.md` (раздел «Окружение и доступ к файлам»).
- Вычисляет имя дистрибутива и пользователя:
  ```
  wsl -l -q
  wsl bash -c "whoami"
  ```
- Дальше обращается к файлам по UNC-пути
  `\\wsl$\<DISTRO>\home\<USER>\ai-engineering-from-scratch\…`.
- Команды с побочными эффектами выдаёт тебе для запуска в WSL-терминале
  Cursor.
