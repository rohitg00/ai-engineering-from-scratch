---
id: git-shell-linux
title: Git, Shell and Linux for AI Work
code: GS
subtitle: Commit and branch, pipe and filter logs, keep runs alive in tmux, move files to a GPU box and fix Linux errors.
hue: 25
sources: phases/00-setup-and-tooling/02-git-and-collaboration, phases/00-setup-and-tooling/10-terminal-and-shell, phases/00-setup-and-tooling/11-linux-for-ai
source_hash: 33bae92371a3e28d
---

## Where git moves your work
type: architecture
from: phases/00-setup-and-tooling/02-git-and-collaboration/docs/en.md

```arch
node | wd | 1,1 | Working Directory | your files | client
node | sa | 2,1 | Staging Area | next commit | queue
node | lr | 3,1 | Local Repo | commits | store
node | r | 4,1 | Remote (GitHub) | your fork | store
edge | wd | sa | git add
edge | sa | lr | git commit
edge | lr | r | git push
edge | r | lr | git fetch
edge | lr | wd | git pull
```

## Git tasks
type: task-table
from: phases/00-setup-and-tooling/02-git-and-collaboration/docs/en.md
span: 2

| Task | Code |
|---|---|
| Set your identity | `git config --global user.name "Your Name"` |
| Save work | `git add file.py` then `git commit -m "<message>"` |
| Back it up | `git push origin main` |
| Branch for an experiment | `git checkout -b experiment/new-optimizer` |
| Merge it back | `git checkout main` then `git merge experiment/new-optimizer` |
| Work on your fork | `git checkout -b my-progress` then `git push -u origin my-progress` |
| History of one phase | `git log --oneline -- phases/00-setup-and-tooling` |
| Files of one commit | `git show --stat <hash>` |

## Pipes and redirects
type: command-table
from: phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md

| Command | What it does |
|---|---|
| `>` | Write stdout to a file (overwrite) |
| `>>` | Append stdout to a file |
| `2>` | Write stderr to a file |
| `2>&1` | Send stderr to the same place as stdout |
| `\|` | Send stdout as stdin to the next command |
| `python train.py > train_full.log 2>&1` | Both streams to one file |
| `python train.py 2>&1 \| tee train.log` | Log and show the output |

## Filter training logs
type: annotated-code
lang: bash
from: phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md

```bash
cat train.log | grep "loss" | wc -l                   # count loss lines
grep "loss:" train.log | awk '{print $NF}' > losses.txt  # last field only
tail -f train.log | grep --line-buffered "ERROR"      # live errors
grep "final_accuracy" results/*.log | sort -t= -k2 -n -r  # best run first
diff <(grep "accuracy" exp1.log) <(grep "accuracy" exp2.log)
find . -name "*.py" | xargs wc -l | tail -1           # project size
env | grep -i cuda                                    # check before a run
```

## tmux sessions
type: task-table
from: phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md, phases/00-setup-and-tooling/11-linux-for-ai/docs/en.md

| Task | Code |
|---|---|
| Start a named session | `tmux new -s training` |
| Split horizontally | `Ctrl+B` then `"` |
| Split vertically | `Ctrl+B` then `%` |
| Move between panes | `Ctrl+B` then arrow keys |
| Detach, run keeps going | `Ctrl+B` then `d` |
| Reattach | `tmux attach -t training` |
| List sessions | `tmux ls` |
| Kill a session | `tmux kill-session -t training` |

## Linux files, permissions, packages
type: command-table
from: phases/00-setup-and-tooling/11-linux-for-ai/docs/en.md
span: 2

| Command | What it does |
|---|---|
| `mkdir -p a/b/c` | Make nested directories |
| `rm -rf my-dir/` | Delete a directory. There is no undo |
| `find . -name "*.ckpt" -size +1G` | Checkpoints larger than 1GB |
| `grep -r "learning_rate" .` | Search all files here |
| `chmod +x train.sh` | Make a script executable |
| `chmod 755 deploy.sh` | Owner full, others read+execute |
| `sudo apt update && sudo apt install -y build-essential git curl wget tmux htop unzip python3-venv` | Fresh GPU box packages |
| `sudo systemctl status nginx` | Check a service. Also `start`, `stop`, `restart`, `enable` |

## Work on a remote GPU box
type: annotated-code
lang: bash
from: phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md, phases/00-setup-and-tooling/11-linux-for-ai/docs/en.md

