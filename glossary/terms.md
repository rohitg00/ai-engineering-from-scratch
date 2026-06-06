# AI Engineering Glossary

## A

### Agent
- **What people say:** "An autonomous AI that thinks and acts on its own"
- **What it actually means:** A while loop where an LLM decides what tool to call next, executes it, sees the result, and repeats
- **Why it's called that:** Borrowed from philosophy — an "agent" is anything that can act in the world. In AI, it just means "LLM + tools + loop"

### Attention
- **What people say:** "How the AI focuses on important parts"
- **What it actually means:** A mechanism where every token computes a weighted sum of all other tokens' values, with weights determined by how relevant they are (via dot product of query and key vectors)
- **Why it's called that:** The 2017 paper "Attention Is All You Need" named it by analogy to human selective attention

### Alignment
- **What people say:** "Making AI safe"
- **What it actually means:** The technical challenge of making an AI system's behavior match human intentions, values, and preferences, including edge cases the designer didn't anticipate

### Autoregressive
- **What people say:** "The AI generates one word at a time"
- **What it actually means:** A model that predicts the next token conditioned on all previous tokens, then feeds that prediction back as input for the next step. GPT, LLaMA, and Claude are all autoregressive.

### Activation Function
- **What people say:** "The nonlinear thing between layers"
- **What it actually means:** A function applied after each linear layer that introduces nonlinearity. Without it, stacking any number of linear layers collapses to a single linear transformation. ReLU, GELU, and SiLU are the most common. The choice directly affects whether gradients flow during training.

### Adam (Optimizer)
- **What people say:** "The default optimizer"
- **What it actually means:** Adaptive Moment Estimation. Combines momentum (first moment) with adaptive learning rates per parameter (second moment). Has bias correction for early steps. Works well across most tasks without much tuning.

### AdamW
- **What people say:** "Adam but better"
- **What it actually means:** Adam with decoupled weight decay. In standard Adam, L2 regularization gets scaled by the adaptive learning rate per parameter, which is not what you want. AdamW applies weight decay directly to the weights, independent of the gradient statistics. The default optimizer for training transformers.

### Autograd
- **What people say:** "Automatic gradients"
- **What it actually means:** A system that records operations on tensors and automatically computes gradients via reverse-mode differentiation. PyTorch's autograd builds a computation graph on-the-fly (dynamic graph), while JAX uses function transformations (grad). This is what makes backpropagation practical -- you write the forward pass, and the framework computes all the derivatives.

## B

### Batch Size
- **What people say:** "How many examples at once"
- **What it actually means:** The number of training examples processed in one forward/backward pass before updating weights. Larger batches give more stable gradient estimates but use more memory. Typical values: 32-512 for training, larger for inference. Batch size interacts with learning rate -- double the batch, double the LR (linear scaling rule).

### Backpropagation
- **What people say:** "How neural networks learn"
- **What it actually means:** An algorithm that computes how much each weight contributed to the error by applying the chain rule backward through the network, then adjusts weights proportionally
- **Why it's called that:** Errors propagate backward from output to input, layer by layer

## C

### Context Window
- **What people say:** "How much the AI can remember"
- **What it actually means:** The maximum number of tokens (input + output) that fit in a single API call. Not memory — it's a fixed-size buffer that resets every call

### Chain of Thought (CoT)
- **What people say:** "Making the AI think step by step"
- **What it actually means:** A prompting technique where you ask the model to show its reasoning steps, which improves accuracy on multi-step problems because each step conditions the next token generation

### CNN (Convolutional Neural Network)
- **What people say:** "Image AI"
- **What it actually means:** A neural network that uses convolution operations (sliding filters over the input) to detect local patterns. Stacking convolutions detects increasingly complex features: edges, textures, objects.

### CUDA
- **What people say:** "GPU programming"
- **What it actually means:** NVIDIA's parallel computing platform. Lets you run matrix operations on thousands of GPU cores simultaneously. PyTorch and TensorFlow use CUDA under the hood.

### Chunking
- **What people say:** "Splitting documents into pieces"
- **What it actually means:** Breaking text into segments before embedding for retrieval. Chunk size determines the granularity of search results. Too small: loses context. Too large: dilutes relevance. Common strategies: fixed-size with overlap, sentence-based, or semantic splitting. Typical chunk size: 256-512 tokens with 10-20% overlap.

### Contrastive Learning
- **What people say:** "Learning by comparison"
- **What it actually means:** Training by pulling similar pairs closer and pushing dissimilar pairs apart in embedding space. CLIP uses this: matching image-text pairs vs non-matching ones.

