# Split rollout and training across GPUs

> On many GPUs, rollout and training can run on separate devices, and a transfer method moves the weights between them.

On one GPU, the trainer and the engine take turns, and the weight update is a copy inside the GPU. On many GPUs you have a choice. Keep both sides on the same GPUs and take turns, or give each side its own GPUs and send the weights across.

When you finish this section, you can choose a placement and a weight transfer method for a run on many GPUs.

We cannot measure this on our single GB10. This page comes from the Miles source and documentation.

## Choose a placement

| Placement | Flag | GPUs used | Each side waits for the other |
|---|---|---|---|
| Colocated | `--colocate` | the larger of the trainer GPUs and the rollout GPUs | yes, every step |
| Split | no `--colocate` | the trainer GPUs plus the rollout GPUs | yes, unless you run async training |

Set the sizes with these flags:

- `--actor-num-nodes` and `--actor-num-gpus-per-node` set the trainer GPUs.
- `--rollout-num-gpus` sets the rollout GPUs in a split layout.
- `--rollout-num-gpus-per-engine` sets how many GPUs each rollout engine uses.

Start colocated. Split only when the rollout phase takes most of the step and you have the GPUs to give it. A split layout leaves trainer GPUs idle during rollout unless you also run async training, as in [section 4.1](#s-run-rollout-and-training-at-once).

## Choose how the weights move

In a split layout, the weights leave the trainer GPUs after every update. `--update-weight-transfer-mode` picks the method:

| Method | What it does | Needs |
|---|---|---|
| `broadcast`, the default | sends each tensor over NCCL, one by one | nothing extra |
| `broadcast_packed` | packs each bucket into one send | the Megatron trainer and a split layout |
| `p2p` | moves the weights over RDMA with Mooncake | Mooncake and an RDMA network |
| `disk-delta` | writes only the changed bytes to a shared folder, and each engine loads them | `--update-weight-disk-dir` |

Under `--colocate`, Miles uses a copy inside the GPU instead, and the transfer mode does not apply.

## Choose the trainer

This manual uses the FSDP trainer, because it loads a Hugging Face model folder as it is. Miles has two other trainers, and `--train-backend` picks one:

| Trainer | Model input | Model parallel | LoRA |
|---|---|---|---|
| `megatron`, the default | a Megatron `torch_dist` checkpoint, converted once from the Hugging Face folder | tensor, pipeline, context, and expert parallel | yes |
| `fsdp` | the Hugging Face folder | no. It shards the weights and the optimizer state over data-parallel GPUs, and each GPU still runs whole layers | no |
| `torchtitan` | the Hugging Face folder, for the models that torchtitan implements | tensor, pipeline, context, and expert parallel | no |

Some features in this manual work only on Megatron: fully async training with `--colocate`, train fault tolerance, MTP training, and the step-0 checks of `--ci-test`. The Miles documentation recommends Megatron for large models and for jobs on many nodes.

**torch_dist:** the checkpoint format of Megatron. It does not depend on the parallel layout, so you can change the layout later without a new conversion.

Convert a model once before the first Megatron run. The architecture flags come from the model file of Miles for that model, here `qwen3-4B`:

```bash
cd /root/miles
MODEL_ARGS=$(python3 miles/utils/external_utils/model_args_utils.py qwen3-4B)
PYTHONPATH=/root/Megatron-LM python3 tools/convert_hf_to_torch_dist.py $MODEL_ARGS --hf-checkpoint /root/lab/models/Qwen3-4B --save /root/lab/models/Qwen3-4B_torch_dist
```

Run these lines inside the container, with the lab folder mounted as in [section 1.1](#s-run-grpo-on-one-gpu). Our launcher builds an FSDP run only. For Megatron, start from a launcher of Miles for your model, in the `scripts` folder of the Miles source. We have not run the Megatron or the torchtitan trainer on our GB10. We ran only the conversion to `torch_dist` for Qwen3-0.6B, and it wrote the checkpoint folder.

## Start a run on more than one node

Every node must be in one Ray cluster before Miles submits the job. The launchers of Miles do it in one of two ways:

- One command for each node role. A `worker` command joins the cluster of the head node and waits. A `train` command starts the head node, waits for all GPUs, and submits the job.
- One command on the head node, which connects to the other hosts over ssh and adds them to the cluster.

To use a Ray cluster that you started yourself, set `MILES_SCRIPT_EXTERNAL_RAY=1`. The launcher then skips its own `ray start` and only submits the job. Set `MASTER_ADDR` to the address of the head node on every node, so that Ray and the trainer use the right network interface. Then set the trainer size with `--actor-num-nodes` and `--actor-num-gpus-per-node`.

[Section 6.3](#s-survive-failures) lists a known problem of some launchers with a Ray cluster of your own. We have not run Miles on more than one node.

## What to measure after the split

- `perf/update_weights_time` against `perf/step_time`. On many machines the transfer is no longer a copy inside one GPU.
- The idle time on each side, from `perf/train_wait_time` and the rollout timers.
- The gap between the trainer and the engine, as in [section 5.2](#s-check-the-first-step), after the first update with the new method.

```takeaways
- Start colocated, and split only when rollout takes most of the step.
- Keep broadcast until the weight transfer is a large share of the step.
- Measure the update time and the idle time on both sides after a split.
- Pick the trainer before you size the run, because only Megatron has model parallel and LoRA.
```

Sources: Miles main 08752a12 files docs/user-guide/training-backend.md, docs/user-guide/launch-script.md, miles/utils/external_utils/command_utils/ray_backend/backend.py, miles/utils/lora/arguments.py, tools/convert_hf_to_torch_dist.py, scripts/models/qwen3-4B.py, miles/ray/placement_group.py, miles/utils/arguments.py, miles/backends/training_utils/weight_update/protocol.py, miles/backends/training_utils/weight_update/protocols/broadcast.py, miles/backends/training_utils/weight_update/protocols/delta.py, miles/backends/training_utils/metrics/perf.py, docs/advanced/disaggregated-rollout.md, docs/advanced/p2p-weight-transfer.md; capture/gpu/out-gb10/live-check-summary.txt (live check, 2026-10-23).
