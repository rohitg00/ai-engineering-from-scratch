# Writing a practice problem

A practice problem asks the learner to write one small piece of code from a lesson: a loss, an update rule, an attention step, a parser. The learner writes it in the browser or on their own computer. The checks tell the learner which part is wrong and why.

Each problem comes from one lesson that builds the same code from scratch. The problem page links back to that lesson.

## Folder shape

One folder holds one problem: `practice/<id>/`. The id is lower case words joined by hyphens.

```text
practice/<id>/
  meta.json        id, title, difficulty, tags, source lesson, cheat sheet, mutants
  problem.md       the statement: task, input and output, constraints, examples
  starter.py       function signatures that raise NotImplementedError
  solution.py      the reference solution
  tests.py         the checks, in four layers
  fixtures.json    reference outputs, written by the validator from solution.py
  hints.md         2 to 5 hints, from a nudge to the key idea
  notes.md         what to know after a pass: why it works, where it goes next
  mutants/*.py     3 to 6 wrong solutions that the checks must reject
  support.py       optional: data or helper code that the learner and the checks import
```

The site shows `problem.md` and the starter on the page. It loads the checks and the hints when the learner runs the code. It loads `solution.py` and `notes.md` only after the learner passes every check.

## meta.json

```json
{
  "id": "softmax-cross-entropy",
  "title": "Stable softmax and cross-entropy",
  "summary": "Batched softmax, mean cross-entropy and its gradient, without overflow for large logits.",
  "difficulty": "easy",
  "tags": ["softmax", "loss-functions", "gradients"],
  "lesson": "phases/03-deep-learning-core/05-loss-functions",
  "cheatsheet": "deep-learning-training",
  "minutes": 20,
  "entry": ["softmax", "cross_entropy", "cross_entropy_grad"],
  "collections": ["deep-learning-core"],
  "time_limit_s": 10,
  "mutants": {
    "no_max_shift": "Calls np.exp on the raw logits, so large logits overflow to infinity."
  }
}
```

| Key | Meaning |
|---|---|
| `summary` | one sentence for the problem list, 160 characters or fewer |
| `difficulty` | `easy`, `medium` or `hard` |
| `tags` | 1 to 6 lower case hyphenated words |
| `lesson` | the lesson that builds this code, `phases/NN-phase/MM-lesson` |
| `cheatsheet` | the id of a file in `cheatsheets/` that covers the topic, or `null` |
| `minutes` | the time that a learner who read the lesson needs, 3 to 120 |
| `entry` | the functions or classes that the learner writes |
| `collections` | ids from `practice/collections.json` |
| `time_limit_s` | the limit for one full submit, 1 to 30 seconds |
| `mutants` | one line for each file in `mutants/`: the bug that the file has |
| `kind` | `implement`, `research`, `train` or `lab`. See the next section |

## Four kinds of task

All four kinds use the same folder, the same four layers of checks, mutants and the same validator. They differ in what the learner writes and in what the checks measure.

| Kind | The learner | The checks |
|---|---|---|
| `implement` | writes a function or a small class that a lesson builds | compare the output with the examples, with properties and with the reference |
| `research` | writes the core method of one paper | test the equations and the properties that the paper states, and compare with the reference |
| `train` | writes a training loop for a tiny model, with a seed and a step budget | measure the trained model on a held-out set that the learner does not see |
| `lab` | runs a short experiment: changes one variable, measures, and returns the answers to the questions | compare each answer with the answer that the reference run gives |

### Research

Pick the method from `research/methods.json`. The method slug goes in `meta.json` as `method`, and the file must map the lesson in `lesson` to that slug. Add the paper:

```json
"method": "direct-preference-optimization-dpo",
"paper": {"title": "Direct Preference Optimization: Your Language Model is Secretly a Reward Model", "authors": "Rafailov et al.", "year": 2023, "url": "https://arxiv.org/abs/2305.18290"}
```

