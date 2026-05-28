# AI のための Linux

> AI の多くは Linux 上で動きます。詰まらず作業できるだけの知識が必要です。

**種類:** 学習
**言語:** --
**前提条件:** フェーズ 0、レッスン 01
**時間:** 約 30 分

## 学習目標

- Linux のファイルシステムを移動し、コマンドラインから基本的なファイル操作を行う
- `chmod` と `chown` でファイル権限を管理し、"Permission denied" エラーを解決する
- `apt` でシステムパッケージをインストールし、新しい GPU マシンを AI 作業用にセットアップする
- リモートマシンで作業する開発者がつまずきやすい macOS と Linux の違いを見分ける

## 問題

普段は macOS や Windows で開発していても、クラウド GPU マシンに SSH したり、Lambda インスタンスを借りたり、EC2 マシンを立ち上げたりした瞬間、Ubuntu に入ることになります。使えるインターフェイスはターミナルだけです。Finder も Explorer も GUI もありません。コマンドラインでファイルシステムを移動し、パッケージをインストールし、プロセスを管理できなければ、アイドル状態の GPU にお金を払いながら「Linux でファイルを unzip する方法」を検索することになります。

これはサバイバルガイドです。AI 作業のためにリモート Linux マシンを扱ううえで必要なことだけを扱います。それ以上は扱いません。

## ファイルシステムの構成

Linux ではすべてが単一のルート `/` の下に整理されます。`C:\` や `/Volumes` はありません。実際によく触るディレクトリは次のとおりです。

```mermaid
graph TD
    root["/"] --> home["home/your-username/<br/>Your files — clone repos, run training"]
    root --> tmp["tmp/<br/>Temporary files, cleared on reboot"]
    root --> usr["usr/<br/>System programs and libraries"]
    root --> etc["etc/<br/>Config files"]
    root --> varlog["var/log/<br/>Logs — check when something breaks"]
    root --> mnt["mnt/ or /media/<br/>External drives and volumes"]
    root --> proc["proc/ and /sys/<br/>Virtual files — kernel and hardware info"]
```

ホームディレクトリは `~` または `/home/your-username` です。ほとんどの作業はここで行います。

## 必須コマンド

リモート GPU マシンで行う作業の 95% は、次の 15 個のコマンドでカバーできます。

### 移動

```bash
pwd                         # Where am I?
ls                          # What's here?
ls -la                      # What's here, including hidden files with details?
cd /path/to/dir             # Go there
cd ~                        # Go home
cd ..                       # Go up one level
```

### ファイルとディレクトリ

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

`rm -rf` は元に戻せません。取り消しはありません。Enter を押す前にパスを必ず確認してください。

### ファイルを読む

```bash
cat file.txt                # Print entire file
head -20 file.txt           # First 20 lines
tail -20 file.txt           # Last 20 lines
tail -f log.txt             # Follow a log file in real time (Ctrl+C to stop)
less file.txt               # Scroll through a file (q to quit)
```

### 検索

```bash
grep "error" training.log           # Find lines containing "error"
grep -r "learning_rate" .           # Search all files in current directory
grep -i "cuda" config.yaml          # Case-insensitive search

find . -name "*.py"                 # Find all Python files under current dir
find . -name "*.ckpt" -size +1G     # Find checkpoint files larger than 1GB
```

## 権限

Linux のすべてのファイルには所有者と権限ビットがあります。スクリプトを実行できないときや、ディレクトリに書き込めないときにここでつまずきます。

```bash
ls -l train.py
# -rwxr-xr-- 1 user group 2048 Mar 19 10:00 train.py
#  ^^^             owner permissions: read, write, execute
#     ^^^          group permissions: read, execute
#        ^^        everyone else: read only
```

よく使う修正は次のとおりです。

```bash
chmod +x train.sh           # Make a script executable
chmod 755 deploy.sh         # Owner: full, others: read+execute
chmod 644 config.yaml       # Owner: read+write, others: read only

chown user:group file.txt   # Change who owns a file (needs sudo)
```

"Permission denied" と表示される場合、ほとんどは権限の問題です。多くの場合は `chmod +x` か `sudo` で解決できます。

## パッケージ管理（apt）

Ubuntu は `apt` を使います。システムレベルのソフトウェアはこれでインストールします。

```bash
sudo apt update             # Refresh the package list (always do this first)
sudo apt install -y htop    # Install a package (-y skips confirmation)
sudo apt install -y build-essential  # C compiler, make, etc. Needed by many Python packages
sudo apt install -y tmux    # Terminal multiplexer (keep sessions alive after disconnect)

