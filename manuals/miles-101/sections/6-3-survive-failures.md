# Keep a long run going after a failure

> Long runs on many machines lose engines and nodes, and Miles has fault tolerance and checkpoints for that.

A run on one GPU fails in simple ways, and you restart it. A run on hundreds of GPUs for days will lose an engine or a node along the way. The question is how much of the run you lose with it.

When you finish this section, you can set up checkpoints and fault tolerance for a long run, and test them before you rely on them.

We cannot test fault tolerance on our single GB10. On one GPU, a dead engine means a dead run, as [section 1.2](#s-add-a-watchdog) shows. This page comes from the Miles source and release notes.

## Save checkpoints first

Checkpoints limit the work you lose when you restart after a failure. They do not help when the storage fails, when a checkpoint is damaged, or for the steps after the last checkpoint. Set them before anything else.

The container starts with `--rm`, so a folder inside it goes away with it. Mount a host folder for the checkpoints, and add two lines to the run of [section 1.1](#s-run-grpo-on-one-gpu):

```bash
-v "$HOME/miles-lab/ckpt:/ckpt" -e MILES_EXTRA_ARGS="--save /ckpt/run-a --save-interval 20 --load /ckpt/run-a"
```

`--save-interval` counts steps. Choose it from the step time, so that a crash loses less work than you can accept. With a step of five minutes, an interval of 12 loses at most one hour.

## Resume from a checkpoint

Start the same command again after a failure, with a new log file, such as `> runs/plain-resume.log`. The redirect of [section 1.1](#s-run-grpo-on-one-gpu) empties the old log, and you need it to find the cause of the failure. `--load` names the parent folder, never one `iter_` folder inside it. Miles reads its tracker file to find the last saved step. On the first run, the folder is empty, and Miles starts fresh.

With the FSDP trainer of this manual, a resume restores these parts of the run:

- the model weights and the optimizer state
- the learning-rate schedule and the random state
- the step count, so the run continues at the next step
- the position in the prompt data, which the rollout side saves next to the trainer state

The log of a resumed run should show `[FSDP] Loaded model from` and `[FSDP] Loaded optimizer from`, each with the folder of the step. If these lines are missing, the run started fresh. Our first run with an empty folder printed no message about the missing checkpoint. In our resume check, the first trainer line after the load was `step 2`.

Test a restart on a short run before the long run starts. Miles always saves after the last step, so run the command above with `MILES_NUM_ROLLOUT=2`. Then run it again with `MILES_NUM_ROLLOUT=4`. The first step line of the second run should be `step 2`, not `step 0`. We ran this test on our GB10 with Qwen3-0.6B, and it passed. We also ran the converter below on the step 2 checkpoint, and it wrote a model folder with the weights and the tokenizer files.

## Convert a checkpoint for serving

The FSDP trainer writes PyTorch distributed checkpoints, and other tools cannot load them as they are. Miles has a converter to a Hugging Face model folder. Run it inside the container:

```bash
python3 /root/miles/tools/convert_fsdp_to_hf.py --input-dir /ckpt/run-a/iter_0000020 --output-dir /root/lab/models/run-a-step-20 --origin-hf-dir /root/lab/models/Qwen3-0.6B
```

`--origin-hf-dir` gives the converter the configuration and the tokenizer of the base model. The Megatron trainer writes its own format, and [section 6.1](#s-split-rollout-and-training-choose-the-trainer) names its converters.

## Turn on fault tolerance

```bash
--use-fault-tolerance --ft-components rollout
```

`--ft-components` picks what Miles watches and replaces: `rollout`, `train`, or both. Without the flag, Miles watches `rollout`. Each part has limits in the Miles version we ran:

- Rollout fault tolerance does not work with a dedicated eval fleet, or with `--fully-async --colocate`.
- Train fault tolerance turns on independent data-parallel groups, and those need the Megatron trainer.

Miles main of 2026-10-20 changes this. It adds `weight_update` as a third part. It also allows rollout fault tolerance only with `p2p` weight transfer on a split layout. Read the flag help in your image before you copy a command.

## What the Miles team reports

The Miles team built a fault injector for its tests. Their release notes report a run where a rollout engine crashed. Its loss curve matched a run without a crash, bit for bit. That is their test on their hardware. Repeat a crash test on your own setup before you trust it.

## Known problems

- A report in the Miles issue tracker covers six agent example launchers. Each starts with a cleanup that stops every process with `sglang` in its command line. With `MILES_SCRIPT_EXTERNAL_RAY=1`, that cleanup also stops the Ray cluster that you started. With those launchers, remove the cleanup or give Miles its own Ray cluster.
- After an engine dies without fault tolerance, the trainer keeps sending requests to it and never fails. Add a watchdog to every run.

```takeaways
- Mount a host folder for checkpoints, and test a restart on a short run.
- Read the fault tolerance limits in the flag help of your image before a long run.
- Test an engine crash on your own setup before a long run.
```

Sources: Miles main 08752a12 files miles/backends/fsdp_utils/checkpoint.py, miles/ray/rollout/rollout_executor.py, miles/rollout/data_source.py, tools/convert_fsdp_to_hf.py, docs/user-guide/training-backend.md, miles/utils/arguments.py, docs/advanced/fault-tolerance.md, miles/ray/placement_group.py, miles/backends/training_utils/checkpoint/io.py, miles/utils/test_utils/fault_injector.py, compared with miles/utils/arguments.py at main ee36bb2a of 2026-10-20; Miles release notes v0.1.2; Miles issue 3649; capture/gpu/out-gb10/engine-died-503.log; capture/gpu/out-gb10/resume-check.txt (live check, 2026-10-23).
