# Phase 00 — GPU Setup & Cloud

## Local environment

- Platform: Apple Silicon
- PyTorch: 2.13.0
- Accelerator: Apple MPS
- MPS available: Yes
- Test computation ran successfully on `mps:0`
- CUDA is not applicable to the local Mac

The course `gpu_check.py` currently checks only CUDA, so it reports
"No GPU detected" even though Apple MPS is available.

## Google Colab

- GPU: NVIDIA Tesla T4
- GPU memory: 15,360 MiB (approximately 15 GiB)
- CUDA available: Yes

## Benchmark

- CPU matrix multiplication: 1.977 seconds
- GPU matrix multiplication: 0.072 seconds
- Compute speedup: 27.6x

The benchmark measures computation after the tensors are transferred to the
GPU. End-to-end performance also depends on transfer and initialization costs.

## Model capacity estimate

At two bytes per fp16 parameter:

- Theoretical weights-only capacity: approximately 8 billion parameters
- Practical inference target: approximately 6–7 billion parameters
- Training requires substantially more memory for gradients, activations,
  and optimizer states

## Usage decision

- Use Apple MPS for normal local course work
- Use Google Colab when CUDA is required or more GPU memory is needed
- Do not purchase paid cloud GPU access until a later lesson requires it
