---
id: pip-install-four-failed-starts
title: Four failed starts after a pip install
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, forward-deployed-ai-engineer, applied-ai-engineer]
rounds: [debugging, screen]
tags: [startup, cuda-toolkit, jit-kernels, flashinfer, pip-install, image]
minutes: 20
lessons: []
manuals: [sglang-101#s-operating-sglang, vllm-101#s-troubleshoot-by-symptom]
practice: []
cheatsheet: []
related: [scenarios/startup-oom-shared-gpu]
updated: 2026-11-03
system:
  version: SGLang 0.5.22 from pip, and vLLM 0.31.0 from a uv install
  model: Qwen/Qwen3-8B
  hardware: a node with two L4 GPUs, an NVIDIA driver and no CUDA toolkit
source:
  - manuals/sglang-101/capture/gpu/incidents/l4-toolchain-failures.txt
  - manuals/vllm-101/capture/gpu/incidents/l4-vllm-flashinfer-jit.txt
  - manuals/sglang-101/sections/7-1-operating-sglang.md
  - manuals/vllm-101/sections/7-1-troubleshoot-by-symptom.md
---

## Situation

A platform team gets a new node with two L4 cards. The host runs Ubuntu 24.04 with a driver, and nothing else from CUDA is on it. They install SGLang with pip, and the install prints no error. The first `sglang serve` dies with a C compiler message about a missing header. They repair it and start again. A new error. They repair that one too. After an afternoon, they have four failed starts and four different errors, each from a different component.

The other team on the same node tries vLLM through a uv install. Their server dies with `Engine core initialization failed` right after a kernel build. Both teams now believe the driver on the node is faulty, and they file a ticket to reimage it. You are asked to review the logs before the node goes down.

## Evidence

- [the first two starts: a missing Python header, then no CUDA compiler](evidence/attempts-1-and-2.txt)
- [the third start: the compiler and the headers do not match](evidence/attempt-3-header-mismatch.txt)
- [the fourth start: the linker cannot find the CUDA runtime library](evidence/attempt-4-no-libcudart.txt)
- [the other engine on the same host: the sampler choice and the JIT build](evidence/other-engine-jit-build.txt)
- [the other engine: the engine core fails, and the three packages behind it](evidence/other-engine-core-failed.txt)
- [the one fact behind the four failures, and the repair for each](evidence/the-four-repairs.txt)
- [the troubleshooting entry for the sampler build on the other engine](evidence/the-sampler-entry.txt)

## Questions

1. Four errors name four components. What is the one fact that all four share?
2. Why does a serving engine need the Python headers at all, and which part of the stack asked for them?
3. The third failure appeared only after the second one was repaired. What did that repair cause?
4. The second engine failed on the same host with the same preprocessor check. Is it the same cause, and what is the one-variable workaround for a greedy benchmark?
5. What do you tell the team about the reimage ticket, and what is the fix for production?

## Walkthrough

1. **Read the first error of each start, not the traceback.** Attempt one stops in `triton/backends/nvidia/driver.c` on `Python.h: No such file or directory`. Triton compiles a small C helper against the Python headers when the server starts, and the system Python has none. The manual changed to a Python build that ships its headers, from `uv`. Attempt two stops with `Could not find nvcc and default cuda_home='/usr/local/cuda' doesn't exist`. The pip wheels carry an `nvcc` at version 13.4 under `nvidia/cu13` in site-packages, but nothing points at it, so the manual set `CUDA_HOME` to that directory.
2. **See how one repair exposed the next failure.** With a compiler in reach, FlashInfer built its attention kernels with that `nvcc` against its own bundled headers, and the versions did not match. The Ninja build stops on one preprocessor line: `CUDA compiler and CUDA toolkit headers are incompatible`. The manual installed `flashinfer-jit-cache`, which holds kernels compiled in advance for SM 8.9, so nothing has to compile them on the host.
3. **Read the fourth error as a linker problem.** The JIT kernels of SGLang link with `-lcudart` from `$CUDA_HOME/lib64`. The wheel has only `lib/libcudart.so.13`, so `ld` finds no `libcudart.so`. The manual made a `CUDA_HOME` with a `lib64` directory that holds the library. The fifth start served requests.
4. **Check the second engine against the third failure.** vLLM chose FlashInfer for top-p and top-k sampling and started to build the `sampling` JIT module. The build stopped on the same header check, and the engine core never came up. The package list under the error gives the cause in three lines: the kernel library `flashinfer_python-0.7.0.post1`, the headers `nvidia_cuda_cccl-13.3.4.3.1` and the compiler `nvidia_cuda_nvcc-13.4.92` come from three packages with three versions. The vLLM manual gives two fixes: a toolkit that matches the PyTorch build, or `VLLM_USE_FLASHINFER_SAMPLER=0`, which skips the sampler build and is enough for a greedy benchmark.
5. **Name the one fact.** SGLang, Triton and FlashInfer compile kernels on the target machine at startup, and a compiler needs a complete toolchain. The driver was never part of any error. The manual's GB10 never hit this, because its DGX operating system has a full toolkit under `/usr/local/cuda`.

## Resolution

Cancel the reimage. Nothing in the logs names the driver. Every error names a compiler, a header set or a linker, and all of them belong to the kernel build that runs on the first start.

For production, run SGLang from the pinned image, or on a host with a full CUDA toolkit. The pip path works on a host with only a driver after the four repairs above, and the manual warns that each SGLang upgrade can need them again. For vLLM, use the image or a toolkit that matches the PyTorch build; set `VLLM_USE_FLASHINFER_SAMPLER=0` only when you need a quick greedy benchmark on a host without one. The proof of the fix is the fifth start, which served requests, and the position in the manual that came out of it: run outside the image only on a host with a full toolkit.

## Wrong turns

- "The driver is broken, reimage the node." No error names the driver. The four messages come from a C compiler, the CUDA compiler lookup, a header check and the linker.
- "pip install finished without errors, so the install is complete." The install does not compile kernels. The first start does, and that is where the toolchain is checked.
- "Install the distribution's CUDA toolkit and keep the wheels." The toolkit must match the CUDA build of PyTorch. A host toolkit at nvcc 13.4 gave the header mismatch on this node.
- "Fix one error and declare the node ready." Each repair revealed the next failure. Run a full start and one request before you close the ticket.

## Generalize

An engine that compiles kernels at startup has a second install step, and it runs on the first start, on the machine you serve from. When that step fails, read the first error line and ask which tool failed: the compiler, the headers it reads, or the linker. Fix the toolchain or use the image that carries it. A driver bug announces itself in the driver's own words, not in a build log.

## Taught in

The SGLang manual records the four starts and their repairs in [the pip install part of its operating page](../../../manuals/sglang-101/sections/7-1-operating-sglang.md#what-pip-install-leaves-out), and the vLLM manual gives the matching entries for [the missing compiler](../../../manuals/vllm-101/sections/7-1-troubleshoot-by-symptom.md#the-first-start-stops-with-a-message-that-nvcc-is-missing) and [the sampler build](../../../manuals/vllm-101/sections/7-1-troubleshoot-by-symptom.md#the-sampler-fails-to-compile-after-you-set-cudahome).
