# Where vLLM came from

> This page explains the Berkeley project, the V0 to V1 change, and the governance of the project.

The vLLM you install today is the second engine under the same name. When you finish this section, you can say where the project started, why it rewrote its engine, and who decides its direction now.

## A Berkeley project with one idea

The repository started on 2023-02-09 at the University of California, Berkeley, with commits by Woosuk Kwon. The first public release, v0.1.0, came on 2023-06-20, together with a blog post that introduced PagedAttention. The paper on the same idea appeared at SOSP 2023.

The idea was to store the KV cache in fixed blocks, the way an operating system stores memory in pages. A server could then fit more requests on one GPU, and requests could share blocks. Early users ran it behind the Chatbot Arena and the Vicuna demos of the LMSYS team.

## Features in the first engine

Between 2023 and 2025, the first engine gained most of the features this manual covers:

| Release | Date | What it added |
|---|---|---|
| v0.3.0 | 2024-01-31 | experimental multi-LoRA, experimental prefix caching, and an FP8 KV cache |
| v0.4.0 | 2024-03-30 | automatic prefix caching, and early chunked prefill and speculative decoding |
| v0.6.0 | 2024-09-04 | about twice the throughput of v0.5.3 with the default settings, an async output processor, and an optional multi-step scheduler |

Our reading: each feature went into a design that did not plan for it, and the code grew harder to change.

## The rewrite

The team built a second engine, called V1. Its goals were a simple and modular code base, almost no CPU overhead, and the main optimizations on by default. V1 appeared for testing in v0.7.0 on 2025-01-27, with torch.compile on by default. It became the default engine in v0.8.0 on 2025-03-18. Release v0.11.0 on 2025-10-02 removed the old engine.

The ideas on the other pages of Part 8 come from this rewrite. One token budget replaced the prefill and decode paths. Chunked prefill and prefix caching became the default. The process split put the scheduler in its own process. Model Runner V2 later rebuilt the model runner, which the team said had design mistakes.

## Releases now

Until v0.11, a new minor release came every one to five months. Since v0.12.0 in December 2025, a new minor release comes about every two weeks. By 2026-10-18 the project had published 108 releases on GitHub. Each release changes defaults and removes deprecated flags, so a recipe from a few months ago can be wrong today. This manual pins 0.31.0 for that reason.

## Who runs it

The project started the incubation process at the LF AI and Data Foundation in July 2024. On 2025-05-07, it became a hosted project of the PyTorch Foundation. Five lead maintainers and 55 active committers review changes. Companies contribute engineers to the project. Red Hat brought in the Neural Magic team when it bought that company in January 2025.

The pace has a cost that the project discusses in public. In September and October 2026, two RFCs on the project said that review cannot keep up with the number of pull requests. One proposed a reviewer role. The other proposed evals and benchmarks that contributors run on their own GPUs, so that a pull request comes with its evidence.

```takeaways
- vLLM started at Berkeley in 2023 with PagedAttention, the idea of a paged KV cache.
- The V1 engine replaced the first engine between v0.7.0 and v0.11.0.
- A new minor release comes about every two weeks, so pin the version you test.
```

Sources: the GitHub release list of vllm-project/vllm (fetched 2026-10-22), the commit history of vllm-project/vllm (2023-02-09), the vLLM launch blog post vLLM: Easy, Fast, and Cheap LLM Serving with PagedAttention (2023-06-20), the PagedAttention paper Efficient Memory Management for Large Language Model Serving with PagedAttention (arXiv 2309.06180, SOSP 2023), the release notes for v0.1.0, v0.3.0, v0.4.0, v0.6.0, v0.7.0, v0.8.0, v0.11.0, and v0.12.0, the vLLM blog post vLLM V1: A Major Upgrade to vLLM's Core Architecture (2025-01-27), the vLLM blog post vLLM's Open Governance and Performance Roadmap (2024-07-25), the PyTorch Foundation post PyTorch Foundation Welcomes vLLM as a Hosted Project (2025-05-07), the Red Hat press release Red Hat Completes Acquisition of Neural Magic to Fuel Optimized Generative AI Innovation Across the Hybrid Cloud (2025-01-13), vLLM documentation at v0.31.0 (docs/governance/process.md, docs/governance/committers.md, docs/design/model_runner_v2.md), vLLM issues 58253 and 61698.
