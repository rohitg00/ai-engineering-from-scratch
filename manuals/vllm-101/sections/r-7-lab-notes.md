# Lab notes

> This page records the hardware, the versions, the seeds, the clocks, and the full tables behind each measurement.

Use this page to check a number from another section, or to repeat a run.

## Method

- **Hardware and versions.** [The version pins page](#s-ref-version-pins) lists them.
- **Client.** Every run used the SGLang 0.5.22 benchmark client. The vLLM runs used `--backend vllm`, which sends each request to `/v1/completions`. The client sends one warmup request first, and it asks the server to ignore the end-of-sequence token unless you pass `--disable-ignore-eos`. Its random dataset cuts or repeats real chat text to the asked length. [The benchmark page](#s-benchmark-your-server-in-15-minutes) prints the full command.
- **Waves.** The waves workload sends 64 prompts at 16 users. The length ratio sets how far the prompt and output lengths can vary. At 1.0 every request has 512 prompt and 128 output tokens. At 0 each length is drawn at random from 1 token up to that size.
- **Seeds.** The runs to 2026-10-21 used seeds 1, 2, and 3. Most runs on 2026-10-22 used seeds 1 and 2, and the tables give the count. Tables give the median, and some columns give the lowest and the highest.
- **Server settings.** The sweep tool starts every vLLM server with `VLLM_USE_FLASHINFER_SAMPLER=0`, because the FlashInfer sampler fails to build on our L4. It also sets `--seed 0`, `--max-model-len`, `--num-gpu-blocks-override`, and `--gpu-memory-utilization`. The L4 used 8,192 tokens, 1,506 blocks, and 0.9. The GB10 used 8,192 tokens, 14,685 blocks, and 0.75. The shared L4 GPU used 2,048 or 2,304 tokens, 183 blocks, and 0.83. The small-pool run used 4,096 tokens and 410 blocks.
- **Rounding.** The tables and the sections use one rule. They round the decimal value from the summary file, and a half goes up, so 1,012.5 shows as 1,013.
- **Pools.** On the L4, vLLM ran with `--num-gpu-blocks-override 1506`, a pool of 24,096 tokens, against 24,094 for SGLang. On the GB10, vLLM ran with 14,685 blocks, a pool of 234,960 tokens. The SGLang pools on the GB10 were 233,303 tokens for load, 234,958 for waves, and 251,910 for mixed.
- **Clocks.** A sampler recorded the SM clock and the temperature every second. The sweep tool can wait for the GPU to cool before a run. It can also repeat a run when the median clock falls below a clock floor, a lowest clock that we set for each sweep. The clock column shows the result for each point. On 2026-10-22, most runs had the SM clock locked at 900 MHz with `nvidia-smi -lgc`. A lock sets the highest clock, but a GPU at a high temperature still slows below it. The sections compare two points only at similar clocks, and they say so where a point ran below the lock or in a throttled session.
- **Dates.** The L4 load runs of `vllm` and `sglang` were on 2026-10-17, and the `vllm-b`, `vllm-async`, `vllm-eager`, and `vllm-seqs-16` load runs on 2026-10-21. The L4 rate and waves runs were on 2026-10-18. The L4 prefix runs with the cache on ran from 2026-10-17 into 2026-10-18, and the run without the prefix cache was on 2026-10-21. Every GB10 run in these tables was on 2026-10-21. Every run in the three L4 tables for 2026-10-22 was on that day. The runs on the shared GPU of the L4 node had a pool of 2,928 tokens, so they tested 1 and 4 users only.

- **The cache between user counts.** The load tables before 2026-10-23 kept one server for each config and did not reset the prefix cache between user counts. Each seed sent the same first prompts at every count. Below 32 users these tables read the first token too fast, by 3.6 to 5.3 times for vLLM on our L4. The rerun of 2026-10-23 resets the cache before every run, and [the benchmark page](#s-benchmark-your-server-in-15-minutes) compares the two.
- **Runs of 2026-10-23.** The L4 runs of that day used the first GPU with the clock locked at 900 MHz. Each run had two seeds and a cache reset first. The card ran hot, so many runs fell below the lock. Each evidence file gives the median clock of its rows, and the sections compare only rows at 900 MHz.

## Not run yet

These runs are planned and are not in these tables:

- `--max-num-batched-tokens` at 512, 2048, and 16384 on mixed prompts on the L4. The GB10 has 2048 and 16384.
- `-O1` on the L4.
- a backend comparison with one KV data type.

## Tables

The config `vllm-async` passes `--async-scheduling`. For these models with no speculation, that is the default, so `vllm-async` is a second run of the baseline setting on both machines.

### L4, load: users at once, 512 prompt and 128 output tokens

| Users | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock |
|---|---|---|---|---|---|---|
| 1 | `vllm` | 13.5 (13.5 to 13.5) | 192 ms | 60.4 ms | 105 (104 to 105) ms | 1,290 MHz |
| 1 | `sglang` | 13.8 (13.7 to 14.1) | 185 ms | 60.2 ms | 104 (104 to 104) ms | 1,290 MHz |
| 1 | `vllm-b` | 13.5 (13.1 to 13.8) | 191 ms | 60.4 ms | 105 (104 to 105) ms | 1,275 MHz |
| 1 | `vllm-async` | 13.3 (13.1 to 13.6) | 191 ms | 60.4 ms | 105 (104 to 105) ms | 1,268 MHz |
| 1 | `vllm-eager` | 13.2 (13.1 to 13.4) | 190 ms | 61.1 ms | 107 (107 to 107) ms | 1,290 MHz |
| 1 | `vllm-seqs-16` | 13.4 (13.1 to 13.6) | 190 ms | 60.4 ms | 105 (105 to 105) ms | 1,275 MHz |
| 2 | `vllm` | 31.3 (31.3 to 31.3) | 132 ms | 63.4 ms | 64 (64 to 64) ms | 1,500 MHz |
| 2 | `sglang` | 31.2 (31.2 to 31.2) | 116 ms | 63.7 ms | 65 (65 to 65) ms | 1,500 MHz |
| 2 | `vllm-b` | 31.3 (31.3 to 31.3) | 132 ms | 63.4 ms | 64 (64 to 64) ms | 1,500 MHz |
| 2 | `vllm-async` | 31.3 (31.3 to 31.3) | 132 ms | 63.4 ms | 64 (64 to 64) ms | 1,500 MHz |
| 2 | `vllm-eager` | 30.8 (30.7 to 30.8) | 141 ms | 64.5 ms | 65 (65 to 65) ms | 1,515 MHz |
| 2 | `vllm-seqs-16` | 31.3 (31.3 to 31.3) | 132 ms | 63.4 ms | 65 (64 to 65) ms | 1,500 MHz |
| 4 | `vllm` | 61.8 (61.8 to 61.8) | 141 ms | 64.1 ms | 65 (65 to 65) ms | 1,515 MHz |
| 4 | `sglang` | 61.6 (61.5 to 61.6) | 137 ms | 64.4 ms | 67 (65 to 67) ms | 1,530 MHz |
| 4 | `vllm-b` | 61.8 (61.8 to 61.8) | 142 ms | 64.1 ms | 65 (65 to 66) ms | 1,560 MHz |
| 4 | `vllm-async` | 61.8 (61.8 to 61.8) | 141 ms | 64.1 ms | 65 (65 to 65) ms | 1,515 MHz |
| 4 | `vllm-eager` | 60.7 (60.7 to 60.7) | 143 ms | 65.3 ms | 66 (66 to 66) ms | 1,560 MHz |
| 4 | `vllm-seqs-16` | 61.6 (61.3 to 61.6) | 142 ms | 64.3 ms | 65 (65 to 66) ms | 1,515 MHz |
| 8 | `vllm` | 112.8 (112.8 to 112.9) | 253 ms | 65.8 ms | 68 (68 to 70) ms | 1,470 MHz |
| 8 | `sglang` | 112.5 (112.4 to 112.6) | 170 ms | 66.1 ms | 71 (70 to 73) ms | 1,485 MHz |
| 8 | `vllm-b` | 112.8 (112.7 to 112.8) | 253 ms | 65.8 ms | 67 (67 to 68) ms | 1,485 MHz |
| 8 | `vllm-async` | 112.7 (112.6 to 112.8) | 261 ms | 65.8 ms | 67 (67 to 68) ms | 1,500 MHz |
| 8 | `vllm-eager` | 111.2 (111.2 to 111.4) | 206 ms | 67.0 ms | 68 (68 to 68) ms | 1,515 MHz |
| 8 | `vllm-seqs-16` | 112.5 (112.4 to 112.6) | 260 ms | 65.9 ms | 67 (67 to 67) ms | 1,485 MHz |
| 16 | `vllm` | 200.9 (200.5 to 201.2) | 289 ms | 69.5 ms | 80 (80 to 105) ms | 1,425 MHz |
| 16 | `sglang` | 201.1 (201.1 to 201.2) | 212 ms | 70.1 ms | 81 (81 to 82) ms | 1,470 MHz |
| 16 | `vllm-b` | 201.3 (200.9 to 201.3) | 288 ms | 69.5 ms | 85 (81 to 89) ms | 1,455 MHz |
| 16 | `vllm-async` | 201.4 (200.8 to 201.5) | 284 ms | 69.5 ms | 85 (79 to 87) ms | 1,425 MHz |
| 16 | `vllm-eager` | 198.4 (198.2 to 198.4) | 278 ms | 71.1 ms | 80 (80 to 85) ms | 1,455 MHz |
| 16 | `vllm-seqs-16` | 200.9 (200.6 to 201.1) | 288 ms | 69.7 ms | 80 (79 to 86) ms | 1,440 MHz |
| 32 | `vllm` | 273.9 (273.8 to 274.4) | 1,813 ms | 102.2 ms | 619 (612 to 622) ms | 1,275 MHz |
| 32 | `sglang` | 271.3 (270.3 to 272.2) | 2,871 ms | 96.8 ms | 102 (102 to 103) ms | 1,320 MHz |
| 32 | `vllm-b` | 275.1 (274.8 to 275.2) | 1,800 ms | 101.8 ms | 613 (608 to 614) ms | 1,275 MHz |
| 32 | `vllm-async` | 275.3 (273.8 to 275.3) | 1,807 ms | 102.1 ms | 613 (611 to 619) ms | 1,275 MHz |
| 32 | `vllm-eager` | 273.2 (272.4 to 273.3) | 1,768 ms | 103.1 ms | 600 (595 to 601) ms | 1,313 MHz |
| 32 | `vllm-seqs-16` | 171.8 (171.3 to 172.5) | 12,330 ms | 81.1 ms | 595 (587 to 603) ms | 1,365 MHz |
| 64 | `vllm` | 241.4 (241.4 to 246.4) | 10,953 ms | 129.2 ms | 1,363 (1,204 to 1,436) ms | 1,013 MHz |
| 64 | `sglang` | 256.6 (255.8 to 260.5) | 18,356 ms | 106.2 ms | 114 (114 to 118) ms | 1,215 MHz |
| 64 | `vllm-b` | 242.3 (242.0 to 243.8) | 11,181 ms | 129.2 ms | 1,233 (1,187 to 1,437) ms | 1,005 MHz |
| 64 | `vllm-async` | 242.0 (241.2 to 253.3) | 11,087 ms | 128.2 ms | 1,127 (1,116 to 1,423) ms | 998 MHz |
| 64 | `vllm-eager` | 242.5 (241.3 to 245.6) | 10,941 ms | 131.4 ms | 1,326 (1,270 to 1,427) ms | 1,020 MHz |
| 64 | `vllm-seqs-16` | 138.1 (136.9 to 139.4) | 39,890 ms | 103.7 ms | 1,143 (1,086 to 1,282) ms | 630 MHz |

### L4, rate: requests each second, 512 prompt and 128 output tokens

| Rate | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock |
|---|---|---|---|---|---|---|
| 0.5 | `vllm` | 70.6 (67.2 to 92.3) | 317 ms | 72.7 ms | 214 (208 to 215) ms | 1,485 MHz |
| 0.5 | `sglang` | 70.6 (67.2 to 92.3) | 284 ms | 74.7 ms | 235 (234 to 235) ms | 1,485 MHz |
| 1 | `vllm` | 123.6 (118.4 to 154.5) | 180 ms | 68.2 ms | 77 (77 to 79) ms | 1,485 MHz |
| 1 | `sglang` | 123.3 (118.4 to 153.6) | 166 ms | 74.0 ms | 114 (113 to 166) ms | 1,500 MHz |
| 2 | `vllm` | 227.8 (216.5 to 231.8) | 233 ms | 88.7 ms | 355 (351 to 358) ms | 1,418 MHz |
| 2 | `sglang` | 226.3 (215.5 to 230.1) | 221 ms | 99.9 ms | 387 (384 to 429) ms | 1,433 MHz |
| 4 | `vllm` | 286.6 (283.7 to 291.7) | 8,304 ms | 126.9 ms | 621 (620 to 627) ms | 1,245 MHz |
| 4 | `sglang` | 257.5 (254.9 to 259.7) | 9,575 ms | 115.1 ms | 680 (383 to 811) ms | 1,350 MHz |
| 8 | `vllm` | 261.8 (259.4 to 264.3) | 27,510 ms | 126.0 ms | 1,184 (1,089 to 1,361) ms | 1,035 MHz |
| 8 | `sglang` | 253.9 (250.7 to 260.7) | 37,211 ms | 105.2 ms | 277 (259 to 317) ms | 1,215 MHz |
| 16 | `vllm` | 205.8 (204.8 to 208.4) | 94,322 ms | 185.2 ms | 1,448 (1,448 to 1,483) ms | 450 MHz |
| 16 | `sglang` | 218.2 (215.6 to 229.0) | 97,542 ms | 115.2 ms | 137 (120 to 163) ms | 600 MHz |

### L4, waves: 64 prompts at 16 users, by length ratio (1.0 means equal lengths)

| Ratio | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock |
|---|---|---|---|---|---|---|
| 0 | `vllm` | 174.4 (164.1 to 195.0) | 284 ms | 75.0 ms | 202 (180 to 215) ms | 1,493 MHz |
| 0 | `sglang` | 158.2 (146.7 to 176.9) | 283 ms | 86.7 ms | 302 (287 to 305) ms | 1,485 MHz |
| 0.5 | `vllm` | 169.6 (165.2 to 173.4) | 353 ms | 81.4 ms | 191 (189 to 219) ms | 1,455 MHz |
| 0.5 | `sglang` | 159.6 (155.8 to 162.0) | 325 ms | 87.8 ms | 363 (360 to 370) ms | 1,470 MHz |
| 1 | `vllm` | 181.7 (181.7 to 182.8) | 1,499 ms | 76.8 ms | 502 (500 to 503) ms | 1,410 MHz |
| 1 | `sglang` | 182.3 (181.5 to 182.7) | 1,775 ms | 74.7 ms | 81 (79 to 81) ms | 1,440 MHz |

### L4, prefix: shared prefix tokens, 4 groups of 16 prompts, 8 users

| Prefix | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock |
|---|---|---|---|---|---|---|
| 0 | `vllm` | 113.8 (113.7 to 114.3) | 408 ms | 65.2 ms | 134 (69 to 167) ms | 1,485 MHz |
| 0 | `vllm-no-prefix-cache` | 113.6 (113.5 to 114.3) | 392 ms | 65.3 ms | 135 (129 to 173) ms | 1,485 MHz |
| 0 | `sglang` | 113.5 (113.5 to 113.5) | 354 ms | 66.1 ms | 72 (72 to 75) ms | 1,485 MHz |
| 256 | `vllm` | 111.5 (111.4 to 111.7) | 488 ms | 64.8 ms | 127 (66 to 129) ms | 1,485 MHz |
| 256 | `vllm-no-prefix-cache` | 99.1 (99.0 to 99.6) | 753 ms | 70.2 ms | 323 (255 to 379) ms | 1,463 MHz |
| 256 | `sglang` | 110.9 (110.8 to 111.2) | 470 ms | 67.2 ms | 72 (72 to 72) ms | 1,485 MHz |
| 1,024 | `vllm` | 106.0 (105.7 to 106.8) | 396 ms | 68.9 ms | 189 (73 to 190) ms | 1,455 MHz |
| 1,024 | `vllm-no-prefix-cache` | 70.9 (70.9 to 71.0) | 1,213 ms | 94.9 ms | 602 (598 to 604) ms | 1,410 MHz |
| 1,024 | `sglang` | 105.7 (103.2 to 105.8) | 466 ms | 66.8 ms | 73 (73 to 73) ms | 1,485 MHz |
| 2,048 | `vllm` | 100.2 (99.5 to 100.9) | 410 ms | 72.3 ms | 151 (128 to 165) ms | 1,455 MHz |
| 2,048 | `vllm-no-prefix-cache` | 46.6 (46.2 to 46.7) | 2,550 ms | 119.8 ms | 1,026 (961 to 1,049) ms | 1,035 MHz |
| 2,048 | `sglang` | 100.4 (99.6 to 102.5) | 441 ms | 70.5 ms | 151 (74 to 153) ms | 1,455 MHz |
| 4,096 | `vllm` | 86.8 (85.6 to 89.4) | 375 ms | 80.8 ms | 230 (140 to 232) ms | 1,410 MHz |
| 4,096 | `vllm-no-prefix-cache` | 19.6 (19.5 to 19.7) | 13,353 ms | 192.9 ms | 1,579 (1,531 to 1,589) ms | 675 MHz |
| 4,096 | `sglang` | 88.4 (88.3 to 88.9) | 474 ms | 75.6 ms | 162 (82 to 214) ms | 1,440 MHz |

### L4, throttled session: 512 prompt and 128 output tokens, 2026-10-22

The GPU ran far below its full clock in this session. Compare these rows only with each other, at matching clocks.

| Users | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock | Seeds |
|---|---|---|---|---|---|---|---|
| 1 | `vllm-fast-b` | 10.6 (10.4 to 10.7) | 705 ms | 104.1 ms | 105 (105 to 105) ms | 210 MHz | 3 |
| 1 | `vllm-O0` | 10.5 (10.4 to 10.6) | 707 ms | 106.5 ms | 107 (107 to 107) ms | 210 MHz | 2 |
| 1 | `vllm-O3` | 10.6 (10.5 to 10.7) | 705 ms | 104.2 ms | 105 (105 to 105) ms | 210 MHz | 2 |
| 1 | `vllm-kv-fp8-triton` | 10.8 (10.6 to 10.9) | 717 ms | 101.8 ms | 102 (102 to 102) ms | 210 MHz | 2 |
| 32 | `vllm-fast-b` | 186.7 (185.4 to 187.1) | 4,181 ms | 142.7 ms | 1,705 (1,424 to 1,789) ms | 450 MHz | 3 |
| 32 | `vllm-O0` | 191.5 (191.0 to 192.1) | 4,051 ms | 142.0 ms | 1,459 (1,354 to 1,565) ms | 548 MHz | 2 |
| 32 | `vllm-O3` | 189.9 (188.5 to 191.2) | 4,086 ms | 143.9 ms | 1,602 (1,417 to 1,787) ms | 536 MHz | 2 |
| 32 | `vllm-kv-fp8-triton` | 192.0 (183.3 to 200.7) | 4,267 ms | 138.0 ms | 1,672 (1,603 to 1,741) ms | 480 MHz | 2 |

### L4, clock locked at 900 MHz: 512 prompt and 128 output tokens, 2026-10-22

The lock sets the highest clock. A GPU at a high temperature still slows below it, as the 1-user runs of `vllm-lock-b` and `vllm-lock-small-pool` show.

| Users | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock | Seeds |
|---|---|---|---|---|---|---|---|
| 1 | `vllm-lock-b` | 11.2 (10.9 to 11.5) | 554 ms | 99.0 ms | 105 (105 to 105) ms | 210 MHz | 2 |
| 1 | `vllm-lock-fp8` | 25.4 (24.5 to 26.3) | 239 ms | 35.3 ms | 48 (45 to 52) ms | 900 MHz | 2 |
| 1 | `vllm-lock-eagle3-k1` | 22.4 (21.7 to 23.1) | 240 ms | 39.4 ms | 100 (84 to 115) ms | 900 MHz | 2 |
| 1 | `vllm-lock-eagle3-k3` | 31.3 (31.2 to 31.4) | 255 ms | 27.8 ms | 78 (78 to 78) ms | 900 MHz | 2 |
| 1 | `vllm-lock-eagle3-k5` | 31.7 (30.6 to 32.9) | 267 ms | 26.2 ms | 110 (83 to 136) ms | 900 MHz | 2 |
| 1 | `vllm-lock-small-pool` | 11.6 (10.9 to 12.3) | 449 ms | 82.6 ms | 105 (105 to 105) ms | 281 MHz | 2 |
| 32 | `vllm-lock-b` | 208.8 (206.8 to 210.8) | 3,090 ms | 119.9 ms | 1,406 (1,390 to 1,422) ms | 881 MHz | 2 |
| 32 | `vllm-lock-fp8` | 284.7 (272.3 to 297.1) | 2,862 ms | 83.8 ms | 1,143 (1,027 to 1,260) ms | 900 MHz | 2 |
| 32 | `vllm-lock-eagle3-k1` | 271.1 (261.2 to 281.0) | 1,004 ms | 100.4 ms | 818 (784 to 852) ms | 900 MHz | 2 |
| 32 | `vllm-lock-eagle3-k3` | 333.6 (327.8 to 339.5) | 890 ms | 77.8 ms | 771 (763 to 780) ms | 900 MHz | 2 |
| 32 | `vllm-lock-eagle3-k5` | 289.5 (280.4 to 298.5) | 1,071 ms | 83.7 ms | 915 (836 to 995) ms | 885 MHz | 2 |
| 32 | `vllm-lock-small-pool` | 80.4 (79.8 to 81.1) | 31,568 ms | 120.6 ms | 768 (765 to 771) ms | 248 MHz | 2 |

### L4, shared GPU with a pool of 2,928 tokens: 512 prompt and 128 output tokens, 2026-10-22

| Users | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock | Seeds |
|---|---|---|---|---|---|---|---|
| 1 | `vllm-fast-b` | 4.0 (3.9 to 4.0) | 1,437 ms | 241.7 ms | 274 (255 to 293) ms | 375 MHz | 2 |
| 1 | `vllm-ngram` | 7.4 (7.3 to 7.5) | 1,428 ms | 76.6 ms | 284 (277 to 291) ms | 413 MHz | 2 |
| 1 | `vllm-no-async` | 3.9 (3.8 to 3.9) | 1,467 ms | 249.6 ms | 283 (258 to 307) ms | 368 MHz | 2 |
| 4 | `vllm-fast-b` | 13.0 (13.0 to 13.1) | 4,945 ms | 272.6 ms | 290 (286 to 295) ms | 428 MHz | 2 |
| 4 | `vllm-ngram` | 19.2 (18.8 to 19.7) | 1,925 ms | 101.3 ms | 1,691 (1,669 to 1,713) ms | 443 MHz | 2 |
| 4 | `vllm-no-async` | 12.9 (12.9 to 12.9) | 4,690 ms | 277.2 ms | 309 (309 to 309) ms | 450 MHz | 1 |

### GB10, load

| Users | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock |
|---|---|---|---|---|---|---|
| 1 | `vllm` | 29.5 (29.3 to 29.5) | 257 ms | 32.3 ms | 35 (34 to 42) ms | 2,411 MHz |
| 1 | `vllm-eager` | 28.0 (28.0 to 28.2) | 249 ms | 33.9 ms | 37 (36 to 43) ms | 2,411 MHz |
| 1 | `vllm-async` | 29.2 (29.2 to 29.4) | 255 ms | 32.5 ms | 35 (35 to 43) ms | 2,411 MHz |
| 1 | `sglang` | 29.4 (29.1 to 29.8) | 270 ms | 32.0 ms | 35 (34 to 42) ms | 2,411 MHz |
| 2 | `vllm` | 44.7 (44.5 to 45.0) | 151 ms | 44.0 ms | 49 (47 to 55) ms | 2,411 MHz |
| 2 | `vllm-eager` | 42.3 (42.1 to 42.6) | 145 ms | 46.5 ms | 51 (50 to 53) ms | 2,411 MHz |
| 2 | `vllm-async` | 44.2 (44.1 to 44.5) | 154 ms | 44.4 ms | 48 (48 to 56) ms | 2,411 MHz |
| 2 | `sglang` | 44.6 (44.4 to 45.2) | 72 ms | 44.6 ms | 49 (48 to 56) ms | 2,411 MHz |
| 4 | `vllm` | 57.1 (56.5 to 57.2) | 250 ms | 69.2 ms | 76 (76 to 77) ms | 2,411 MHz |
| 4 | `vllm-eager` | 55.3 (54.9 to 55.4) | 245 ms | 71.4 ms | 78 (78 to 78) ms | 2,411 MHz |
| 4 | `vllm-async` | 56.1 (55.6 to 56.1) | 256 ms | 70.6 ms | 77 (77 to 78) ms | 2,411 MHz |
| 4 | `sglang` | 57.7 (57.6 to 58.1) | 115 ms | 69.5 ms | 79 (75 to 82) ms | 2,411 MHz |
| 8 | `vllm` | 75.7 (71.8 to 78.7) | 378 ms | 99.9 ms | 115 (115 to 117) ms | 2,411 MHz |
| 8 | `vllm-eager` | 72.8 (68.9 to 75.4) | 337 ms | 104.7 ms | 121 (121 to 123) ms | 2,411 MHz |
| 8 | `vllm-async` | 74.9 (71.1 to 77.8) | 441 ms | 101.2 ms | 117 (117 to 118) ms | 2,411 MHz |
| 8 | `sglang` | 75.5 (72.3 to 78.7) | 214 ms | 101.3 ms | 117 (117 to 121) ms | 2,411 MHz |
| 16 | `vllm` | 101.1 (100.1 to 103.9) | 529 ms | 153.9 ms | 228 (179 to 235) ms | 2,411 MHz |
| 16 | `vllm-eager` | 98.8 (97.7 to 101.1) | 541 ms | 158.2 ms | 216 (175 to 239) ms | 2,411 MHz |
| 16 | `vllm-async` | 99.8 (99.0 to 102.7) | 555 ms | 156.3 ms | 226 (176 to 230) ms | 2,411 MHz |
| 16 | `sglang` | 103.4 (102.4 to 106.7) | 258 ms | 152.2 ms | 164 (163 to 169) ms | 2,411 MHz |
| 32 | `vllm` | 154.1 (152.1 to 154.8) | 644 ms | 198.2 ms | 478 (472 to 479) ms | 2,411 MHz |
| 32 | `vllm-eager` | 149.1 (131.4 to 150.9) | 659 ms | 204.2 ms | 474 (465 to 474) ms | 2,411 MHz |
| 32 | `vllm-async` | 150.2 (148.1 to 150.7) | 644 ms | 203.4 ms | 477 (473 to 479) ms | 2,411 MHz |
| 32 | `sglang` | 154.6 (152.4 to 155.9) | 401 ms | 195.9 ms | 220 (216 to 220) ms | 2,411 MHz |
| 64 | `vllm` | 239.3 (236.3 to 244.7) | 965 ms | 243.8 ms | 528 (510 to 529) ms | 2,398 MHz |
| 64 | `vllm-eager` | 237.5 (232.9 to 240.0) | 774 ms | 248.0 ms | 509 (501 to 511) ms | 2,398 MHz |
| 64 | `vllm-async` | 235.9 (233.2 to 240.2) | 961 ms | 249.1 ms | 527 (524 to 529) ms | 2,398 MHz |
| 64 | `sglang` | 245.1 (239.4 to 247.7) | 573 ms | 246.0 ms | 271 (268 to 273) ms | 2,411 MHz |

### GB10, mixed: prompts of 1,024 to 4,096 tokens, 64 to 256 output tokens, by rate

| Rate | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock |
|---|---|---|---|---|---|---|
| 0.5 | `vllm` | 72.3 (59.0 to 72.7) | 1,135 ms | 148.5 ms | 571 (486 to 588) ms | 2,398 MHz |
| 0.5 | `vllm-mnbt-2048` | 72.0 (58.8 to 72.6) | 1,145 ms | 149.3 ms | 574 (483 to 594) ms | 2,398 MHz |
| 0.5 | `vllm-mnbt-16384` | 72.5 (59.3 to 73.1) | 906 ms | 139.4 ms | 798 (685 to 799) ms | 2,398 MHz |
| 0.5 | `sglang` | 70.9 (58.1 to 71.1) | 841 ms | 170.1 ms | 922 (811 to 925) ms | 2,411 MHz |
| 1 | `vllm` | 107.8 (96.9 to 112.8) | 462 ms | 155.1 ms | 417 (181 to 432) ms | 2,411 MHz |
| 1 | `vllm-mnbt-2048` | 107.8 (97.4 to 113.0) | 454 ms | 156.5 ms | 405 (187 to 427) ms | 2,411 MHz |
| 1 | `vllm-mnbt-16384` | 107.2 (96.6 to 113.2) | 477 ms | 156.9 ms | 395 (201 to 427) ms | 2,411 MHz |
| 1 | `sglang` | 108.8 (95.6 to 113.7) | 244 ms | 161.9 ms | 219 (179 to 236) ms | 2,411 MHz |
| 2 | `vllm` | 128.8 (123.2 to 135.7) | 584 ms | 204.7 ms | 590 (474 to 615) ms | 2,411 MHz |
| 2 | `vllm-mnbt-2048` | 128.1 (124.0 to 135.7) | 560 ms | 205.5 ms | 587 (477 to 609) ms | 2,411 MHz |
| 2 | `vllm-mnbt-16384` | 127.6 (122.6 to 135.6) | 595 ms | 205.1 ms | 586 (479 to 609) ms | 2,411 MHz |
| 2 | `sglang` | 133.2 (124.8 to 139.8) | 238 ms | 189.8 ms | 261 (234 to 286) ms | 2,411 MHz |

### GB10, waves

| Ratio | Config | Output tok/s (min to max) | Median TTFT | Median TPOT | P99 ITL (min to max) | Median SM clock |
|---|---|---|---|---|---|---|
| 0 | `vllm` | 97.0 (93.3 to 97.8) | 476 ms | 154.6 ms | 183 (181 to 184) ms | 2,411 MHz |
| 0 | `vllm-async` | 96.7 (92.9 to 97.5) | 472 ms | 155.5 ms | 191 (182 to 195) ms | 2,411 MHz |
| 0 | `sglang` | 96.6 (93.4 to 97.0) | 324 ms | 155.6 ms | 214 (191 to 225) ms | 2,411 MHz |
| 0.5 | `vllm` | 99.0 (98.9 to 99.7) | 454 ms | 152.7 ms | 188 (182 to 191) ms | 2,411 MHz |
| 0.5 | `vllm-async` | 98.9 (98.8 to 100.3) | 459 ms | 152.5 ms | 183 (182 to 193) ms | 2,411 MHz |
| 0.5 | `sglang` | 99.5 (98.5 to 100.1) | 315 ms | 153.4 ms | 198 (193 to 201) ms | 2,411 MHz |
| 1 | `vllm` | 97.7 (96.3 to 99.6) | 1,185 ms | 157.6 ms | 394 (389 to 402) ms | 2,411 MHz |
| 1 | `vllm-async` | 97.7 (96.9 to 99.7) | 1,212 ms | 157.9 ms | 405 (360 to 411) ms | 2,411 MHz |
| 1 | `sglang` | 101.4 (100.3 to 104.2) | 1,275 ms | 149.7 ms | 159 (159 to 190) ms | 2,411 MHz |

Sources: capture/gpu/summary/l4.json, capture/gpu/summary/gb10.json, capture/gpu/out-l4/, capture/gpu/out-gb10/server-load-vllm.log, capture/gpu/out-l4/load-flushed-vs-unflushed.txt, capture/gpu/out-l4/gsm8k-fp8-accuracy.txt, capture/gpu/out-l4/batch-invariant-cost.txt, capture/gpu/out-l4/admission-cap-64-users.txt, capture/gpu/out-l4/eagle3-long-outputs.txt.
