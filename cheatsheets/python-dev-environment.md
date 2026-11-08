---
id: python-dev-environment
title: Python Dev Environment for AI
code: PD
subtitle: Install uv, make one venv per project, pin with lockfiles, check the route, set up VS Code and avoid silent Python bugs.
hue: 210
sources: phases/00-setup-and-tooling/01-dev-environment, phases/00-setup-and-tooling/06-python-environments, phases/00-setup-and-tooling/08-editor-setup, phases/00-setup-and-tooling/13-python-for-ai-engineering
source_hash: c1902990e64b40be
---

## The four-layer stack
type: architecture
from: phases/00-setup-and-tooling/01-dev-environment/docs/en.md

```arch
node | sys | 1,1 | 1. System Foundation | OS, shell, git, editor, GPU drivers | process
node | pkg | 2,1 | 2. Package Managers | uv, pnpm, cargo, juliaup | store
node | run | 3,1 | 3. Language Runtimes | Python 3.11+, Node 20+, Rust, Julia | process
node | lib | 4,1 | 4. AI/ML Libraries | PyTorch, JAX, transformers | model
edge | sys | pkg | install first
edge | pkg | run |
edge | run | lib |
```

## Install the toolchain
type: command-table
from: phases/00-setup-and-tooling/01-dev-environment/docs/en.md
span: 2

| Command | What it does |
|---|---|
| `xcode-select --install` | macOS build tools and git |
| `sudo apt install -y build-essential git curl wget unzip` | Ubuntu or Debian base tools |
| `wsl --install -d Ubuntu-24.04` | Windows: use WSL2 |
| `curl -LsSf https://astral.sh/uv/install.sh \| sh` | Install uv |
| `uv python install 3.12` | Install Python 3.12 |
| `fnm install 22` then `fnm use 22` | Node.js 22 for TypeScript lessons |
| `npm install -g pnpm` | Install pnpm |

## Make an environment
type: task-table
from: phases/00-setup-and-tooling/06-python-environments/docs/en.md
span: 2

| Task | Code |
|---|---|
| uv venv (recommended) | `uv venv` then `source .venv/bin/activate` |
| New project with pyproject.toml | `uv init my-ai-project` then `uv add torch numpy matplotlib` |
| Built-in venv | `python3 -m venv .venv` |
| Activate on Windows | `.venv\Scripts\activate` |
| Conda env | `conda create -n myproject python=3.12` then `conda activate myproject` |
| Install an extra group | `uv pip install -e ".[torch,llm]"` |
| Make a lockfile | `uv pip compile pyproject.toml -o requirements.lock` |
| Install from the lockfile | `uv pip install -r requirements.lock` |

## pyproject.toml with extras
type: annotated-code
lang: toml
from: phases/00-setup-and-tooling/06-python-environments/docs/en.md

```toml
[project]
name = "ai-engineering-from-scratch"
version = "0.1.0"
requires-python = ">=3.11"            # course minimum
dependencies = [
    "numpy>=1.26",
    "matplotlib>=3.8",
    "jupyter>=1.0",
    "scikit-learn>=1.4",
]
[project.optional-dependencies]
torch = ["torch>=2.3", "torchvision>=0.18"]   # uv pip install -e ".[torch]"
llm = ["anthropic>=0.39", "openai>=1.50"]     # uv pip install -e ".[llm]"
```

## Check the route
type: command-table
from: phases/00-setup-and-tooling/01-dev-environment/docs/en.md, phases/00-setup-and-tooling/01-dev-environment/code/verify.py, phases/00-setup-and-tooling/06-python-environments/docs/en.md, phases/00-setup-and-tooling/06-python-environments/code/env_setup.sh

| Command | What it does |
|---|---|
| `verify.py --route beginner` | Default route. Requires python and git |
| `--route ml-foundations` | Also requires numpy |
| `--route agent-skills` | Requires python, git, node and npx |
| `--route llm-engineering`, `agents`, `mcp`, `certification` | Require python and git |
| `--show-later` | Also checks optional and later tools |
| `[PASS]`, `[FAIL]`, `[LATER]` | Status of each probe. Exit code 1 on a FAIL |
| `bash .../code/env_setup.sh` | Makes `.venv` at the repo root and verifies it |

## Install PyTorch and check the GPU
type: annotated-code
lang: bash
from: phases/00-setup-and-tooling/01-dev-environment/docs/en.md, phases/00-setup-and-tooling/06-python-environments/docs/en.md

```bash
nvidia-smi                                    # driver CUDA version
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
uv pip install torch torchvision torchaudio   # macOS: plain build with MPS
python -c "import torch; print(torch.version.cuda)"   # PyTorch CUDA version
python -c "import torch; print(torch.__version__)"    # install worked
which python                                  # must show .venv/bin/python
```

