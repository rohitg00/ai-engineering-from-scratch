# Evidence: cheatsheets/git-shell-linux.md

Abbreviations: P0 = phases/00-setup-and-tooling. G = P0/02-git-and-collaboration/docs/en.md, T = P0/10-terminal-and-shell/docs/en.md, A = P0/10-terminal-and-shell/code/shell_aliases.sh, L = P0/11-linux-for-ai/docs/en.md.

## Where git moves your work (architecture, 4 nodes, 5 edges)
- Working Directory: G:27
- Staging Area: G:28
- Local Repo: G:29
- Remote (GitHub): G:30
- git add, git commit, git push, git fetch, git pull: G:31-35
- Remote is your fork: G:78

## Git tasks (task-table, 8)
- git config --global user.name: G:52
- git add file.py, git commit -m: G:60-61
- git push origin main: G:62
- git checkout -b experiment/new-optimizer: G:68
- git checkout main, git merge experiment/new-optimizer: G:72-73
- git checkout -b my-progress, git push -u origin my-progress: G:84, 111
- git log --oneline -- phases/00-setup-and-tooling: G:115
- git show --stat <hash>: G:115

## Pipes and redirects (command-table, 7)
- `>` overwrite stdout: T:104
- `>>` append stdout: T:105
- `2>` stderr to file: T:106
- `2>&1` stderr to stdout: T:107
- `|` stdout as stdin: T:108
- python train.py > train_full.log 2>&1: T:97
- python train.py 2>&1 | tee train.log: T:292

## Filter training logs (annotated-code, 7 lines)
- count loss lines: T:82
- awk '{print $NF}' > losses.txt: T:85
- tail -f with --line-buffered "ERROR": T:88
- sort -t= -k2 -n -r: T:91
- diff of two logs: T:295
- count lines of Python files: T:307
- env | grep -i cuda: T:314

## tmux sessions (task-table, 8)
- tmux new -s training: T:156
- Ctrl+B then " splits horizontally: T:159, L:245
- Ctrl+B then % splits vertically: T:162, L:244
- Ctrl+B then arrow keys: T:165, L:246
- Ctrl+B then d detaches, session keeps running: T:168, L:238
- tmux attach -t training: T:171
- tmux ls: T:174
- tmux kill-session -t training: T:177

## Linux files, permissions, packages (command-table, 8)
- mkdir -p a/b/c: L:59
- rm -rf my-dir/, no undo: L:68, 71
- find . -name "*.ckpt" -size +1G: L:91
- grep -r "learning_rate" .: L:87
- chmod +x train.sh: L:109
- chmod 755 deploy.sh: L:110
- fresh GPU box apt line: L:132-143
- systemctl status, start, stop, restart, enable: L:173-177

## Work on a remote GPU box (annotated-code, 8 lines)
- ssh -i ~/.ssh/my_gpu_key: T:234
- scp to and from remote: T:237, 240
- rsync -avz --progress, changed bytes only: L:225, 229
- ssh -L 8888:localhost:8888, open localhost:8888: T:246-247
- ~/.ssh/config Host gpu, HostName, User, IdentityFile: T:250-254
- ssh -G gpu prints settings: T:347
- ssh gpu: T:257

## Troubleshooting (troubleshooting, 8)
- Permission denied, chmod +x or sudo: L:116
- Closing the laptop kills the run, tmux prevents it: L:233
- macOS sed needs an empty string after -i: L:278
- Windows \r\n breaks bash scripts, dos2unix: L:280
- Case-sensitive filesystem, Model.py and model.py: L:279
- pbcopy / pbpaste not available, use cat or less: L:274-275
- Install the Windows NVIDIA driver for CUDA in WSL2: L:265
- Models and datasets fill disks, du -sh *, clear caches: L:182, 188, 196-203

## Course aliases (concepts, 7)
- source shell_aliases.sh: T:265
- gpu, gpumem, gpuprocs: A:9, 11, 12
- ae, uvvenv: A:30, 33
- watchloss, taillog: A:37, 41-44
- trainenv with nvidia-smi and htop panes: A:65-73
- syncto, syncfrom: A:78-100
- bigmodels, memhogs: A:50, 137-139

## Questions (qa, 5)
- &, nohup, tmux: survive and reattach table: T:134-142
- rsync over scp for anything large: L:224, 229
- Only maintainers can push, fork so origin is your copy: G:78
- No rebase, cherry-pick or submodules: G:101
- Use sudo only when needed: L:156

## Tips (tips, 5)
- .gitignore for .pt, .pth, .safetensors: G:106, 113
- sudo apt update first: L:123
- tmux for anything longer than a few minutes: T:142
- Double-check the path before rm -rf: L:71
- ~/.zshrc on macOS, ~/.bashrc on Linux: L:276

## Run, monitor and free disk (command-table, 8)
- watch -n1 nvidia-smi: T:213
- nvidia-smi --query-compute-apps: T:216
- htop F6, F5, F9, /: T:220-223
- nohup python train.py > train.log 2>&1 &, survives close: T:119, 139
- df -h: L:185
- du -sh ~/.cache, pip and huggingface: L:189
- du -h --max-depth=1 biggest space hogs: L:193
- pip cache purge, sudo apt clean: L:200, 203
