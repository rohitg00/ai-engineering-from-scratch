# Write a custom reward function

> A custom reward plugs in with one flag, and a reward with fractions needs a check on how the advantage is centered.

The reward decides what the model learns. Miles has a set of built-in rewards, and you can name your own function when none of them fits your task.

When you finish this section, you can plug in your own reward function and check its advantages before a long run.

We have not measured a custom reward on our GB10. Our runs used the built-in `math` reward, which gives 1 for a correct answer and 0 otherwise.

## Check the built-in rewards first

`--rm-type` picks a built-in reward. The ones you are most likely to need:

| `--rm-type` | Score |
|---|---|
| `math` | 1 when the answer matches the label, else 0 |
| `dapo` | 1 for a correct answer and -1 otherwise, returned as a dict, so it needs `--reward-key score` |
| `deepscaler` | the DeepScaleR rule-based score |
| `f1` | the F1 overlap with the label |
| `gpqa` | the score for GPQA multiple choice |
| `remote_rm` | the score from an HTTP reward service at `--rm-url` |

Add the prefix `boxed_` to a math type, such as `boxed_math`, to grade only the answer inside `\boxed{}`.

## Plug in your own function

Save the function as `~/miles-lab/my_rewards.py` on the host. The container sees it as `/root/lab/my_rewards.py`:

```python
import re


def last_number(text):
    found = re.findall(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", text.replace(",", ""))
    return float(found[-1]) if found else None


async def custom_rm(args, sample, **kwargs):
    answer = last_number(sample.response)
    label = last_number(str(sample.label))
    return 1.0 if answer is not None and answer == label else 0.0
```

This example grades a number answer. It compares the last number in the answer with the label as a value. So an answer of 142 does not match a label of 42. Change the extraction for answers that are not numbers.

Then add two settings to the run of [section 1.1](#s-run-grpo-on-one-gpu). `PYTHONPATH` lets Miles import the file from the lab folder, and the flag names the function by its import path:

```bash
-e PYTHONPATH=/root/lab -e MILES_EXTRA_ARGS="--custom-rm-path my_rewards.custom_rm"
```

The launcher passes `PYTHONPATH` on to the Ray workers that score the answers. When the import works, the first `rollout 0` line shows a `rollout/raw_reward` that your function computed.

If Miles cannot find the file, the log shows `ModuleNotFoundError: No module named 'my_rewards'`. The run does not stop by itself after this error. In our test the job stayed up for two hours with no rollout step. The watchdog did not stop it, because the engine wrote only 44 lines of `503 Service Unavailable` in that time. When you see the error, stop the container, fix `PYTHONPATH`, and start the run again.

Write the function with `async def`. The flag help shows a plain function, but Miles awaits the result, so a plain function fails. The function receives the run arguments and one sample, with the answer in `sample.response` and the label in `sample.label`. If it returns a dict, name the field that holds the reward with `--reward-key`. With `--group-rm`, Miles passes the whole group as a list of samples instead, and the function must return one reward for each sample.

## Test it before the run

Call the function inside the container before the run. This command scores one answer:

```bash
docker run --rm -v "$HOME/miles-lab:/root/lab" -e PYTHONPATH=/root/lab radixark/miles:latest python -c "import asyncio, types, my_rewards; s = types.SimpleNamespace(response='So the answer is 42.', label='42'); print(asyncio.run(my_rewards.custom_rm(None, s)))"
```

It should print `1.0`. Then run the function on ten answers that you have scored by hand. Include a correct answer, a wrong answer, an empty answer, and an answer cut at the length limit. A reward that crashes on an empty answer can stop the rollout of the whole step.

## Check the advantages of fractional rewards

GRPO subtracts the mean reward of each group from each answer, then divides by the standard deviation of the group. When every answer in a group gets the same reward, every advantage should be 0, and the group teaches nothing.

A report in the Miles issue tracker shows that this fails for some fractions. In float32, the mean of 16 rewards of 0.3 is not exactly 0.3, so a tiny remainder stays. The division by a standard deviation near 0 makes it large: about 0.029 per answer. A binary reward of 0 or 1 does not hit this, because its mean is exact.

If your reward gives fractions, find groups where every answer has the same reward and check that their advantages are 0. If they are not, round the rewards to values that a float32 holds exactly, such as multiples of 0.25.

```takeaways
- Use a built-in reward when one fits, because it is already tested.
- Write a custom reward as an async function, and test it on ten hand-scored answers.
- Check that groups with equal fractional rewards get advantages of 0.
```

Sources: Miles reward hub, function loader, and reward arguments at main 08752a12; Miles launcher PYTHONPATH handling in the Ray backend at main 08752a12; capture/gpu/miles_grpo.py; Miles issue 4019; capture/gpu/out-gb10/custom-rm-noenv-hang.txt (live check, 2026-10-23).