apt list --installed        # What's installed?
sudo apt remove htop        # Uninstall
```

新しい GPU マシンでよくインストールするパッケージは次のとおりです。

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

## ユーザーと sudo

通常は一般ユーザーとしてログインしています。一部の操作には root（管理者）権限が必要です。

```bash
whoami                      # What user am I?
sudo command                # Run a single command as root
sudo su                     # Become root (exit to go back, use sparingly)
```

クラウド GPU インスタンスでは、通常は自分だけがユーザーで、すでに sudo 権限があります。すべてを root で実行しないでください。必要なときだけ sudo を使います。

## プロセスと systemd

トレーニングが止まったように見えるときや、何が動いているか確認したいときは次を使います。

```bash
htop                        # Interactive process viewer (q to quit)
ps aux | grep python        # Find running Python processes
kill 12345                  # Gracefully stop process with PID 12345
kill -9 12345               # Force kill (use when graceful doesn't work)
nvidia-smi                  # GPU processes and memory usage
```

systemd はサービス（バックグラウンドデーモン）を管理します。推論サーバーを動かす場合に使うことがあります。

```bash
sudo systemctl start nginx          # Start a service
sudo systemctl stop nginx           # Stop it
sudo systemctl restart nginx        # Restart it
sudo systemctl status nginx         # Check if it's running
sudo systemctl enable nginx         # Start automatically on boot
```

## ディスク容量

GPU マシンはディスク容量が限られていることがよくあります。モデルとデータセットはすぐに容量を埋めます。

```bash
df -h                       # Disk usage for all mounted drives
df -h /home                 # Disk usage for /home specifically

du -sh *                    # Size of each item in current directory
du -sh ~/.cache             # Size of your cache (pip, huggingface models land here)
du -sh /data/checkpoints/   # Check how big your checkpoints are

# Find the biggest space hogs
du -h --max-depth=1 / 2>/dev/null | sort -hr | head -20
```

容量を空けるときによく使う方法は次のとおりです。

```bash
# Clear pip cache
pip cache purge

# Clear apt cache
sudo apt clean

# Remove old checkpoints you don't need
rm -rf checkpoints/epoch_01/ checkpoints/epoch_02/
```

## ネットワーク

コマンドラインからモデルをダウンロードし、ファイルを転送し、API にアクセスします。

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

大きなものには `scp` より `rsync` を使います。変更されたバイトだけを転送し、接続が中断されても再開できます。

## tmux: セッションを維持する

リモートマシンに SSH しているときにノート PC を閉じると、トレーニング実行も止まります。tmux はこれを防ぎます。

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

長いトレーニングジョブは必ず tmux の中で実行してください。必ずです。

## Windows ユーザー向け WSL2

Windows を使っている場合、WSL2 を使うとデュアルブートせずに本物の Linux 環境を使えます。

```bash
# In PowerShell (admin)
wsl --install -d Ubuntu-24.04

# After restart, open Ubuntu from Start menu
sudo apt update && sudo apt upgrade -y
```

WSL2 は本物の Linux カーネルを実行します。このレッスンの内容はすべて WSL 内でも動きます。WSL の中から見ると、Windows 側のファイルは `/mnt/c/Users/YourName/` にあります。

GPU パススルーは、Windows 側に NVIDIA ドライバーをインストールしていれば動作します。Linux 用ではなく Windows 用の NVIDIA ドライバーをインストールすると、WSL2 内で CUDA が使えるようになります。

## 注意点: macOS から Linux へ

macOS から来た人がつまずきやすい点は次のとおりです。

| macOS | Linux | メモ |
|-------|-------|------|
| `brew install` | `sudo apt install` | パッケージ名が違うことがあります。`brew install htop` と `sudo apt install htop` は同じように動きますが、`brew install readline` と `sudo apt install libreadline-dev` は違います。 |
| `open file.txt` | `xdg-open file.txt` | ただし、リモートマシンには GUI がないことが多いです。`cat` や `less` を使います。 |
| `pbcopy` / `pbpaste` | 利用不可 | SSH 越しではクリップボードとのパイプ入出力は使えません。 |
| `~/.zshrc` | `~/.bashrc` | macOS のデフォルトは zsh です。多くの Linux サーバーは bash を使います。 |
| `/opt/homebrew/` | `/usr/bin/`, `/usr/local/bin/` | バイナリの置き場所が違います。 |
| `sed -i '' 's/a/b/' file` | `sed -i 's/a/b/' file` | macOS の sed は `-i` の後に空文字列が必要です。Linux では不要です。 |
| 大文字小文字を区別しないファイルシステム | 大文字小文字を区別するファイルシステム | Linux では `Model.py` と `model.py` は別ファイルです。 |
| 改行コード `\n` | 改行コード `\n` | 同じです。ただし Windows は `\r\n` を使うため、bash スクリプトが壊れることがあります。`dos2unix` で修正します。 |

## クイックリファレンス

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

## 演習

1. 任意の Linux マシンに SSH する（または WSL2 を開く）。ホームディレクトリに移動し、プロジェクトフォルダを作り、その中に `touch` で空ファイルを 3 つ作成してから、`ls -la` で一覧表示してください。
2. apt で `htop` をインストールして実行し、どのプロセスが最も多くメモリを使っているか確認してください。
3. tmux セッションを開始し、その中で `sleep 300` を実行し、デタッチして、セッション一覧を表示し、再アタッチしてください。
4. `df -h` で利用可能なディスク容量を確認し、`du -sh ~/.cache/*` でキャッシュ内の何が容量を使っているか調べてください。
5. `scp` を使ってローカルマシンからリモートマシンへファイルを転送し、同じ転送を `rsync` でも行って使い勝手を比較してください。
