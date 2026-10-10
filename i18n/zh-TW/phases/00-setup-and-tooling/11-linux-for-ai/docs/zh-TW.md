# Linux 與 AI

> 大多數 AI 都在 Linux 上跑。你要懂到不會被卡住的程度。

**Type:** Learn
**Languages:** --
**Prerequisites:** Phase 0, Lesson 01
**Time:** ~30 minutes

## Learning Objectives｜學習目標

- 在命令列上瀏覽 Linux 檔案系統（filesystem），並執行基本的檔案操作
- 使用 `chmod` 和 `chown` 管理檔案權限（file permission），解決「Permission denied」錯誤
- 使用 `apt` 安裝系統套件（system package），並把一台全新的 GPU 機器設定成可做 AI 工作
- 辨識遠端機器開發時常讓人踩雷的 macOS 與 Linux 差異

## The Problem｜問題

你在 macOS 或 Windows 上開發。但只要用 SSH 連上雲端 GPU（cloud GPU） 機器、租用 Lambda 執行個體，或開一台 EC2 機器，你就會進入 Ubuntu 環境。終端機是你唯一的介面（interface）——沒有 Finder、沒有檔案總管、沒有 GUI。如果你不會在命令列上瀏覽檔案系統、安裝套件、管理行程（process），就只能一邊支付 GPU 閒置期間的費用，一邊搜尋「Linux 怎麼解壓縮檔案」。

這是一份生存指南，只講在遠端 Linux 機器上做 AI 工作需要的東西，不多不少。

## 檔案系統目錄結構

Linux 把所有東西都組織在單一根目錄 `/` 之下。沒有 `C:\`，也沒有 `/Volumes`。你實際會用到的目錄：

```mermaid
graph TD
    root["/"] --> home["home/your-username/<br/>你的檔案——clone 儲存庫、跑訓練"]
    root --> tmp["tmp/<br/>暫存檔案，重新開機就清空"]
    root --> usr["usr/<br/>系統程式與函式庫"]
    root --> etc["etc/<br/>設定檔"]
    root --> varlog["var/log/<br/>日誌——出問題時看這裡"]
    root --> mnt["mnt/ 或 /media/<br/>外接磁碟與磁碟區"]
    root --> proc["proc/ 和 /sys/<br/>虛擬檔案——核心與硬體資訊"]
```

你的家目錄（home directory）是 `~` 或 `/home/your-username`。你做的事幾乎都發生在這裡。

## 必備指令

以下 15 個指令，涵蓋你在遠端 GPU 機器上 95% 的工作。

### 移動位置

```bash
pwd                         # Where am I?
ls                          # What's here?
ls -la                      # What's here, including hidden files with details?
cd /path/to/dir             # Go there
cd ~                        # Go home
cd ..                       # Go up one level
```

### 檔案與目錄

```bash
mkdir my-project            # Create a directory
mkdir -p a/b/c              # Create nested directories in one shot

cp file.txt backup.txt      # Copy a file
cp -r src/ src-backup/      # Copy a directory (recursive)

mv old.txt new.txt          # Rename a file
mv file.txt /tmp/           # Move a file

rm file.txt                 # Delete a file (no trash, it's gone)
rm -rf my-dir/              # Delete a directory and everything inside
```

`rm -rf` 是永久刪除，沒有復原。按下 Enter 之前，先確認路徑。

### 讀取檔案

```bash
cat file.txt                # Print entire file
head -20 file.txt           # First 20 lines
tail -20 file.txt           # Last 20 lines
tail -f log.txt             # Follow a log file in real time (Ctrl+C to stop)
less file.txt               # Scroll through a file (q to quit)
```

### 搜尋

```bash
grep "error" training.log           # Find lines containing "error"
grep -r "learning_rate" .           # Search all files in current directory
grep -i "cuda" config.yaml          # Case-insensitive search

