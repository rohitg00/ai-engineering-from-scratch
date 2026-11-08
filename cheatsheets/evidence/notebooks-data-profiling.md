# Evidence: cheatsheets/notebooks-data-profiling.md

Abbreviations: P0 = phases/00-setup-and-tooling. J = P0/05-jupyter-notebooks/docs/en.md, NH = P0/05-jupyter-notebooks/outputs/prompt-notebook-helper.md, D9 = P0/09-data-management/docs/en.md, DU = P0/09-data-management/code/data_utils.py, D12 = P0/12-debugging-and-profiling/docs/en.md, PD = P0/12-debugging-and-profiling/outputs/prompt-debug-ai-code.md.

## Notebook shortcuts (command-table, 8)
- pip install jupyterlab, jupyter lab: J:57, 64-65
- Escape command mode, Enter edit mode: J:70
- Shift+Enter run cell, move to next: J:76
- A / B insert above / below: J:77-78
- DD delete cell: J:79
- M / Y convert to markdown / code: J:80-81
- Shift+Tab function signature: J:90
- Ctrl+Shift+H all shortcuts: J:83

## Magic commands (command-table, 7)
- %timeit runs many times and averages, microbenchmarks: J:116, 128
- %%time runs once, training runs: J:122, 128
- %matplotlib inline: J:133, 136
- !pip install scikit-learn, ! runs any shell command: J:141, 144
- %env CUDA_VISIBLE_DEVICES: J:149
- %who lists variables: NH:24
- !which python: NH:31

## Notebook troubleshooting (troubleshooting, 8)
- Out-of-order execution, Kernel > Restart & Run All: J:225, NH:29
- Hidden state, restart the kernel regularly: J:227
- Memory leaks, del variable_name and gc.collect(): J:229, NH:24
- Kernel dies silently, check the terminal: NH:15
- print(df) gives text, df gives the rich table: NH:19
- Import errors after pip install, !pip install package: NH:31
- Cell runs forever, input(), Kernel > Interrupt or I twice: NH:30
- Colab 90 minutes inactivity, drive.mount('/content/drive'): J:199-200, NH:34-36

## Data pipeline (architecture, 6 nodes, 5 edges)
- Hugging Face Hub node: D9:24
- datasets library node, load or stream: D9:25-26
- Local Cache ~/.cache/huggingface/: D9:27
- Format Conversion CSV, JSON, Parquet, Arrow: D9:28
- Data Splits train / val / test: D9:29
- Your Training Pipeline: D9:30
- Cache after the first download: D9:57

## Load, stream, convert, split (annotated-code, 8 lines)
- load_dataset("stanfordnlp/imdb", split="train"), cached: D9:57, 79
- streaming=True wikipedia: D9:64
- to_parquet, to_csv, to_json: D9:81-83
- train_test_split(test_size=0.2, seed=42) then test_size=0.125: D9:110-111
- train_ds, val_ds, test_ds: D9:113-115
- make_splits(ds, train_ratio=0.8, val_ratio=0.1, seed=42): DU:80, 173
- snapshot_download("sentence-transformers/all-MiniLM-L6-v2"): D9:135

## File formats (defaults, 6)
- CSV Large, Slow, human readability: D9:90
- JSON Large, Slow, APIs, nested data: D9:91
- Parquet Small, Fast, best storage format: D9:92, 95
- Arrow Small, Fastest, in-memory, datasets uses it: D9:93
- 80% train, 10% validation, 10% test: D9:101-103
- ~/.cache/huggingface/datasets/ and ~/.cache/huggingface/hub/: D9:57, 139

## Keep big files out of git (task-table, 7)
- .gitignore patterns *.safetensors, *.pt, data/*.parquet, models/: D9:147-155
- git lfs track "*.safetensors": D9:162
- git add .gitattributes: D9:163
- dvc init: D9:172
- dvc add data/training_set.parquet: D9:173
- git add data/training_set.parquet.dvc data/.gitignore: D9:174
- dvc remote add -d myremote s3://my-bucket/dvc-store, dvc push: D9:206-207

## Debug and profile tools (task-table, 8)
- conditional breakpoint on loss.item() > 100 or isnan: D12:67-68
- p outputs.shape, p loss.item(), c, q: D12:76-80
- python -m cProfile -s cumtime train.py: D12:144
- @profile and kernprof -l -v train.py: D12:154, 161
- python -m memory_profiler your_script.py: D12:199
- tracemalloc.take_snapshot(), statistics("lineno"): D12:177-178
- torch.cuda.memory_allocated(), memory_reserved(): D12:209-210
- SummaryWriter("runs/experiment_1"), tensorboard --logdir=runs: D12:315, 335

## Debug workflow (flow, 5 steps)
1. check_shapes with a sample batch: D12:375
2. debug_print for the first 10 steps: D12:376
3. log loss, learning rate, gradient norms, TensorBoard: D12:377
4. breakpoint() at the failure point: D12:378
5. time data loading vs forward vs backward, memory near OOM: D12:379

## Silent AI bugs (troubleshooting, 8)
- NaN after a few steps, reduce by 10x, clipping: PD:58
- NaN immediately, torch.log(x + 1e-8): PD:59
- Loss stuck at ln(num_classes), accidental .detach(): PD:61
- 99% test accuracy, data leakage, check_data_leakage: PD:65, D12:276-279
- OOM, reduce batch size, torch.cuda.empty_cache(): D12:215-216, PD:66
- OOM during backward, optimizer.zero_grad(): PD:67
- Slow training, low GPU use, num_workers=4, pin_memory=True: PD:69
- Wrong device, check_devices(model, *tensors): D12:293-296

## Read the curves (qa, 5)
- Loss not decreasing: D12:340
- Loss oscillating wildly: D12:341
- Train down, val up, overfitting: D12:343
- Weight histograms collapsing, vanishing gradients: D12:344
- Gradient histograms exploding, clipping: D12:345

## Tips (tips, 5)
- Explore in notebooks, ship in scripts: J:215
- %timeit vs %%time: J:128
- Always set a seed: D9:120
- Streaming for datasets too large for disk: D9:61
- Data loading 60% of time, num_workers > 0: D12:137
