# Vision Encoder Patches

> A vision model that reads pixels needs a tokenizer for pixels. Patch embedding is that tokenizer. Cut the image into a grid of squares, flatten each square, project it through one linear layer, then add a 2D position signal so the transformer knows where each square sat in the original image.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 19 lessons 30-37 (Track B foundations)
**Time:** ~90 minutes

## Learning Objectives

- Tokenize an image into a fixed-length sequence of patch embeddings.
- Implement a `Conv2d`-based patch projection that matches the math of unfold-then-linear.
- Build a deterministic 2D sinusoidal position embedding so token order encodes spatial position.
- Verify patch count, embedding shape, and `Conv2d`/unfold equivalence on a synthetic fixture.

## The Problem

A transformer eats a sequence of vectors. An image is a 3-channel grid. Reading every pixel as a token explodes the sequence length: a 224x224 RGB image is 150,528 tokens, which a 12-layer transformer cannot afford in attention. Reading the image as one giant flat vector throws away locality, which the attention layer cannot recover from. The job of the encoder front end is to compress the pixel grid into a few hundred tokens that each summarize a square region.

Patch embedding solves this with one linear projection. A 224x224 image cut into 16x16 patches produces a 14x14 grid of 196 patches. Each patch is flattened from `(3, 16, 16) = 768` pixel values into one vector, then a linear layer maps it to the model's hidden dimension. The transformer sees 196 tokens of dimension `hidden` (commonly 768) plus a CLS token. That is a sequence the rest of the network can chew on.

## The Concept

```mermaid
flowchart LR
  Image[224x224x3 image] --> Cut[cut into 16x16 patches]
  Cut --> Grid[14x14 grid of patches]
  Grid --> Flatten[flatten each patch]
  Flatten --> Proj[linear projection]
  Proj --> Tokens[196 tokens of dim hidden]
  Tokens --> Pos[add 2D sinusoidal position]
  Pos --> Out[final token sequence]
```

### Why patches, not pixels

Attention is quadratic in sequence length. A 196-token sequence costs `196 * 196 = 38,416` attention scores per head per layer; a 150,528-token sequence costs `150,528 * 150,528 = 22.6 billion`. Patches buy a 590,000x reduction in attention compute, and a single 16x16 region carries enough signal for high-level vision tasks. The cost is a loss of fine-grained spatial detail inside one patch, which is why downstream multimodal stacks often run a second high-resolution branch when fine localization matters.

### Why a linear projection is enough

Each patch is treated as an independent vector. The projection learns a basis: edge detectors, color filters, simple textures. A single linear layer is small (`768 * 768 = 589,824` parameters for ViT-Base) and trains fast. Deeper convolutional stems exist (the "hybrid" ViT), but a flat linear projection is the standard, and most modern open-weight encoders ship with this exact shape.

### The `Conv2d` trick

A `Conv2d(in_channels=3, out_channels=hidden, kernel_size=patch_size, stride=patch_size)` with no padding gives the same numerical result as unfold-then-linear, because each output position dot-products the patch pixels against one filter. The convolution is the patch projection, and most production codebases ship it that way because it is faster on GPU and uses one fewer reshape.

### Position embeddings

Tokens carry no order out of the projection. The 2D sinusoidal embedding gives each token a fixed signal that encodes its `(row, col)` position. Half the embedding dimension encodes row position with sin/cos at multiple frequencies; the other half encodes column position. The encoding is deterministic so you can swap resolutions without retraining, and it interpolates cleanly to grids the model never saw at training time.

| Component | Shape | Parameters |
|-----------|-------|------------|
| Patch projection (`Conv2d`) | `(hidden, 3, patch, patch)` | `3 * P * P * hidden + hidden` |
| Position embedding (fixed) | `(num_patches, hidden)` | 0 (computed, not learned) |
| CLS token (learned) | `(1, hidden)` | `hidden` |

For ViT-Base/16 at 224 resolution: 590,592 parameters in the projection, 768 in the CLS token, and zero for sinusoidal position. The next lesson (59) stacks a 12-layer transformer on top of this front end.

### Equivalence as a sanity check

The patch step has two spellings: a `Conv2d` projection and an explicit unfold-then-linear. They must produce the same output for the same weights. If they do not, the unfold math is wrong, and the rest of the encoder is built on sand. The tests in this lesson exercise that equivalence.

## Build It

`code/main.py` implements:

- `PatchEmbed`, an `nn.Module` wrapping `Conv2d` for patch projection.
- `sinusoidal_2d(grid_h, grid_w, dim)`, a stateless function that builds the 2D position table.
- `VisionFrontEnd`, which composes patch embedding, CLS prepend, and position addition into one forward pass.
- A `synthesize_image(seed)` helper that builds a deterministic 224x224x3 fixture from `numpy.random`.
- A demo that runs one fixture image through the front end and prints the output shape, the CLS token norm, and one row of the position embedding.

Run it:

```bash
python3 code/main.py
```

Output: the 224x224 fixture is tokenized to a sequence of shape `(1, 197, 768)`. The first token is the CLS; the next 196 are patch tokens. The position embedding norms are uniform within a row, which is the sinusoidal signature.

## Use It

The same patch front end shows up in every modern vision-language model: CLIP ViT-L/14, SigLIP, DINOv2, the Qwen-VL family, and the InternVL stack all start from a `Conv2d` patch projection plus a position signal. Differences across families live downstream (CLS vs no-CLS pooling, register tokens, varying patch sizes 14 vs 16, dynamic resolution via interpolated positions). The frontend in this lesson is the substrate every one of those models stands on.

## Tests

`code/test_main.py` covers:

- patch count matches `(image_size / patch_size) ** 2`
- output shape matches `(batch, num_patches + 1, hidden)`
- the `Conv2d` projection equals manual unfold-then-linear on a small fixture
- sinusoidal position table is deterministic across calls
- CLS token broadcasts across batch dim without leakage

Run them:

```bash
python3 -m unittest code/test_main.py
```

## Exercises

1. Replace the sinusoidal position with a learned `nn.Parameter` and compare the first-epoch loss on a tiny synthetic classification task. Learned positions win at fixed resolution; sinusoidal wins when you change resolution after training.

2. Swap the `Conv2d` for an explicit `nn.Unfold` plus `nn.Linear` and assert the outputs match to within float tolerance. Same math, two ways to spell it.

3. Add support for non-square patch sizes (e.g. 32x16 for wide-aspect inputs) and verify the position table handles non-square grids.

4. Profile the patch step at batch sizes 1, 8, 64. The patch projection is rarely the bottleneck; the attention layers downstream dominate.

5. Train the front end as a frozen feature extractor on a 4-class synthetic shape dataset (circles, squares, triangles, stars). The CLS token output should linearly separate.

## Key Terms

| Term | What it means |
|------|---------------|
| Patch | A square sub-region of the image, typically 14x14 or 16x16 |
| Patch embedding | Linear projection of one flattened patch to the hidden dim |
| Sequence length | Number of tokens after patch tokenization, usually plus CLS |
| Sinusoidal position | Fixed sin/cos signal that encodes 2D grid coordinates |
| CLS token | Learned vector prepended to the sequence as the pooling head |

## Further Reading

- An Image is Worth 16x16 Words (ViT, 2021) for the original patch-embed framing.
- Attention Is All You Need (2017) for the sinusoidal position formula adapted here to 2D.
- DINOv2 paper for register tokens, an extension you can add as exercise 6.
