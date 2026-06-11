# Quick Start Guide

> Get up and running with AI Engineering from Scratch in under 30 minutes.

## Prerequisites

Before starting, ensure you have:

- **Python 3.10+** — [Installation guide](phases/00-setup-and-tooling/01-dev-environment/docs/en.md#step-2-python-with-uv)
- **Node.js 20+** — Required for site preview and TypeScript lessons
- **Jupyter** — For interactive notebooks
- **Git** — For version control
- **~4GB disk space** for code and dependencies

**Optional:** NVIDIA GPU with CUDA 12.4+ for GPU-accelerated lessons (most lessons run on CPU).

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/rohitg00/ai-engineering-from-scratch.git
cd ai-engineering-from-scratch
```

### 2. Set Up Python Environment

We use `uv` for fast package management:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv python install 3.12
uv venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows
uv pip install numpy matplotlib jupyter torch
```

### 3. Set Up Node.js (for site preview)

```bash
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 22
fnm use 22
npm install -g pnpm
```

### 4. Verify Your Setup

```bash
python phases/00-setup-and-tooling/01-dev-environment/code/verify.py
```

Expected output: `N/N core checks passed` (GPU checks are optional).

## Running Your First Lesson

Every lesson follows the same structure:

```
phases/<NN>-<phase>/<NN>-<lesson>/
├── code/      # Runnable implementations
├── docs/en.md # Lesson content
└── outputs/   # Artifacts you produce
```

### Option A: Read and Run

1. Open `phases/00-setup-and-tooling/01-dev-environment/docs/en.md` in your editor
2. Follow the step-by-step instructions
3. Run the verification script:

```bash
python phases/00-setup-and-tooling/01-dev-environment/code/verify.py
```

### Option B: Build from Scratch

For "Build" type lessons:

1. Read the problem statement in `docs/en.md`
2. Implement the solution in `code/main.py`
3. Run tests to validate:

```bash
python phases/<phase>/<lesson>/code/main.py
```

### Option C: Preview the Site

To see the full curriculum website locally:

```bash
cd site
pnpm install
pnpm build
# Open index.html in your browser
```

## Learning Paths

### Beginner (Start Here)

1. Phase 0 — Setup & Tooling (this guide)
2. Phase 1 — Math Foundations (lessons 01-10)
3. Phase 2 — ML Fundamentals (lessons 01-05)

### Intermediate

1. Phase 3 — Deep Learning Core
2. Phase 5 — NLP Foundations
3. Phase 7 — Transformers

### Advanced

1. Phase 10 — LLMs from Scratch
2. Phase 11 — LLM Engineering
3. Phase 14 — Agent Engineering

## Validating Completion

### Core Environment Check

```bash
python phases/00-setup-and-tooling/01-dev-environment/code/verify.py
```

All core checks should pass. GPU checks are optional but recommended.

### First Artifact

Complete Phase 0, Lesson 1 to produce your first artifact: a working Python environment verified with NumPy, Matplotlib, and Jupyter.

### Site Build Test

```bash
cd site && pnpm install && pnpm build
```

The site should build without errors.

## Troubleshooting

### Python Import Errors

```bash
# Recreate your environment
rm -rf .venv
uv venv
uv pip install -r requirements.txt
```

### Jupyter Not Starting

```bash
uv pip install jupyter jupyterlab
jupyter notebook
```

### GPU Not Detected

```bash
python -c "import torch; print(torch.cuda.is_available())"
# False = CUDA not set up (expected on CPU-only machines)
```

No GPU is fine — most lessons work on CPU. For GPU-intensive training, use Google Colab or cloud instances.

### Site Build Fails

```bash
cd site
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

## Next Steps

- Read the [main README](README.md) for curriculum overview
- Review [CONTRIBUTING.md](CONTRIBUTING.md) if you'd like to contribute
- Explore [ROADMAP.md](ROADMAP.md) for the full lesson list