find . -name "*.py"                 # Find all Python files under current dir
find . -name "*.ckpt" -size +1G     # Find checkpoint files larger than 1GB
```

## 權限

Linux 中每個檔案都有擁有者和權限位元。當程式檔案無法執行、或你無法寫入某個目錄時，就會碰上它。

```bash
ls -l train.py
# -rwxr-xr-- 1 user group 2048 Mar 19 10:00 train.py
#  ^^^             owner permissions: read, write, execute
#     ^^^          group permissions: read, execute
#        ^^        everyone else: read only
```

常見修正：

```bash
chmod +x train.sh           # Make a script executable
chmod 755 deploy.sh         # Owner: full, others: read+execute
chmod 644 config.yaml       # Owner: read+write, others: read only

chown user:group file.txt   # Change who owns a file (needs sudo)
```

看到「Permission denied」時，幾乎都是權限問題。`chmod +x` 或 `sudo` 可以解決大部分情況。

## 套件管理（apt）

Ubuntu 使用 `apt`，用來安裝系統層級的軟體（software）。

```bash
sudo apt update             # Refresh the package list (always do this first)
sudo apt install -y htop    # Install a package (-y skips confirmation)
sudo apt install -y build-essential  # C compiler, make, etc. Needed by many Python packages
sudo apt install -y tmux    # Terminal multiplexer (keep sessions alive after disconnect)

apt list --installed        # What's installed?
sudo apt remove htop        # Uninstall
```

在一台全新 GPU 機器上常會安裝的套件：

```bash
sudo apt update && sudo apt install -y \
    build-essential \
    git \
    curl \
    wget \
    tmux \
    htop \
    unzip \
    python3-venv
```

## 使用者與 sudo

你通常是以一般使用者身分登入。某些操作需要 root（管理者）權限。

```bash
whoami                      # What user am I?
sudo command                # Run a single command as root
sudo su                     # Become root (exit to go back, use sparingly)
```

在雲端 GPU（cloud GPU） 執行個體上，你通常是唯一的使用者，而且已經有 sudo 權限。不要什麼都用 root 跑，需要時才用 sudo。

## 行程與 systemd

當訓練卡住、或你想查看正在執行的東西時：

```bash
htop                        # Interactive process viewer (q to quit)
ps aux | grep python        # Find running Python processes
kill 12345                  # Gracefully stop process with PID 12345
kill -9 12345               # Force kill (use when graceful doesn't work)
nvidia-smi                  # GPU processes and memory usage
```

systemd 管理服務（service；背景常駐程式 daemon）。你跑推論（inference）伺服器時會用到：

```bash
sudo systemctl start nginx          # Start a service
sudo systemctl stop nginx           # Stop it
sudo systemctl restart nginx        # Restart it
sudo systemctl status nginx         # Check if it's running
sudo systemctl enable nginx         # Start automatically on boot
```

## 磁碟空間

GPU 機器的磁碟空間（disk space）通常有限，模型和資料集很快就把空間吃光。

```bash
df -h                       # Disk usage for all mounted drives
df -h /home                 # Disk usage for /home specifically

du -sh *                    # Size of each item in current directory
du -sh ~/.cache             # Size of your cache (pip, huggingface models land here)
du -sh /data/checkpoints/   # Check how big your checkpoints are

# Find the biggest space hogs
du -h --max-depth=1 / 2>/dev/null | sort -hr | head -20
```

常用的清出空間方法：

```bash
# Clear pip cache
pip cache purge

# Clear apt cache
sudo apt clean

# Remove old checkpoints you don't need
rm -rf checkpoints/epoch_01/ checkpoints/epoch_02/
```

## 網路

你會在命令列上下載模型、傳輸檔案、呼叫 API。

```bash
# Download files
wget https://example.com/model.bin                   # Download a file
curl -O https://example.com/data.tar.gz              # Same thing with curl
curl -s https://api.example.com/health | python3 -m json.tool  # Hit an API, pretty-print JSON

# Transfer files between machines
scp model.bin user@remote:/data/                     # Copy file to remote machine
scp user@remote:/data/results.csv .                  # Copy file from remote to local
scp -r user@remote:/data/checkpoints/ ./local-dir/   # Copy directory

# Sync directories (faster than scp for large transfers, resumes on failure)
rsync -avz --progress ./data/ user@remote:/data/
rsync -avz --progress user@remote:/results/ ./results/
```

大型檔案一律用 `rsync` 而不是 `scp`——它只傳輸有變動的部分，連線中斷也能接續。

## tmux：讓工作階段繼續存活

SSH 連上遠端機器後，闔上筆電就會殺掉你的訓練作業。tmux 可以解決這個問題。

```bash
tmux new -s train           # Start a new session named "train"
# ... start your training, then:
# Ctrl+B, then D            # Detach (training keeps running)