### Cosine Similarity
- **What people say:** "How similar two vectors are"
- **What it actually means:** The cosine of the angle between two vectors: dot(a, b) / (||a|| * ||b||). Ranges from -1 (opposite) to 1 (identical direction). Ignores magnitude, only cares about direction. The standard similarity metric for embeddings and semantic search.

### Cross-Entropy
- **What people say:** "The classification loss"
- **What it actually means:** Measures the difference between two probability distributions. For classification: -sum(y_true * log(y_pred)). For language models: the negative log probability of the correct next token. Lower is better. Perplexity is just exp(cross-entropy).

## D

### Data Augmentation
- **What people say:** "Making more training data"
- **What it actually means:** Creating modified copies of existing data (rotate images, add noise, paraphrase text) to increase training set diversity without collecting new data. Reduces overfitting.

### Decoder
- **What people say:** "The output part"
- **What it actually means:** In transformers, a decoder uses causal (masked) self-attention so each position can only attend to earlier positions. GPT is decoder-only. BERT is encoder-only. T5 is encoder-decoder.

### Diffusion Model
- **What people say:** "AI that generates images from noise"
- **What it actually means:** A model trained to reverse a gradual noising process — it learns to predict and remove noise, and at generation time starts from pure noise and iteratively denoises

### DPO (Direct Preference Optimization)
- **What people say:** "A simpler RLHF"
- **What it actually means:** A training method that skips the reward model entirely — it directly optimizes the language model to prefer the better response in pairs of human preferences

### Dropout
- **What people say:** "Randomly turning off neurons"
- **What it actually means:** During training, randomly set a fraction of activations to zero. Forces the network to not rely on any single neuron. Turned off during inference. Simple but effective regularization.

## E

### Eigenvalue
- **What people say:** "Some math thing for PCA"
- **What it actually means:** For a matrix A, an eigenvalue lambda satisfies Av = lambda*v for some vector v. It tells you how much the matrix scales vectors in that direction. Large eigenvalues = directions of high variance in your data.

### Embedding
- **What people say:** "Some AI magic that turns words into numbers"
- **What it actually means:** A learned mapping from discrete items (words, images, users) to dense vectors in continuous space, where similar items end up close together
- **Why it's called that:** The items are "embedded" in a geometric space where distance has meaning

### Encoder
- **What people say:** "The input part"
- **What it actually means:** In transformers, an encoder uses bidirectional self-attention so each position can attend to all positions. BERT is encoder-only. Good for understanding tasks (classification, NER) but not generation.

### Epoch
- **What people say:** "One pass through the data"
- **What it actually means:** Exactly that. One complete pass through every example in the training set. Multiple epochs = seeing the data multiple times. More epochs can improve learning but risks overfitting.

## F

### Feature
- **What people say:** "A column in your data"
- **What it actually means:** An individual measurable property of the data. In classical ML, you engineer features by hand. In deep learning, the network learns features automatically from raw data.

### Few-Shot
- **What people say:** "Give the AI some examples first"
- **What it actually means:** Including a small number of input-output examples in the prompt before asking the model to perform a task. Typically 3-5 examples. The model pattern-matches on these examples to understand the desired format and behavior. Contrast with zero-shot (no examples) and fine-tuning (thousands of examples baked into weights).

### Fine-tuning
- **What people say:** "Training the AI on your data"
- **What it actually means:** Starting with a pre-trained model's weights and continuing training on a smaller, task-specific dataset. Only updates existing weights, doesn't add new knowledge from scratch

### Function Calling
- **What people say:** "AI that can use tools"
- **What it actually means:** A structured way for LLMs to request execution of external functions. You define tools with JSON Schema descriptions, the model outputs a structured JSON object specifying which function to call with what arguments, your code executes it, and the result goes back to the model. Not the same as agents -- function calling is the mechanism, agents are the loop.

## G

### Guardrails
- **What people say:** "Safety filters for AI"
- **What it actually means:** Input/output validation layers around an LLM that detect and block harmful content, prompt injection attempts, PII leakage, or off-topic responses. Typically a pipeline: input filter -> LLM -> output filter. Can be rule-based (regex, keyword lists) or model-based (classifier that scores safety).

### GPT
- **What people say:** "ChatGPT" or "The AI"
- **What it actually means:** Generative Pre-trained Transformer — a specific architecture that predicts the next token using a decoder-only transformer trained on large text corpora
- **Why it's called that:** Generative (produces text), Pre-trained (trained once on large data, then adapted), Transformer (the architecture)