The url is the arXiv abstract page and nothing else. The page shows it as one citation below the statement. Write the statement in our own words. Give the equations that the learner implements, and write checks for the properties that the paper states, for example "the loss is log 2 when the policy equals the reference".

### Train

The learner writes `train(...)` and the checks call it with a seeded `np.random.default_rng`. Add the budget and the target to `meta.json`:

```json
"budget": {"steps": 2000},
"target": {"metric": "held-out accuracy", "value": 0.95}
```

- Put the data generator in `support.py`. The learner and the checks import it with `from support import ...`. The page shows `support.py` as provided code.
- The learner calls `report(step, loss)` from `practice_check` during training. The page draws these points as a live loss curve.
- Train once in the checks and keep the result in a module variable, so that each check does not train again.
- The checks measure the model on a held-out set made with a seed that the statement does not give. They also check that the learner used at most `budget.steps` steps, that the same seed gives the same result, and that the inputs do not change.
- The reference solution must reach the target with a margin. The mutants are realistic training bugs, for example a learning rate of the wrong sign, a missing bias update or no shuffle, and each one must miss the target or fail another check.

### Lab

A lab gives data or a simulator in `support.py` and asks two to five questions. The learner writes small functions and an `answers()` function that returns a dict of numbers, one for each question. The checks compare each answer with the answer of the reference run, with a stated tolerance, and test the helper functions on their own. Every expected answer must come from real data in the repository, for example `manuals/sglang-101/capture/gpu/summary/l4.json`, or from a run of `solution.py`. Copy the data that the lab needs into `support.py` and name the source file in `problem.md`.

## problem.md

Do not start with a `#` heading. The page uses the title from `meta.json`. Start with two or three sentences that tell the learner what the code does and where it is used. Then write these four sections, in this order:

- `## Task`: the functions to write and the math they compute. Use `$...$` for inline math.
- `## Input and output`: a table with the name, type, shape and meaning of each argument. Then the type and shape of each return value.
- `## Constraints`: sizes, value ranges, and the rules, for example "do not change the input arrays".
- `## Examples`: one to three calls with their output. Copy each output from a run of `solution.py`. Do not type an output from memory.

The statement must not contain the solution. The validator fails when a line of `solution.py` appears in `problem.md`.

