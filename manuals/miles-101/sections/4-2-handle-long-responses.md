# Handle long responses with partial rollout

> Partial rollout stops the slowest answers from setting the time of every step.

A rollout step ends when its last answer ends. If a few answers run to the length limit, the whole step waits for them, and the engine has idle capacity while it does.

When you finish this section, you can measure how much the long answers cost you, and keep them from slowing every step.

We have not run partial rollout on our GB10. The measured part of this page is the cut share of our baseline runs.

## Measure the long answers first

`rollout/truncated` reports the share of answers that hit the length limit, `--rollout-max-response-len`. Our three baseline seeds used a limit of 1,024 tokens. In their first 8 steps, 0.30 to 0.34 of the answers hit the limit. In their last 8 steps, the model had learned shorter answers, and 0.08 to 0.12 did. [Section 5.3](#s-repeat-a-run) has the numbers for each seed.

A high cut share has two costs. A cut answer usually stops before its final answer, so the math reward scores it 0. And the step waits for the longest answers.

## Choose between a higher limit and partial rollout

If the cut answers are close to right, raise `--rollout-max-response-len`. The model then gets credit for long correct answers, and each step takes longer.

If a few very long answers set the step time, use partial rollout instead:

```bash
-e MILES_EXTRA_ARGS="--partial-rollout --over-sampling-batch-size 48 --dynamic-sampling-filter-path miles.rollout.filter_hub.common_filters.apply_reward_nonzero_std_filter"
```

The filter is the one from [section 3.2](#s-train-with-the-dapo-filter).

With partial rollout, the step takes the groups that finish first. Groups that are not done go back to the data buffer, and a later step continues them from the tokens they already have. The engine does not generate those tokens again.

Partial rollout works together with over-sampling. `--over-sampling-batch-size` sets the size of each new batch of prompts that the rollout starts when it runs short of finished groups. Keep such a run synchronous. `--fully-async` and the session server both refuse `--partial-rollout`. The multi-turn and agent generate functions do not support it either.

## The cost of continued answers

A continued answer starts under one set of weights and ends under a later one. So part of its tokens come from older weights. Watch the gap between the trainer and the engine, as in [section 5.2](#s-check-the-first-step), after you turn partial rollout on.

## Speculative decoding, a lever we have not measured

Speculative decoding is another way to shorten rollout. A cheap draft guesses the next few tokens, and the engine checks all of them in one forward pass. Miles passes the SGLang speculative flags through with the `--sglang-` prefix. For a model with its own MTP layers, such as GLM-4.7 or DeepSeek-V3, the Miles documentation gives these flags:

```bash
--sglang-speculative-algorithm EAGLE --sglang-speculative-num-steps 3 --sglang-speculative-eagle-topk 1 --sglang-speculative-num-draft-tokens 4
```

There are two kinds of draft to start from:

- **An MTP draft.** The flags above use the MTP layers of the model as the draft. A model without them needs a separate draft, set with `--sglang-speculative-draft-model-path`. As training changes the policy, the draft falls behind, and fewer of its tokens pass the check. Miles can train the MTP layers with the policy: `--mtp-num-layers 1 --enable-mtp-training`, on the Megatron trainer only.
- **An n-gram draft.** `--sglang-speculative-algorithm NGRAM` needs no draft model. It guesses from tokens that the engine already generated. SGLang supports it on CUDA only, and it turns off the overlap scheduler.

The Miles documentation advises against speculative decoding on dense models below about 13B parameters when rollout is the bottleneck. There, the check can cost more than the draft saves. Our Qwen3-0.6B is in that range, and we have not measured it. If you try it, compare the rollout time and the gap over the same steps and seed.

```takeaways
- Read the cut share before you change the length limit.
- Raise the limit when the cut answers are close to right.
- Use partial rollout when a few long answers set the step time, and then watch the gap.
- Treat speculative decoding as a lever to measure, not a default, on a small dense model.
```

Sources: capture/gpu/summary/miles-gb10-lab.json (runs.plain-48, runs.plain-48-s2, runs.plain-48-s3); Miles partial rollout and over-sampling arguments and the single-turn generate function at main 08752a12; Miles speculative decoding documentation and SGLang argument pass-through at main 08752a12; SGLang speculative decoding documentation.
