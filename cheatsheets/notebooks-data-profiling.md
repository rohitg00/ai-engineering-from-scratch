---
id: notebooks-data-profiling
title: Notebooks, Data Files and Profiling
code: ND
subtitle: Run notebooks safely, load and split datasets, keep big files out of git, profile time and memory, catch silent AI bugs.
hue: 285
sources: phases/00-setup-and-tooling/05-jupyter-notebooks, phases/00-setup-and-tooling/09-data-management, phases/00-setup-and-tooling/12-debugging-and-profiling
source_hash: 51d70b9241509845
---

## Notebook shortcuts
type: command-table
from: phases/00-setup-and-tooling/05-jupyter-notebooks/docs/en.md

| Command | What it does |
|---|---|
| `pip install jupyterlab` then `jupyter lab` | Start JupyterLab |
| `Escape` / `Enter` | Command mode / edit mode |
| `Shift+Enter` | Run cell, move to next |
| `A` / `B` | Insert cell above / below |
| `DD` | Delete cell |
| `M` / `Y` | Convert to markdown / code |
| `Shift+Tab` | Show function signature |
| `Ctrl+Shift+H` | Show all shortcuts |

## Magic commands
type: command-table
from: phases/00-setup-and-tooling/05-jupyter-notebooks/docs/en.md, phases/00-setup-and-tooling/05-jupyter-notebooks/outputs/prompt-notebook-helper.md

| Command | What it does |
|---|---|
| `%timeit np.random.randn(10000)` | Runs many times and averages. Microbenchmarks |
| `%%time` | Runs the cell once. Training runs |
| `%matplotlib inline` | Plots render in the notebook |
| `!pip install scikit-learn` | `!` runs any shell command |
| `%env CUDA_VISIBLE_DEVICES` | Check an environment variable |
| `%who` | List all variables in memory |
| `!which python` | Check the kernel environment |

## Notebook troubleshooting
type: troubleshooting
from: phases/00-setup-and-tooling/05-jupyter-notebooks/docs/en.md, phases/00-setup-and-tooling/05-jupyter-notebooks/outputs/prompt-notebook-helper.md

| Symptom | Cause | Fix |
|---|---|---|
| Works for me, breaks for others | Cells run out of order | Kernel > Restart & Run All before sharing |
| Clean notebook needs a deleted cell | Hidden state in the kernel | Restart the kernel regularly |
| RAM keeps growing | Variables persist across cells | `del variable_name` and `gc.collect()` |
| Kernel dies silently | UI hides the error | Read the terminal that runs Jupyter |
| `print(df)` shows text | Not the last expression | End the cell with `df` |
| Import error after pip install | Package in another Python | `!pip install package` in the notebook |
| Cell runs forever | Waits for `input()` or a loop | Kernel > Interrupt, or `I` twice |
| Colab files gone | Free session ended after 90 minutes of inactivity | `drive.mount('/content/drive')` |

## Data pipeline
type: architecture
from: phases/00-setup-and-tooling/09-data-management/docs/en.md

```arch
node | hub | 1,1 | Hugging Face Hub | datasets and models | store
node | lib | 2,1 | datasets library | load or stream | process
node | cache | 3,1 | Local Cache | ~/.cache/huggingface/ | store
node | fmt | 2,2 | Format Conversion | CSV, JSON, Parquet, Arrow | process
node | split | 3,2 | Data Splits | train / val / test | process
node | train | 4,2 | Your Training Pipeline | | model
edge | hub | lib | download
edge | lib | cache | first load
edge | lib | fmt |
edge | fmt | split |
edge | split | train |
```

## Load, stream, convert, split
type: annotated-code
lang: python
from: phases/00-setup-and-tooling/09-data-management/docs/en.md, phases/00-setup-and-tooling/09-data-management/code/data_utils.py

```python
dataset = load_dataset("stanfordnlp/imdb", split="train")   # cached after first load
stream = load_dataset("wikimedia/wikipedia", "20231101.en", split="train", streaming=True)
dataset.to_parquet("imdb_train.parquet")                    # also to_csv, to_json
split = dataset.train_test_split(test_size=0.2, seed=42)
train_val = split["train"].train_test_split(test_size=0.125, seed=42)
train_ds, val_ds, test_ds = train_val["train"], train_val["test"], split["test"]
make_splits(ds, train_ratio=0.8, val_ratio=0.1, seed=42)    # data_utils helper
model_dir = snapshot_download("sentence-transformers/all-MiniLM-L6-v2")
```

