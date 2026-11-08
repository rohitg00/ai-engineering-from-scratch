# Choose tensor, pipeline, or data parallelism

> Tensor parallelism splits a model that does not fit, and data parallelism copies a model that does.

One GPU is not enough. When you finish this section, you can pick the parallel layout from a short decision tree.

## Answer three questions

| Question | If yes | If no |
|---|---|---|
| Does the model fit on one GPU, with room for the KV cache you need? | Use data parallelism: one full copy for each GPU, `--data-parallel-size N`. The output grows with the copy count. | Split the model across GPUs. The next question decides where. |
| Does the split model fit inside one machine? | Keep the split inside the machine. The next question picks the layout. | Add pipeline parallelism across machines, as the list below the table says. |
| Do the GPUs have NVLink, and does the GPU count divide the model evenly? | Use tensor parallelism, `--tensor-parallel-size N`. | Use pipeline parallelism inside the machine, `--pipeline-parallel-size N`. |

When the model needs more than one machine:

- Set `--pipeline-parallel-size` to the number of machines, and `--tensor-parallel-size` to the GPUs in each machine.
- The tensor-parallel size must divide the attention-head count of the model.
- If the GPUs in each machine do not divide it, use `--tensor-parallel-size 1` and set the pipeline size to the total GPU count.

```figure
id: fig-6-1
kind: decision
title: three questions
claim: Three questions pick the layout, and inside one machine the link between GPUs and the split pick tensor or pipeline parallelism.
caption: Start at the top and follow the answer. From the vLLM documentation at v0.31.0.
```

## Know what each layout costs

| Layout | What it splits | Communication | Best for |
|---|---|---|---|
| Tensor | each layer across GPUs | after every layer, so it needs a fast link such as NVLink | a model too big for one GPU, inside one machine |
| Pipeline | the layers into stages on different GPUs | once for each stage boundary | a model too big for one machine, or GPUs in one machine without NVLink |
| Data | nothing, each GPU holds a full copy | none between copies | more output from a model that fits |
| Expert | the experts of a mixture-of-experts model | before and after the expert layers | large MoE models, covered on [the MoE page](#s-serve-moe-models-with-expert-parallelism) |

Tensor parallelism also splits the weights and the KV cache, so each GPU has more room for the cache. When the weights fill most of one GPU, two GPUs can hold several times the KV pool of one.

## Check the link between GPUs

Tensor parallelism sends data after every layer. On GPUs joined only by PCIe, such as two L4s in one host, that traffic can cost more than the split saves. The vLLM documentation suggests pipeline parallelism on such a machine, because it sends data only at stage boundaries. Pipeline parallelism also accepts a GPU count that does not divide the model evenly. Measure the layouts against each other on such a machine before you pick.

Not measured on our hardware. We have not run vLLM on two L4s with tensor parallelism or data parallelism.

## Start a second machine

vLLM runs one server across machines with Ray, the default for more than one machine, or with its own multiprocess launcher. We did not run either. The steps below come from the vLLM 0.31.0 documentation, for two machines with 8 GPUs each.

First, check that the GPUs can talk to each other. The vLLM troubleshooting guide has a short test script that runs NCCL and Gloo all-reduce calls. Save it as `test.py` on each machine. Run it on both machines at once, with `NODE_RANK=0` on the first machine and `NODE_RANK=1` on the second:

```bash
NCCL_DEBUG=TRACE torchrun --nnodes 2 --nproc-per-node 8 \
  --rdzv_backend=static --rdzv_endpoint=<head-ip>:29400 \
  --node-rank $NODE_RANK test.py
```

 When the network and the drivers work, each process prints four success lines, the first of them `PyTorch NCCL is successful!`. The guide text names a different line, so trust the lines that the script prints.

**With Ray.** The vLLM repository has a `run_cluster.sh` script that starts the vLLM image and a Ray node on each machine. Give each machine its own `VLLM_HOST_IP`, on a private network. On the first machine, run:

```bash
bash run_cluster.sh vllm/vllm-openai:v0.31.0 <head-ip> --head ~/.cache/huggingface -e VLLM_HOST_IP=<head-ip>
```

On the second machine, run:

```bash
bash run_cluster.sh vllm/vllm-openai:v0.31.0 <head-ip> --worker ~/.cache/huggingface -e VLLM_HOST_IP=<worker-ip>
```

Keep both shells open, because closing one stops the cluster. Then, inside a container, check that Ray sees every node and GPU:

```bash
ray status
```

Start the server on one machine only. It uses the GPUs of every machine:

```bash
vllm serve Qwen/Qwen3-30B-A3B-Instruct-2507 \
  --tensor-parallel-size 8 --pipeline-parallel-size 2 \
  --distributed-executor-backend ray
```

**Without Ray.** Run `vllm serve` on both machines with the same model and sizes. Add `--nnodes 2 --node-rank 0 --master-addr <head-ip>` on the first machine. Add `--nnodes 2 --node-rank 1 --master-addr <head-ip> --headless` on the second machine, which then runs workers and no API server.

The traffic between the machines is not encrypted, and it can run code on the other side. Keep it on a private network that untrusted machines cannot reach.

## Count the processes

With data parallelism, vLLM starts one engine core for each copy, and one coordinator that keeps them in step. With tensor parallelism, it starts one worker for each GPU under one engine core. [The process page](#s-why-vllm-runs-three-kinds-of-process) gives the count.

## Use context parallelism for very long prompts

For prompts of hundreds of thousands of tokens, vLLM can split one sequence across GPUs with prefill and decode context parallelism. Use it only when one long request is the problem, not when many short ones are.

```takeaways
- Use data parallelism when the model fits, and tensor parallelism when it does not.
- Add pipeline parallelism to go past one machine, and run the NCCL test first.
- Inside one machine, use pipeline parallelism when the GPUs lack NVLink.
- On GPUs without a fast link, measure tensor parallelism against data parallelism.
```

Sources: the vLLM source at v0.31.0 (vllm/config/parallel.py, vllm/engine/arg_utils.py, examples/ray_serving/run_cluster.sh), vLLM documentation at v0.31.0 (docs/serving/parallelism_scaling.md, docs/usage/troubleshooting.md, docs/serving/distributed_troubleshooting.md, docs/serving/data_parallel_deployment.md, docs/serving/context_parallel_deployment.md).