## VS Code settings
type: defaults
from: phases/00-setup-and-tooling/08-editor-setup/docs/en.md, phases/00-setup-and-tooling/08-editor-setup/code/vscode/settings.json

| Setting | Default | Note |
|---|---|---|
| `python.analysis.typeCheckingMode` | `"basic"` | Catches wrong argument types before a run |
| `editor.formatOnSave` | `true` | Black formats each save |
| `black-formatter.args` | `["--line-length", "88"]` | Black wraps at 88 |
| `editor.rulers` | `[88, 120]` | 120 marks long docstrings |
| `notebook.output.scrolling` | `true` | Long training output stays small |
| `files.autoSave` | `"afterDelay"` | `files.autoSaveDelay` is 1000 |
| `terminal.integrated.scrollback` | 10000 | Lines kept in the terminal |
| `ruff.lint.run` | `"onSave"` | Ruff lints each save |

## Troubleshooting
type: troubleshooting
from: phases/00-setup-and-tooling/01-dev-environment/docs/en.md, phases/00-setup-and-tooling/06-python-environments/docs/en.md, phases/00-setup-and-tooling/08-editor-setup/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Packages missing at run | Venv not active | `source .venv/bin/activate` |
| `which python` shows `/usr/bin/python` | Global install | Activate, then install again |
| Conda env breaks | `pip install` mixed into conda | Conda first, pip packages last |
| GPU not used | PyTorch CUDA above driver CUDA | PyTorch CUDA must be <= driver CUDA |
| Torch install fails on a Mac | `--index-url .../cuXXX` wheels | Install the plain build |
| `Not installing fnm due to missing dependencies.` | No `unzip` | `sudo apt install -y unzip` |
| `Cannot install under Rosetta 2` | Terminal runs as `i386` | `arch -arm64 brew install fnm` |
| `code` not found on macOS | Shell command not in PATH | "Install 'code' command in PATH" |

## Silent Python bugs
type: annotated-code
lang: python
from: phases/00-setup-and-tooling/13-python-for-ai-engineering/docs/en.md, phases/00-setup-and-tooling/13-python-for-ai-engineering/code/main.py

```python
independent = list(weights)                  # assignment does not copy
grid = [[0] * 3 for _ in range(2)]           # not [[0] * 3] * 2
def add_good(item, bucket=None): ...         # never bucket=[]
hidden: list[int] = field(default_factory=lambda: [64, 32])
random.Random(seed).shuffle(order)           # private generator
sum(x * y for x, y in zip(a, b, strict=True))  # ValueError on a length mismatch
for epoch in range(2):
    sizes = [len(b) for b in batches(range(10), 4)]  # new generator each epoch
raise ValueError(f"label must be an integer, got {text!r}") from None
if __name__ == "__main__":                   # tests import without the demo
```

## Questions
type: qa
from: phases/00-setup-and-tooling/06-python-environments/docs/en.md, phases/00-setup-and-tooling/13-python-for-ai-engineering/docs/en.md, phases/00-setup-and-tooling/01-dev-environment/docs/en.md

- **One env for the whole course?** No. Phases need conflicting dependencies. Use a per-phase strategy.
- **When conda?** For a CUDA toolkit without a system install, or on a shared cluster.
- **Commit `.venv`?** No. Add `.venv/` to `.gitignore`. Commit `pyproject.toml` and the lockfile.
- **No CUDA on a Mac?** That is expected. MPS is the Apple GPU backend.
- **Why does `(3, 2)` with `(3,)` fail?** The trailing 2 and 3 differ. Use `keepdims=True`.

## Tips
type: tips
from: phases/00-setup-and-tooling/01-dev-environment/docs/en.md, phases/00-setup-and-tooling/06-python-environments/docs/en.md, phases/00-setup-and-tooling/13-python-for-ai-engineering/docs/en.md

- Run every lesson command from the repository root.
- Fix the first failed preflight line before you read the next one.
- Install later tools when a lesson asks for them.
- Give `encoding="utf-8"` to each file open. Open CSV files with `newline=""`.
- Split the data before standardization. Fit statistics on the train split only.

## Editor and SSH commands
type: command-table
from: phases/00-setup-and-tooling/08-editor-setup/docs/en.md

| Command | What it does |
|---|---|
| `code --install-extension <id>` | Install one extension by ID |
| `code --list-extensions` | List installed extension IDs |
| `ssh-keygen -t ed25519 -C "<email>"` | Make an SSH key |
| `ssh-copy-id user@your-gpu-box-ip` | Passwordless login to the GPU box |
| `Remote-SSH: Connect to Host` | Open the remote folder as local |
| `watch -n 1 nvidia-smi` | Watch the GPU in a split terminal |
