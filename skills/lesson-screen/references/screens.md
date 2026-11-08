# Screens

A screen is one HTML file in the screens folder. The browser shows the newest file. Write one file per step.

## Fragments and full pages

Write a fragment by default. A fragment is the content only, with no `<html>`, no `<head>`, and no stylesheet. The server puts it inside the course frame. The frame adds the fonts, the light and dark colour tokens, every class on this page, the figure runtime, and the click helper.

A file that starts with `<!doctype html>` or `<html>` is a full page. The server sends it as written and adds only the click helper. Built figures are full pages, and `CLI publish` puts them on the screen. Write a full page only when a fragment cannot hold the idea.

## Rules for every screen

- Start with an eyebrow line that names the lesson and the step.
- Show one idea per screen. Split a long step into two screens.
- Keep the text short. The terminal holds the teaching and the screen holds the picture.
- Put no correct answer, answer index, or explanation on a screen before the learner answers.
- Use only the course tokens for colour, as in `var(--blueprint)`. The frame defines them for both themes.
- Write every number from the lesson text or a real run.
- Load scripts only from the page itself, aiengineeringfromscratch.com, or cdn.jsdelivr.net. The page blocks every network request to any other origin.

## Classes

| Class | Use |
|---|---|
| `ls-eyebrow` | The first line: phase, lesson, and step, in uppercase mono |
| `ls-lead` | One large sentence: the lesson question or the step question |
| `ls-rail` | An ordered list of the tutor steps. Mark items `is-done` and `is-now` |
| `ls-card` | A bordered card. Put an optional `ls-card-label` first |
| `ls-grid` | Two columns. One column below 720 px |
| `ls-compare` | Two cards side by side: the scratch code and the library code |
| `ls-big` | The big idea: one sentence that starts with a bold label |
| `ls-chips` | A row of readouts. Each child is an `ls-chip` with the value in `<b>` |
| `ls-trace` | A code trace: an `ls-code` block, an `ls-vars` table, and an optional `ls-out` block |
| `ls-line` | One line of code inside `ls-code`. Mark the running line `is-now` and earlier lines `is-done` |
| `ls-question` | A question with `data-question`. Holds an `ls-prompt` and an `ls-choices` row |
| `ls-choice` | An option button with `data-choice`. A press sends a `choice` event |
| `ls-note` | A small line for sources, scale notes, and simulation notes |
| `ls-wait` | The waiting screen |
| `ls-building` | An ordered list of build stages. Mark items `is-done` and `is-now`. `references/build.md` has the example |
| `lesson-figure` | A registered course figure, named in `data-figure` |
| `mermaid` | A `pre` block with Mermaid source. The frame draws it |

Any element with `data-part` and an optional `data-label` sends a `part` event when the learner clicks it.

## Frame the problem

```html
<p class="ls-eyebrow">Phase 07 · Lesson 12 · Frame</p>
<p class="ls-lead">Why does a long chat get slower and use more memory with every new token?</p>
<ol class="ls-rail">
  <li class="is-now">Frame</li>
  <li>Core concept</li>
  <li>Build it</li>
  <li>Use it</li>
  <li>See it</li>
  <li>Quiz</li>
</ol>
<p class="ls-big"><b>The big idea:</b> the model keeps the keys and values of every past token, so memory grows with the sequence.</p>
```

## Core concept with a registered figure

Copy the fence line from the lesson. Add `data-lesson` so that the frame can link to the lesson page if the figure fails to load.

```html
<p class="ls-eyebrow">Phase 07 · Lesson 12 · Core concept</p>
<h2>How big is the KV cache?</h2>
<div class="lesson-figure" data-figure="kv-cache-sizer" data-lesson="phases/07-transformers-deep-dive/12-kv-cache-flash-attention"></div>
<p class="ls-note">Figure from the lesson page. Drag the sequence length and watch the cache size.</p>
```

A fence with a config keeps the config in the attribute. Use single quotes around the attribute value:

```html
<div class="lesson-figure" data-figure='iso-machine {"machine":"kv-cache"}'></div>
```

## Build it: a code trace

Run the lesson code first. Copy the real values into the table and the real output into `ls-out`.

```html
<p class="ls-eyebrow">Phase 07 · Lesson 12 · Build it 2 of 4</p>
<div class="ls-trace">
  <pre class="ls-code"><code><span class="ls-line is-done">def kv_bytes(layers, heads, head_dim, seq, batch, bytes_per):</span>
<span class="ls-line is-now">    per_token = 2 * layers * heads * head_dim * bytes_per</span>
<span class="ls-line">    return per_token * seq * batch</span></code></pre>
  <table class="ls-vars">
    <tr><th>layers</th><td>32</td></tr>
    <tr><th>heads</th><td>8</td></tr>
    <tr><th>head_dim</th><td>128</td></tr>
    <tr><th>bytes_per</th><td>2</td></tr>
    <tr><th>per_token</th><td>131072</td></tr>
  </table>
  <pre class="ls-out">per token: 131072 bytes</pre>
</div>
<p class="ls-note">Values from a run of code/main.py in this lesson.</p>
```

## Use it: scratch beside library

```html
<p class="ls-eyebrow">Phase 07 · Lesson 12 · Use it</p>
<div class="ls-compare">
  <div class="ls-card"><p class="ls-card-label">From scratch</p><pre><code>cache = append(cache, k, v)</code></pre></div>
  <div class="ls-card"><p class="ls-card-label">Library</p><pre><code>out = model(ids, past_key_values=cache, use_cache=True)</code></pre></div>
</div>
<div class="ls-chips">
  <span class="ls-chip">same logits <b>yes</b></span>
  <span class="ls-chip">cache tensors <b>64</b></span>
</div>
```

## Prediction or quiz question

Write the options only. The tutor gives the verdict in the terminal after the learner answers. A later screen can show the verdict and the explanation.

```html
<p class="ls-eyebrow">Phase 07 · Lesson 12 · Predict</p>
<div class="ls-question" data-question="kv-double-seq">
  <p class="ls-prompt">The sequence length doubles. What happens to the KV cache size?</p>
  <div class="ls-choices">
    <button type="button" class="ls-choice" data-choice="A">A. It stays the same</button>
    <button type="button" class="ls-choice" data-choice="B">B. It doubles</button>
    <button type="button" class="ls-choice" data-choice="C">C. It grows four times</button>
    <button type="button" class="ls-choice" data-choice="D">D. It halves</button>
  </div>
</div>
```

A press marks the option and sends `{"type":"choice","question":"kv-double-seq","choice":"B","text":"B. It doubles"}`. The learner can still answer in the terminal. The terminal answer wins when the two differ.

## A diagram from the lesson

A lesson with a Mermaid block can show the same block:

```html
<p class="ls-eyebrow">Phase 14 · Lesson 01 · Core concept</p>
<pre class="mermaid">
flowchart LR
  Observe --> Think --> Act --> Observe
</pre>
```

## Waiting screen

```html
<div class="ls-wait"><p>Back in the terminal for this step.</p></div>
```

## Theme

The frame follows the theme that the learner picks in the top bar. It also follows the system setting. Test each new screen in both themes.
