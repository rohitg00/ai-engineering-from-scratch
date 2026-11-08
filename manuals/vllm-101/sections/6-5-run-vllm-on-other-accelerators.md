# Run vLLM on other accelerators

> vLLM supports other accelerators through plugins, and each plugin follows its own release.

Your hardware is not an NVIDIA GPU. When you finish this section, you can find the plugin for your hardware and its version.

## Know what is built in and what is a plugin

vLLM 0.31.0 has built-in support for NVIDIA GPUs, AMD GPUs through ROCm, Intel GPUs, and CPUs. Other hardware runs through a plugin. A plugin is a separate Python package that registers a platform with vLLM when it is installed. Install it next to vLLM, and vLLM finds it.

The plugin design came from an RFC in December 2024. Since then, several backends that lived inside vLLM moved out into plugins.

## Find your plugin

| Hardware | Plugin | How it follows vLLM |
|---|---|---|
| Google TPU | `tpu-inference`, which is moving to the name `vllm-jax` | a release for each vLLM release, with its own image |
| Huawei Ascend NPU | `vllm-ascend` | release candidates for recent vLLM versions, and final releases about every three months |
| Intel Gaudi | `vllm-gaudi` | releases based on a named vLLM version |
| AWS Trainium and Inferentia | `vllm-neuron` | releases that name the vLLM version they build on |
| IBM Spyre | `sendnn-inference` | its own version numbers |
| Apple silicon GPU | `vllm-metal`, a community plugin on MLX | its own releases |

## Check the version before you plan

A plugin often supports an older vLLM than the newest release. In October 2026, the newest final release of `vllm-ascend` targeted vLLM 0.23.0, while vLLM itself was at 0.32.0. The TPU plugin had a release for vLLM 0.31.0 within days of it.

Before you plan a feature on your hardware:

1. Find the newest plugin release, and read the vLLM version it targets.
2. Read that vLLM version's documentation, not the newest one.
3. Check the feature table of the plugin. Some features of the CUDA path, such as some quantization formats and attention backends, have no version on other hardware.

Not measured on our hardware. We ran only NVIDIA GPUs.

```takeaways
- Other hardware runs vLLM through a plugin package next to vLLM.
- A plugin can trail the newest vLLM by several releases, so read the version it targets.
- Use the documentation of that vLLM version, not the newest one.
```

Sources: the vLLM source at v0.31.0 (vllm/platforms/, vllm/plugins/), vLLM documentation at v0.31.0 (docs/design/plugin_system.md, docs/getting_started/installation/), vLLM RFC 11162 (Hardware pluggable, December 2024), the release pages of tpu-inference, vllm-ascend, vllm-gaudi, vllm-neuron, sendnn-inference, and vllm-metal (accessed 2026-10-21).
