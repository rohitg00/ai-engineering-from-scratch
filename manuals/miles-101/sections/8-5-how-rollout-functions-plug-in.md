# How rollout functions plug in

> Generate, reward, filter, and loss functions plug into Miles by an import path, so a new recipe changes code without a fork.

Every RL recipe changes something: how answers are generated, how they are scored, which groups the trainer keeps. If each change needed a fork, every team would carry its own copy of Miles. Miles avoids that with a set of flags that each take a Python import path.

When you finish this section, you can explain where a custom function plugs into a step, and choose the smallest hook for your change.

## How a path becomes a function

Each of these flags takes a path like `my_package.my_module.my_function`. Miles imports the module and takes the function from it. Miles also checks a small registry first, but only its own tests fill that registry.

So your function lives in your own file, outside the Miles source. Mount the file into the container, or install it as a package, and pass its path.

## The hooks, in the order a step uses them

| Hook | Flag | What your function does |
|---|---|---|
| Rollout | `--rollout-function-path` | replaces the whole rollout of a step |
| Generate | `--custom-generate-function-path` | generates the answer for one sample, inside the default rollout |
| Reward | `--custom-rm-path` | scores one sample |
| Group filter | `--dynamic-sampling-filter-path` | keeps or drops the answers of one prompt as a group |
| Buffer filter | `--buffer-filter-path` | selects the groups that leave the buffer |
| Sample filter | `--rollout-sample-filter-path` | decides which samples take part in the loss |
| Data buffer | `--custom-async-data-buffer-path` | replaces the buffer of finished groups in fully async mode |
| Loss | `--custom-loss-function-path`, with `--loss-type custom_loss` | computes the loss |

## Use the smallest hook

Each hook down the table replaces less of Miles. Pick the lowest one that covers your change:

- A new scoring rule needs only the reward hook.
- A multi-turn or tool-calling agent needs the generate hook. [Section 3.3](#s-train-an-agent) shows the built-in ones.
- A DAPO-style filter needs only the group filter. Miles has one built in that drops groups where every answer got the same reward.
- Replace the whole rollout only when the step itself changes shape.

A smaller hook keeps the rest of Miles working for you: batching, the metrics, and the gap checks. Partial rollout keeps working only when the generate function supports it. The built-in multi-turn and agent generate functions do not, as [section 4.2](#s-handle-long-responses) shows.

## Fork only when no hook fits

Some teams fork Miles or slime to add a hook that does not exist yet. The Miles issue tracker shows that pattern: a contributor fork with a regression test, then an issue. If you fork, keep the change small and send it back, so that your fork does not drift from the main line.

```takeaways
- Write a custom function in your own file, and pass its import path.
- Use the smallest hook that covers your change.
- Fork only to add a hook, and send the hook back.
```

Sources: Miles function registry, rollout, reward, filter, data buffer, and loss arguments at main 08752a12; Miles issues 4238 and 3714 with their contributor forks.