### GAN (Generative Adversarial Network)
- **What people say:** "Two AIs fighting each other"
- **What it actually means:** A generator network tries to create realistic data while a discriminator network tries to tell real from fake. They train together: the generator gets better at fooling the discriminator, and the discriminator gets better at detecting fakes.

### Gradient
- **What people say:** "The slope"
- **What it actually means:** A vector of partial derivatives pointing in the direction of steepest increase. In ML, you go opposite to the gradient (gradient descent) to minimize the loss.

### Gradient Descent
- **What people say:** "How AI improves"
- **What it actually means:** An optimization algorithm that adjusts parameters in the direction that reduces the loss function most steeply, like walking downhill in a high-dimensional landscape

## H

### Hyperparameter
- **What people say:** "Settings you tune"
- **What it actually means:** Values set before training that control the training process itself: learning rate, batch size, number of layers, dropout rate. Unlike model parameters (weights), these aren't learned from data.

### Hallucination
- **What people say:** "The AI is lying" or "making things up"
- **What it actually means:** The model generates plausible-sounding text that isn't grounded in its training data or the given context — it's pattern-completing, not fact-retrieving

## I

### Inference
- **What people say:** "Running the AI"
- **What it actually means:** Using a trained model to make predictions on new data. No weight updates happen. This is what you do in production: send input, get output.

### Inductive Bias
- **What people say:** Never heard of it
- **What it actually means:** The assumptions built into a model's architecture. CNNs assume local patterns matter (convolution). RNNs assume order matters (sequential processing). Transformers assume everything might relate to everything (attention). The right bias helps the model learn faster from less data.

### JAX
- **What people say:** "Google's ML framework"
- **What it actually means:** A NumPy-compatible library that adds automatic differentiation (grad), JIT compilation (jit), automatic vectorization (vmap), and multi-device parallelism (pmap). Unlike PyTorch's object-oriented style, JAX is purely functional -- no hidden state, no in-place mutation. Used by Google DeepMind for AlphaFold, Gemini, and large-scale research.

## K

### KV Cache
- **What people say:** "Makes inference faster"
- **What it actually means:** During autoregressive generation, caching the key and value matrices from previous tokens so you don't recompute them at each step. Trades memory for speed. Essential for fast LLM inference.

## L

### Latent Space
- **What people say:** "The hidden representation"
- **What it actually means:** A compressed, learned representation space where similar inputs map to nearby points. Autoencoders, VAEs, and diffusion models all work in latent space. It's lower-dimensional than the input but captures the important structure.

### Learning Rate
- **What people say:** "How fast the AI learns"
- **What it actually means:** A scalar that controls step size during gradient descent. Too high: overshoots the minimum and diverges. Too low: converges too slowly or gets stuck. The single most important hyperparameter.

### LLM (Large Language Model)
- **What people say:** "AI" or "the brain"
- **What it actually means:** A transformer-based neural network trained to predict the next token in a sequence, with billions of parameters, trained on internet-scale text data

### LoRA (Low-Rank Adaptation)
- **What people say:** "Efficient fine-tuning"
- **What it actually means:** Instead of updating all weights, insert small low-rank matrices alongside the original weights. Only these small matrices are trained, reducing memory by 10-100x

### Loss Function
- **What people say:** "How wrong the AI is"
- **What it actually means:** A function that measures the gap between predicted and actual output. Training minimizes this function. MSE for regression, cross-entropy for classification, contrastive loss for embeddings. The choice of loss function defines what "good" means to the model.

## M

### Mixed Precision
- **What people say:** "Training trick for speed"
- **What it actually means:** Using float16 for forward pass and most operations (faster, less memory) but keeping float32 for gradient accumulation and weight updates (more precise). Gets 2x speedup with negligible accuracy loss.

### MoE (Mixture of Experts)
- **What people say:** "Only part of the model runs"
- **What it actually means:** A model with many "expert" subnetworks where a routing mechanism sends each input to only a few experts. The full model is huge but each forward pass is cheap because most experts are skipped. Mixtral and GPT-4 use this.

### MCP (Model Context Protocol)
- **What people say:** "A way for AI to use tools"
- **What it actually means:** An open protocol (JSON-RPC over stdio/HTTP) that standardizes how AI applications connect to external data sources and tools, with typed schemas for tools, resources, and prompts

## N

### NaN (Not a Number)
- **What people say:** "Training crashed"
- **What it actually means:** A floating-point value indicating undefined results (0/0, inf-inf). In training, NaN loss usually means: learning rate too high, exploding gradients, log of zero, or division by zero. Always the first thing to check when training fails.

### Normalization
- **What people say:** "Scaling the data"
- **What it actually means:** Adjusting values to a standard range. Batch normalization normalizes across a batch. Layer normalization normalizes across features. Both stabilize training and allow higher learning rates.

