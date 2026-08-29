# Phase 00 — Editor Setup

## Environment

- macOS on Apple Silicon
- Visual Studio Code 1.135.0 ARM64
- VS Code CLI: `/opt/homebrew/bin/code`
- Python 3.12.14
- Workspace interpreter: `.venv/bin/python`

## Extensions

Installed and verified the recommended extensions for:

- Python development
- Pylance type checking and autocomplete
- Jupyter notebooks
- Python debugging with debugpy
- Black formatting
- Ruff linting
- Git history with GitLens
- Remote development over SSH
- Development containers
- YAML and TOML editing

## Workspace configuration

Configured the repository workspace with:

- Basic Python type checking
- Automatic Python interpreter selection
- Black formatting on save
- Ruff diagnostics
- 88- and 120-character rulers
- Automatic file saving
- Trailing-whitespace removal
- Integrated zsh terminal
- Notebook output scrolling after 30 lines

The `.vscode` directory is intentionally ignored by Git, so these settings remain local to this computer.

## Verification

Created `editor_check.py` and verified:

- Pylance detected an incorrect argument type
- Ruff detected an unused import
- Black formatted the file automatically
- The corrected program ran successfully
- VS Code paused at a Python breakpoint
- The Debug Console displayed the expected variable value
- A Jupyter notebook used the repository virtual environment
- NumPy executed successfully inside the notebook
- GitLens displayed line authorship and file history

## Remote development

The Remote SSH extension is installed. An actual SSH connection was not configured because no remote GPU machine is currently available. It will be configured when a cloud or remote GPU server is used.

## Result

VS Code is ready for Python, notebooks, debugging, Git review, Docker development, and future remote AI workloads.