```bash
ssh -i ~/.ssh/my_gpu_key user@gpu-box-ip       # connect with a key
scp model.pt user@gpu-box-ip:~/models/          # copy to remote
scp user@gpu-box-ip:~/results/metrics.json ./   # copy from remote
rsync -avz --progress ./data/ user@remote:/data/  # changed bytes only
ssh -L 8888:localhost:8888 user@gpu-box-ip      # remote Jupyter on localhost:8888
# ~/.ssh/config: Host gpu, HostName, User, IdentityFile
ssh -G gpu                                      # print the settings SSH uses
ssh gpu                                         # connect by the short name
```

## Troubleshooting
type: troubleshooting
from: phases/00-setup-and-tooling/11-linux-for-ai/docs/en.md, phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| "Permission denied" | Permission bits | `chmod +x` or `sudo` |
| Run dies when the laptop closes | The SSH session ends | Run it inside tmux |
| `sed -i 's/a/b/' file` fails on macOS | macOS sed needs `''` after `-i` | `sed -i '' 's/a/b/' file` |
| Bash script breaks | Windows `\r\n` line endings | Run `dos2unix` |
| File not found on Linux only | Case-sensitive filesystem | `Model.py` and `model.py` differ |
| `pbcopy` not found | Not available over SSH | Use `cat` or `less` |
| No CUDA in WSL2 | Linux driver in WSL | Install the Windows NVIDIA driver |
| Disk full | Models and datasets | `du -sh *`, then clear caches |

## Course aliases
type: concepts
from: phases/00-setup-and-tooling/10-terminal-and-shell/code/shell_aliases.sh, phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md

- **Load them**: `source phases/00-setup-and-tooling/10-terminal-and-shell/code/shell_aliases.sh`
- **`gpu`, `gpumem`, `gpuprocs`**: GPU status, memory and processes as CSV.
- **`ae`, `uvvenv`**: activate `.venv`, or make one with uv and activate it.
- **`watchloss`, `taillog <pattern>`**: follow `logs/*.log` for a pattern.
- **`trainenv <name>`**: tmux session with `nvidia-smi` and `htop` panes.
- **`syncto <host> <remote_path>`**: rsync up. `syncfrom` pulls back.
- **`bigmodels`, `memhogs`**: largest model files, top memory processes.

## Questions
type: qa
from: phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md, phases/00-setup-and-tooling/11-linux-for-ai/docs/en.md, phases/00-setup-and-tooling/02-git-and-collaboration/docs/en.md

- **`&`, `nohup` or tmux?** `nohup` and tmux survive a closed terminal. Only tmux lets you reattach.
- **`rsync` or `scp`?** `rsync` for anything large. It resumes and sends changed bytes.
- **Why fork the course repo?** Only maintainers can push. Your fork is `origin`.
- **Rebase or submodules?** The course does not need them.
- **Run as root?** No. Use `sudo` only when needed.

## Tips
type: tips
from: phases/00-setup-and-tooling/02-git-and-collaboration/docs/en.md, phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md, phases/00-setup-and-tooling/11-linux-for-ai/docs/en.md

- Add `*.pt`, `*.pth` and `*.safetensors` to `.gitignore`.
- Run `sudo apt update` before each install.
- Use tmux for anything longer than a few minutes.
- Double-check the path before `rm -rf`.
- macOS defaults to `~/.zshrc`. Most Linux servers use `~/.bashrc`.

## Run, monitor and free disk
type: command-table
from: phases/00-setup-and-tooling/10-terminal-and-shell/docs/en.md, phases/00-setup-and-tooling/11-linux-for-ai/docs/en.md
span: 2

| Command | What it does |
|---|---|
| `watch -n1 nvidia-smi` | GPU use every second |
| `nvidia-smi --query-compute-apps=pid,name,used_memory --format=csv` | Processes on the GPU |
| `htop` | `F6` sorts, `F5` tree, `F9` kills, `/` searches |
| `nohup python train.py > train.log 2>&1 &` | Background run that survives terminal close |
| `df -h` | Disk use of all drives |
| `du -sh ~/.cache` | pip and huggingface models land here |
| `du -h --max-depth=1 / 2>/dev/null \| sort -hr \| head -20` | Biggest space hogs |
| `pip cache purge` and `sudo apt clean` | Clear caches |
