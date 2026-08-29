# Phase 00 — Jupyter Notebooks

## Configuration

- Interface: JupyterLab
- Local Python: 3.12.14 from the project `.venv`
- Local accelerator: Apple MPS
- Cloud environment: Google Colab
- Colab accelerator: NVIDIA Tesla T4 with 15,360 MiB GPU memory

## Exercises completed

- Compared Python list comprehension with NumPy using `%timeit`
- Created a notebook containing Markdown and code cells
- Created and loaded a CSV using pandas
- Displayed a DataFrame as rich HTML output
- Created an inline Matplotlib chart
- Ran the course `notebook_tips.py` code in Google Colab
- Verified the Colab GPU with `nvidia-smi`

## Jupyter concepts learned

- `%timeit` runs repeated microbenchmarks
- `%%time` measures one complete cell execution
- `%matplotlib inline` displays plots inside notebooks
- Notebook cells retain state until the kernel is restarted
- Restart and Run All detects hidden state and execution-order problems
- Local notebook files persist on disk
- Colab runtime files are temporary unless saved to Google Drive
- Use notebooks for exploration and scripts for reusable or production code

## Environment note

The uv-managed virtual environment did not initially contain `pip`.
Packages were installed into the active notebook environment using `uv pip`
and the kernel's Python executable.

## Artifacts

- `personal-notebooks/phase-00/05-jupyter-basics.ipynb`
- Google Colab notebook: `aiefs-jupyter-notebook-tips.ipynb`