Tag each fenced block. Use `python` for a call that the learner can paste, `text` for an output, which gets no Copy button, and `console` for a terminal session with `$ ` prompts, where Copy copies the commands only. The build highlights the blocks with the rules in [CONTRIBUTING.md](../CONTRIBUTING.md#code-blocks).

## starter.py and solution.py

The starter has the imports and the signature of each entry function. Each function body is `raise NotImplementedError`. The solution has the same signatures.

Use Python and numpy only. The browser runs Python with numpy and the standard library. Do not import torch or any other package. Do not write comments in code files. Put explanations in `notes.md`.

Write the solution from the lesson code. Keep the names and the method of the lesson where you can, so that a learner who did the lesson knows the shape of the answer.

## tests.py

The checks use the small library in `practice/_harness/practice_check.py`.

```python
import numpy as np

from practice_check import check, close, equal, fixture, fixtures, numeric_grad, raises, shape, true


@check("examples", "softmax of [1, 2, 3]", "Each probability is exp of its logit divided by the sum of exp over the row.")
def example_softmax(sub):
    close(sub.softmax(np.array([[1.0, 2.0, 3.0]])), [[0.09003057, 0.24472847, 0.66524096]])
```

`@check(layer, name, explain)` registers one check. The check gets the learner's module as `sub`. The `explain` text tells the learner in plain words what the check means. The page shows it next to a failed check, so write it as a fact that helps the learner fix the code.

A check passes when it returns without an error. These helpers raise a failure with the expected and the actual value:

| Helper | Fails when |
|---|---|
| `close(actual, expected, rtol, atol, what)` | the shape is different or a value is not close |
| `equal(actual, expected, what)` | the values are not equal |
| `shape(actual, expected_shape, what)` | the shape is different |
| `true(condition, message, expected, actual)` | the condition is false |
| `raises(ErrorType, fn, *args)` | the call does not raise `ErrorType` |
| `fail(message, expected, actual)` | always |

`numeric_grad(f, x, eps)` returns the central finite-difference gradient of a scalar function `f` at `x`.

Write checks in four layers. Each layer needs at least one check.

| Layer | What it checks | Run |
|---|---|---|
| `examples` | the examples in `problem.md`, with the same inputs and outputs | Run and Submit |
| `properties` | invariants that are true for any correct answer: shapes, sums, symmetry, gradient checks by finite differences, inputs not changed | Submit |
| `edge` | hidden edge cases: the smallest input, large values, masks that remove all but one item, ties | Submit |
| `reference` | the output on random inputs is close to the output of `solution.py` | Submit |

The reference layer uses fixtures. A fixture function yields pairs of inputs and the reference output. The validator calls it with `solution.py` and writes the pairs to `fixtures.json`. The check reads them back with `fixtures(name)`. The browser never needs the solution to run this layer.

```python
@fixture("batches")
def batches(ref):
    rng = np.random.default_rng(42)
    for n, c in [(1, 3), (5, 4), (16, 10)]:
        logits = rng.normal(size=(n, c))
        yield {"logits": logits}, ref.softmax(logits)


@check("reference", "softmax matches the reference on random batches", "Your softmax gives the same probabilities as the reference.")
def reference_softmax(sub):
    for case, expected in fixtures("batches"):
        close(sub.softmax(case["logits"]), expected, what=f"softmax for shape {case['logits'].shape}")
```

Inputs and outputs can be numpy arrays, numbers, strings, lists, tuples and dicts. Use a fixed seed. Keep `fixtures.json` under 80 KB: a few cases of small shapes catch the same bugs as many large cases.

Every value in a check or in `problem.md` must come from a run of `solution.py`, or from a fact that you can prove, such as "softmax rows sum to 1". Do not type a number from memory.

## Mutants

A mutant is a copy of the solution with one realistic bug: an off-by-one, a missing mask, a sum instead of a mean, a wrong axis, a sign error, a changed input array. Write 3 to 6 mutants. Each one must fail at least one check. A mutant that passes every check shows a gap in the checks. Add a check for that gap, do not remove the mutant.

Start each mutant from a copy of `solution.py` and change 1 to 12 lines. The validator counts the changed lines. Name each file after its bug, for example `mutants/sum_not_mean.py`, and describe the bug in `meta.json`.

## hints.md and notes.md

`hints.md` has 2 to 5 hints, each under a `## Hint N` heading. The page shows one hint at a time. The first hint is a nudge. The last hint gives the key idea. A hint must not contain two lines of the solution in a row.

`notes.md` is for the learner who passed. Explain why the method works, the numerical trap if there is one, and where the code appears again in the course.

## Validate

```bash
python3 scripts/practice/validate.py <id> --write
python3 scripts/practice/validate.py
```

The first command writes `fixtures.json` from `solution.py` and checks one problem. The second checks every problem, as CI does. The validator checks that:

- `meta.json` has every key, the lesson exists and each mutant has a description;
- `problem.md` has the four sections and does not show a line of the solution;
- the solution passes every check in the time limit;
- the starter fails;
- every mutant changes 1 to 12 lines of the solution and fails at least one check;
- each layer has at least one check;
- `fixtures.json` is the current output of `solution.py`.

To run the checks against your own file, as a learner does on a computer without the site:

```bash
python3 scripts/practice/run.py <id> my_answer.py
python3 scripts/practice/run.py <id> my_answer.py --examples
```

## Prose

Write `problem.md`, `hints.md`, `notes.md` and the `explain` texts in Simplified Technical English: short sentences, one idea in each sentence, active voice, simple tenses. Do not use dashes or figurative words. The reader must know exactly what to write.