## O

### Overfitting
- **What people say:** "The model memorized the data"
- **What it actually means:** The model performs well on training data but poorly on unseen data. It learned the noise, not the signal. Fix with: more data, regularization (dropout, weight decay), early stopping, data augmentation, simpler model.

### Optimizer
- **What people say:** "The thing that updates weights"
- **What it actually means:** An algorithm that uses gradients to update model parameters. SGD is the simplest. Adam is the most common. Each optimizer has different properties: convergence speed, memory usage, sensitivity to hyperparameters.

## P

### Parameter
- **What people say:** "Model size"
- **What it actually means:** A learnable value in the model, typically a weight or bias. "7B parameters" means 7 billion learnable numbers. Each float32 parameter takes 4 bytes, so 7B parameters = 28GB of memory just for the weights.

### Perplexity
- **What people say:** "How confused the model is"
- **What it actually means:** The exponential of the average cross-entropy loss. Lower is better. A perplexity of 10 means the model is as uncertain as if it were choosing uniformly among 10 tokens at each step.

### Precision & Recall
- **What people say:** "Accuracy metrics"
- **What it actually means:** Precision = of items you flagged, how many were correct. Recall = of all correct items, how many did you find. They trade off: catching every spam email (high recall) means more false alarms (low precision). F1 score is their harmonic mean. Use precision when false positives are costly, recall when false negatives are costly.

### Prompt Engineering
- **What people say:** "Talking to AI the right way"
- **What it actually means:** Designing the input text to reliably produce desired outputs -- including system prompts, few-shot examples, format instructions, and chain-of-thought triggers

### Prompt Injection
- **What people say:** "Hacking the AI with words"
- **What it actually means:** An attack where malicious text in the input overrides the system prompt or instructions. Direct injection: user types "Ignore previous instructions." Indirect injection: a retrieved document contains hidden instructions. The LLM equivalent of SQL injection. No complete solution exists -- defense is layers of input validation, output filtering, and privilege separation.

## Q

### QLoRA
- **What people say:** "LoRA but cheaper"
- **What it actually means:** Quantized LoRA. Keeps the frozen base model weights in 4-bit precision (NF4 format) while training LoRA adapters in 16-bit. Reduces memory by another 3-4x compared to standard LoRA. A 7B model that needs 14GB with LoRA fits in 4-6GB with QLoRA. Quality is within 1% of full fine-tuning on most benchmarks.

## R

### RAG (Retrieval-Augmented Generation)
- **What people say:** "AI that can search"
- **What it actually means:** A pattern where you retrieve relevant documents from a knowledge base (using embedding similarity), stuff them into the prompt, and let the LLM answer based on that context
- **Why it's called that:** Retrieval (find documents) + Augmented (add to prompt) + Generation (LLM writes the answer)

### RLHF (Reinforcement Learning from Human Feedback)
- **What people say:** "How they make AI helpful"
- **What it actually means:** A training pipeline: (1) collect human preferences on model outputs, (2) train a reward model on those preferences, (3) use PPO to optimize the LLM to produce higher-reward outputs

### Quantization
- **What people say:** "Making the model smaller"
- **What it actually means:** Reducing the precision of model weights from float32 (4 bytes) to int8 (1 byte) or int4 (0.5 bytes). Trades a small amount of accuracy for 4-8x less memory and faster inference. GPTQ, AWQ, and GGUF are common formats.

### ReLU
- **What people say:** "Activation function"
- **What it actually means:** Rectified Linear Unit: f(x) = max(0, x). The simplest non-linear activation. Fast to compute, doesn't saturate for positive values. Used everywhere because it works and is cheap. Variants: LeakyReLU, GELU, SiLU.

### ROUGE
- **What people say:** "Summarization metric"
- **What it actually means:** Recall-Oriented Understudy for Gisting Evaluation. Measures overlap between generated text and reference text. ROUGE-1 counts unigram matches, ROUGE-2 counts bigram matches, ROUGE-L finds the longest common subsequence. Cheap to compute but only measures surface similarity -- two sentences with the same meaning but different words score poorly.

## S

### Semantic Search
- **What people say:** "Smart search that understands meaning"
- **What it actually means:** Finding documents by meaning rather than keyword matching. Embed the query and all documents into the same vector space, then return documents whose embeddings are closest to the query embedding. "payment failed" finds "transaction declined" even though they share no words. Powered by embedding models + vector databases.