tmux ls                     # List sessions
tmux attach -t train        # Reattach to session

# Inside tmux:
# Ctrl+B, then %            # Split pane vertically
# Ctrl+B, then "            # Split pane horizontally
# Ctrl+B, then arrow keys   # Switch between panes
```

長時間的訓練作業一律放在 tmux 裡跑。一律。

## Windows 使用者的 WSL2

如果你用 Windows，WSL2 能給你一個真正的 Linux 環境，不用做雙重開機（dual boot）。

```bash
# In PowerShell (admin)
wsl --install -d Ubuntu-24.04

# After restart, open Ubuntu from Start menu
sudo apt update && sudo apt upgrade -y
```

WSL2 跑的是真正的 Linux 核心（kernel），本課所有內容都能在其中使用。從 WSL 內部看，你的 Windows 檔案位於 `/mnt/c/Users/YourName/`。

在 Windows 端安裝 NVIDIA 驅動程式（driver）後，GPU 直通（GPU passthrough）就能運作。請安裝 Windows 版 NVIDIA 驅動程式（driver）（不是 Linux 版），WSL2 內就能使用 CUDA。

## 注意事項：從 macOS 到 Linux

如果你習慣 macOS，以下幾點會讓你踩雷：

| macOS | Linux | 說明 |
|-------|-------|-------|
| `brew install` | `sudo apt install` | 套件名稱有時不同。`brew install htop` 和 `sudo apt install htop` 用法相同，但 `brew install readline` 對應的是 `sudo apt install libreadline-dev`。 |
| `open file.txt` | `xdg-open file.txt` | 但遠端機器上不會有 GUI。用 `cat` 或 `less`。 |
| `pbcopy` / `pbpaste` | 沒有 | 透過 SSH 無法對剪貼簿（clipboard）做管線操作。 |
| `~/.zshrc` | `~/.bashrc` | macOS 預設使用 zsh；多數 Linux 伺服器使用 bash。 |
| `/opt/homebrew/` | `/usr/bin/`、`/usr/local/bin/` | 執行檔放的位置不同。 |
| `sed -i '' 's/a/b/' file` | `sed -i 's/a/b/' file` | macOS 的 sed 需要在 `-i` 後加空字串；Linux 不用。 |
| 不區分大小寫（case-sensitive）的檔案系統 | 區分大小寫（case-sensitive）的檔案系統 | 在 Linux 上，`Model.py` 和 `model.py` 是兩個不同的檔案。 |
| 換行符號 `\n` | 換行符號 `\n` | 相同。但 Windows 使用 `\r\n`，會讓 bash 程式檔案壞掉。用 `dos2unix` 修復。 |

## 速查卡

```
Navigation:     pwd, ls, cd, find
Files:          cp, mv, rm, mkdir, cat, head, tail, less
Search:         grep, find
Permissions:    chmod, chown, sudo
Packages:       apt update, apt install
Processes:      htop, ps, kill, nvidia-smi
Services:       systemctl start/stop/restart/status
Disk:           df -h, du -sh
Network:        curl, wget, scp, rsync
Sessions:       tmux new/attach/detach
```

```figure
s0-process-fork
```

## Exercises｜練習

1. SSH 進任一台 Linux 機器（或打開 WSL2），切換到你的家目錄。建立一個專案（project）資料夾，在裡面用 `touch` 建三個空檔案，再用 `ls -la` 列出來。
2. 用 apt 安裝 `htop`，執行它，找出哪個行程用了最多記憶體（memory）。
3. 開一個 tmux 工作階段，在裡面執行 `sleep 300`，然後分離、列出工作階段、再重新連接。
4. 用 `df -h` 查看可用磁碟空間，再用 `du -sh ~/.cache/*` 找出快取（cache）裡什麼東西在佔空間。
5. 用 `scp` 把一個檔案從本機傳到遠端機器，再用 `rsync` 做同樣的傳輸，比較兩者的體驗。
