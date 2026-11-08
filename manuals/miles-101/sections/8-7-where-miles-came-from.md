# Where Miles came from

> Miles started as a copy of slime in October 2025 and has grown its own features since, so read its own release notes.

Miles makes more sense when you know its parent. It began as a copy of slime, an RL framework from the GLM team at Zhipu. It still shares most of its design with slime.

When you finish this section, you can explain how Miles relates to slime, and what that means when you upgrade.

## slime first

slime started in June 2025. It joined a Megatron trainer to SGLang rollout engines, with a data buffer between them for custom data generation. The GLM team uses it to train its GLM models with reinforcement learning, from GLM-4.5 onward.

## The split

| Date | Event |
|---|---|
| 2025-10-05 | the last commit that slime and Miles share |
| 2025-10-09 | the Miles repository starts from a copy of the slime history |
| 2025-11-19 | the first public Miles post, from the RadixArk team |
| 2026-08-18 | Miles v0.1.0 |
| 2026-09-26 | Miles v0.1.1 |
| 2026-10-09 | Miles v0.1.2, and slime v0.4.0 on the same day |

RadixArk is a company that builds on SGLang and says it will keep investing in it. Its first post said Miles would focus on new hardware, large mixture-of-experts RL, and stability in production. It also said that most additions would go back to slime.

## How far they have grown apart

By 2026-10-20, Miles had about 2,500 commits that slime does not have, and slime about 1,200 that Miles does not have. The features that Miles has and slime does not, at that date:

- A third trainer backend, torchtitan, next to Megatron and FSDP.
- Weight transfer over RDMA, and an update driver shared by every transfer method.
- A session server that passes tokens in and out for agent turns.
- MXFP8, NVFP4, and INT4 training recipes.
- Multi-LoRA training.
- An experimental Kubernetes backend, and a fault injector for its tests.

slime went its own way too. Its v0.3.0 added an agent module. Its v0.4.0 kept only the synchronous and the fully async modes, and added its own storage for rollout data.

## What this means for you

- **Read the Miles release notes, not the slime ones.** A flag that exists in slime can differ in Miles, and the other way around.
- **Use the SGLang inside the image.** Miles runs a patched SGLang with hooks for RL. A stock SGLang release does not have all of them.
- **Pin the image.** Miles merged hundreds of pull requests in each release cycle. The `latest` tag moves, so record the digest of every run, as [section 6.4](#s-pick-an-image) shows.

```takeaways
- Miles began as a copy of slime in October 2025, and the two now differ in many features.
- Use the SGLang build inside the Miles image, not a stock SGLang release.
- Read the Miles release notes and pin the image digest before an upgrade.
```

Sources: Miles and slime repositories and release notes; Miles launch post, 2025-11-19; Miles v0.1 post, 2026-08-18; slime README.
