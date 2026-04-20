#!/usr/bin/env bash
set -euo pipefail

PYTHON_MIN_MAJOR=3
PYTHON_MIN_MINOR=11
VENV_DIR=".venv"
CORE_PACKAGES="numpy matplotlib jupyter scikit-learn pandas"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "=== AI Engineering from Scratch: Python Environment Setup ==="
echo ""
echo "Repo root: $REPO_ROOT"
echo ""

HAS_UV=false
if command -v uv &> /dev/null; then
    HAS_UV=true
    pass "uv found: $(uv --version)"
else
    warn "uv not found. Install it: curl -LsSf https://astral.sh/uv/install.sh | sh"
    warn "Falling back to python3 -m venv + pip"
fi

PYTHON_CMD=""
for cmd in python3 python; do
    if command -v "$cmd" &> /dev/null; then
        version=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || true)
        if [ -n "$version" ]; then
            major=$(echo "$version" | cut -d. -f1)
            minor=$(echo "$version" | cut -d. -f2)
            if [ "$major" -ge "$PYTHON_MIN_MAJOR" ] && [ "$minor" -ge "$PYTHON_MIN_MINOR" ]; then
                PYTHON_CMD="$cmd"
                break
            fi
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    fail "Python ${PYTHON_MIN_MAJOR}.${PYTHON_MIN_MINOR}+ not found"
    echo ""
    echo "Install Python ${PYTHON_MIN_MAJOR}.${PYTHON_MIN_MINOR}+:"
    echo "  uv:    uv python install 3.12"
    echo "  macOS: brew install python@3.12"
    echo "  Linux: sudo apt install python3.12 python3.12-venv"
    exit 1
fi

pass "Python: $($PYTHON_CMD --version)"

echo ""
echo "--- Creating virtual environment ---"
echo ""

if [ -d "$VENV_DIR" ]; then
    warn "Existing $VENV_DIR found. Reusing it."
else
    if $HAS_UV; then
        uv venv "$VENV_DIR"
    else
        "$PYTHON_CMD" -m venv "$VENV_DIR"
    fi
    pass "Created $VENV_DIR"
fi

if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
elif [ -f "$VENV_DIR/Scripts/activate" ]; then
    source "$VENV_DIR/Scripts/activate"
else
    fail "Could not find activation script in $VENV_DIR"
    exit 1
fi

pass "Activated virtual environment"

VENV_PYTHON="$(which python)"
if [[ "$VENV_PYTHON" != *"$VENV_DIR"* ]]; then
    fail "Python is not running from the venv: $VENV_PYTHON"
    exit 1
fi
pass "Python path: $VENV_PYTHON"

echo ""
echo "--- Installing core packages ---"
echo ""

if $HAS_UV; then
    uv pip install $CORE_PACKAGES
else
    pip install --upgrade pip
    pip install $CORE_PACKAGES
fi

pass "Installed: $CORE_PACKAGES"

echo ""
echo "--- Verifying installation ---"
echo ""

FAILURES=0

verify_package() {
    local pkg=$1
    local import_name=${2:-$1}
    if python -c "import $import_name; print(f'  $pkg: {${import_name}.__version__}')" 2>/dev/null; then
        return 0
    else
        fail "$pkg"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

verify_package "numpy" "numpy"
verify_package "matplotlib" "matplotlib"
verify_package "scikit-learn" "sklearn"
verify_package "pandas" "pandas"
verify_package "jupyter" "jupyter_core"

echo ""
python -c "
import numpy as np
a = np.random.randn(3, 3)
b = np.random.randn(3, 3)
c = a @ b
print(f'  Matrix multiply check: ({a.shape}) @ ({b.shape}) = ({c.shape})')
"
pass "NumPy operations working"

echo ""
if python -c "import torch" 2>/dev/null; then
    TORCH_VERSION=$(python -c "import torch; print(torch.__version__)")
    CUDA_AVAIL=$(python -c "import torch; print(torch.cuda.is_available())")
    pass "PyTorch $TORCH_VERSION (CUDA: $CUDA_AVAIL)"
else
    warn "PyTorch not installed (install later when needed):"
    echo "    uv pip install torch torchvision torchaudio"
fi

echo ""
echo "=== Summary ==="
echo ""
echo "  Repo root:    $REPO_ROOT"
echo "  Venv:         $REPO_ROOT/$VENV_DIR"
echo "  Python:       $(python --version)"
echo "  Packages:     $CORE_PACKAGES"
echo ""

if [ "$FAILURES" -gt 0 ]; then
    fail "$FAILURES package(s) failed verification"
    exit 1
else
    pass "All checks passed"
    echo ""
    echo "Activate this environment in future sessions:"
    echo ""
    echo "  source $REPO_ROOT/$VENV_DIR/bin/activate"
    echo ""
fi