### Streaming
- **What people say:** "Seeing the response appear word by word"
- **What it actually means:** The LLM sends tokens as they are generated rather than waiting for the complete response. Uses Server-Sent Events (SSE) or WebSocket protocols. Reduces perceived latency from seconds to milliseconds for the first token. Essential for production chat interfaces. Each chunk contains a delta (partial token or word).

### Self-Attention
- **What people say:** "How the model decides what to focus on"
- **What it actually means:** Each token computes query, key, and value vectors. Attention weight between two tokens = dot product of their query and key, scaled and softmaxed. Output = weighted sum of value vectors. Lets every token see every other token.

### SFT (Supervised Fine-Tuning)
- **What people say:** "Teaching the model to follow instructions"
- **What it actually means:** Fine-tuning a pre-trained model on (instruction, response) pairs. The model learns to generate the response given the instruction. This is what turns a base model into a chat model.

### Softmax
- **What people say:** "Turns numbers into probabilities"
- **What it actually means:** softmax(x_i) = exp(x_i) / sum(exp(x_j)). Transforms a vector of arbitrary real numbers into a probability distribution (all positive, sums to 1). Used in classification heads, attention weights, and anywhere you need probabilities.

### Swarm
- **What people say:** "A bunch of AI agents working together like bees"
- **What it actually means:** Multiple agents sharing state and coordinating through message passing, with emergent behavior arising from simple individual rules rather than central control

## T

### System Prompt
- **What people say:** "The AI's instructions"
- **What it actually means:** A special message at the start of a conversation that sets the model's behavior, persona, and constraints. Processed before user messages. Not visible to the user in most UIs. Defines what the model should and shouldn't do, its tone, format preferences, and domain focus. Different from user prompts -- system prompts are set by the developer.

### Tensor
- **What people say:** "A multi-dimensional array"
- **What it actually means:** The fundamental data structure in deep learning frameworks. A 0D tensor is a scalar, 1D is a vector, 2D is a matrix, 3D+ is a tensor. In PyTorch and JAX, tensors track their computation history for automatic differentiation and can live on CPU or GPU. All neural network inputs, outputs, weights, and gradients are tensors.

### Token
- **What people say:** "A word"
- **What it actually means:** A subword unit (typically 3-4 characters in English) produced by a tokenizer like BPE. "unbelievable" might be 3 tokens: "un" + "believ" + "able"

### Temperature
- **What people say:** "Creativity setting"
- **What it actually means:** A scalar that divides logits before softmax. Temperature=1 is default. Higher = flatter distribution = more random outputs. Lower = sharper distribution = more deterministic. Temperature=0 is argmax (always pick the most likely token).

### Transfer Learning
- **What people say:** "Using a pre-trained model"
- **What it actually means:** Taking a model trained on one task and adapting it to a different task. The early layers learn general features (edges, syntax patterns) that transfer. Only the later layers need task-specific training. This is why you can fine-tune BERT for any NLP task.

### Transformer
- **What people say:** "The architecture behind modern AI"
- **What it actually means:** A neural network architecture that processes sequences using self-attention (letting every position attend to every other position) instead of recurrence, enabling massive parallelization
- **Why it's called that:** It transforms input representations into output representations through attention layers

## U

### Underfitting
- **What people say:** "The model isn't learning"
- **What it actually means:** The model is too simple to capture the patterns in the data. Training loss stays high. Fix with: more parameters, more layers, longer training, lower regularization, better features.

## V

### VAE (Variational Autoencoder)
- **What people say:** "A generative model"
- **What it actually means:** An autoencoder that learns a smooth latent space by forcing the encoder output to follow a Gaussian distribution. You can sample from this distribution and decode to generate new data. The reparameterization trick makes it trainable via backpropagation.

### Vector Database
- **What people say:** "A special database for AI"
- **What it actually means:** A database optimized for storing vectors (dense arrays of floats) and performing fast approximate nearest-neighbor search. The core operation in similarity search, RAG, and recommendation systems.

## W

### Weight
- **What people say:** "What the model learned"
- **What it actually means:** A single number in a model's parameter matrix. A linear layer with input size 768 and output size 3072 has 768*3072 = 2,359,296 weights. Training adjusts each weight to minimize the loss function.

### Weight Decay
- **What people say:** "Regularization"
- **What it actually means:** Adding a penalty proportional to the magnitude of weights to the loss function. Equivalent to L2 regularization. Prevents weights from growing too large. Typical value: 0.01-0.1.

## Z

### Zero-Shot
- **What people say:** "No training needed"
- **What it actually means:** Using a model on a task it wasn't explicitly trained for, with no task-specific examples in the prompt. The model generalizes from pre-training. Works because large models have seen enough variety to handle new task formats.