## File formats
type: defaults
from: phases/00-setup-and-tooling/09-data-management/docs/en.md

| Setting | Default | Note |
|---|---|---|
| CSV | Slow | Large. Human readability, spreadsheets |
| JSON | Slow | Large. APIs, nested data |
| Parquet | Fast | Small. Best storage format for AI work |
| Arrow | Fastest | Small. In memory, inside `datasets` |
| Train split | 80% | Validation 10%, test 10% |
| Dataset cache | `~/.cache/huggingface/datasets/` | Model cache is `~/.cache/huggingface/hub/` |

## Keep big files out of git
type: task-table
from: phases/00-setup-and-tooling/09-data-management/docs/en.md
span: 2

| Task | Code |
|---|---|
| Ignore weights and data | `*.safetensors`, `*.pt`, `data/*.parquet`, `models/` |
| Track with Git LFS | `git lfs track "*.safetensors"` |
| Commit the LFS rules | `git add .gitattributes` |
| Start DVC | `dvc init` |
| Track data with DVC | `dvc add data/training_set.parquet` |
| Commit the pointer | `git add data/training_set.parquet.dvc data/.gitignore` |
| Push data to S3 | `dvc remote add -d myremote s3://my-bucket/dvc-store` then `dvc push` |

## Debug and profile tools
type: task-table
from: phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md
span: 2

| Task | Code |
|---|---|
| Stop only on a bad loss | `if loss.item() > 100 or torch.isnan(loss): breakpoint()` |
| Inspect in pdb | `p outputs.shape`, `p loss.item()`, then `c` or `q` |
| Profile functions | `python -m cProfile -s cumtime train.py` |
| Profile lines | `@profile`, then `kernprof -l -v train.py` |
| Memory by line | `python -m memory_profiler your_script.py` |
| Top allocations | `tracemalloc.take_snapshot().statistics("lineno")` |
| GPU memory | `torch.cuda.memory_allocated()`, `torch.cuda.memory_reserved()` |
| Training curves | `SummaryWriter("runs/experiment_1")`, then `tensorboard --logdir=runs` |

## Debug workflow
type: flow
from: phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md

1. **Before training**: run `check_shapes` with a sample batch.
2. **First 10 steps**: `debug_print` loss, outputs and gradients. No NaN.
3. **During training**: log loss, learning rate and gradient norms to TensorBoard.
4. **When it breaks**: drop `breakpoint()` at the failure point.
5. **For speed**: time data loading, forward and backward. Profile memory near OOM.

## Silent AI bugs
type: troubleshooting
from: phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md, phases/00-setup-and-tooling/12-debugging-and-profiling/outputs/prompt-debug-ai-code.md

| Symptom | Cause | Fix |
|---|---|---|
| NaN after a few steps | Learning rate too high | Reduce by 10x. Add gradient clipping |
| NaN immediately | Log of zero or negative | `torch.log(x + 1e-8)` |
| Loss stuck at ln(num_classes) | No gradient flow | Remove the accidental `.detach()` |
| 99% test accuracy | Data leakage | `check_data_leakage(train_set, test_set)` |
| OOM | Batch too large | Halve the batch. `torch.cuda.empty_cache()` |
| OOM during backward | Gradients not cleared | `optimizer.zero_grad()` each step |
| Slow, low GPU use | Data loading bottleneck | `num_workers=4` and `pin_memory=True` |
| Tensor on the wrong device | CPU tensor, GPU model | `check_devices(model, *tensors)` |

## Read the curves
type: qa
from: phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md

- **Loss not decreasing?** Learning rate too low, or an architecture issue.
- **Loss oscillating wildly?** Learning rate too high.
- **Train loss down, val loss up?** Overfitting.
- **Weight histograms collapse to zero?** Vanishing gradients.
- **Gradient histograms explode?** Add gradient clipping.

## Tips
type: tips
from: phases/00-setup-and-tooling/05-jupyter-notebooks/docs/en.md, phases/00-setup-and-tooling/09-data-management/docs/en.md, phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md

- Explore in notebooks, ship in scripts.
- Use `%timeit` for microbenchmarks and `%%time` for training runs.
- Always set a seed. The same seed gives the same split.
- Use streaming when a dataset does not fit on disk.
- Data loading often takes 60% of training time. Set `num_workers > 0`.
