# Phase 00 — Python Environments

## Course environment

- Environment manager: uv
- Python: uv-managed Python 3.12.14
- Environment location: repository-root `.venv`
- Local accelerator: Apple MPS
- `.venv` is excluded from Git

The course setup script detected and reused the existing environment. It
installed or verified NumPy, Matplotlib, Jupyter, scikit-learn and pandas.
PyTorch and Apple MPS also passed verification.

## Exercise 1 — Course setup script

Ran `env_setup.sh` from the repository root.

Results:

- uv detected successfully
- Existing `.venv` reused
- Correct project Python activated
- Core packages verified
- NumPy matrix operation completed
- PyTorch verified

## Exercise 2 — Environment isolation

Created a temporary second Python 3.12 environment.

- Course environment NumPy: 2.5.2
- Temporary environment NumPy: 1.26.4
- Both environments used separate Python executable paths
- Removing the temporary environment did not affect the course environment

This demonstrated that virtual environments isolate installed package
versions even when they use the same Python version.

## Exercise 3 — pyproject.toml and lockfile

Created:

`personal-projects/phase-00/python-environments-demo`

The project declares:

- Anthropic SDK
- NumPy
- PyTorch

uv generated a lockfile containing exact direct and transitive dependency
versions. The project has its own ignored `.venv`, independent of the
repository-root environment.

The isolated project successfully verified:

- Anthropic SDK
- NumPy
- PyTorch
- Apple MPS

## Exercise 4 — Installation outside a virtual environment

Used Python 3.11.4 outside the course environment and redirected its
user-package location to a temporary directory.

- Installed `cowsay` into the temporary user-package directory
- Confirmed the interpreter and package paths
- Uninstalled the package
- Deleted the temporary directory
- Did not modify the real system or user Python installation

## Key lessons

- A virtual environment isolates interpreters and package versions
- An active environment should be confirmed with `which python`
- uv project environments are independent from an active parent environment
- `pyproject.toml` declares direct project dependencies
- `uv.lock` pins the complete resolved dependency graph
- `.venv` directories should never be committed
- Global or user-level package installation can affect unrelated projects
- Use explicit interpreter paths when diagnosing environment problems
- On Apple Silicon, MPS is the accelerator backend; CUDA is NVIDIA-specific
