const lesson = (path, title) => ({ href: `/lesson?path=${encodeURIComponent(path)}`, title });
const manual = (anchor, title) => ({ href: `manual-sglang-101.html#${anchor}`, title });
const P17 = "phases/17-infrastructure-and-production/";

export const PART_ORDER = ["ingress", "tokenizer", "scheduler", "link", "sms", "l2", "weights", "pool", "detok", "package", "cooler"];

export const NAMES = {
  ingress: "PROMPT IN",
  tokenizer: "TOKENIZER",
  scheduler: "SCHEDULER",
  link: { l4: "PCIE GEN4 X16", gb10: "NVLINK-C2C" },
  sms: "SMs + TENSOR CORES",
  l2: "L2 CACHE",
  weights: "WEIGHTS",
  pool: "KV POOL",
  detok: "DETOKENIZER",
  package: "PACKAGE",
  cooler: "COOLER",
};

export const INFO = {
  ingress: {
    name: "Network port",
    is: "Where the request enters the machine and where the answer leaves it.",
    does: {
      l4: "The request arrives at the host CPU over the network. The GPU never sees text. It sees token ids that the host sends over PCIe.",
      gb10: "The request arrives at the CPU dielet of the GB10 over the network. The CPU and the GPU share one memory, so the text and the token ids never cross a card slot.",
    },
    why: "The serving engine is three processes on the CPU and one model on the GPU. The port is the edge of that system.",
    without: "Nothing reaches the engine.",
    lesson: manual("s-what-the-server-does-with-your-request", "SGLang 101, section 1.3: what the server does with your request"),
  },
  tokenizer: {
    name: "Tokenizer process",
    is: "The first of the three SGLang processes. It runs on the CPU.",
    does: { l4: "It turns the prompt text into token ids on the host CPU. The machine shows 512 ids for the load test and up to 4,224 for the longest shared prompt.", gb10: "It turns the prompt text into token ids on one of the 20 Arm cores. The drawing puts it on the first cluster of 10 cores." },
    why: "The model reads token ids, not text, and the count of ids decides the KV cost of the request.",
    without: "The scheduler has nothing to count, so it cannot admit the request.",
    lesson: manual("s-sglang-serve-and-the-three-processes", "SGLang 101, section 2.1: the three processes"),
  },
  scheduler: {
    name: "Scheduler process",
    is: "The process that decides which requests run in the next GPU step.",
    does: { l4: "It admits a request only when the KV pool has room for its prompt and its output. On the L4 with BF16 the pool holds 24,094 tokens, so 37 requests of 640 tokens fit. The radix tree that finds shared prefixes lives here too.", gb10: "It admits a request only when the KV pool has room. On the GB10 with BF16 the pool holds 234,600 tokens, so 64 requests use about 17 percent of it. The radix tree that finds shared prefixes lives here too." },
    why: "The pool is the hard limit. Every admission is a decision about memory, not about compute.",
    without: "Requests would overrun the pool, and the engine would have to retract them in the middle of decode.",
    lesson: manual("s-admission-and-retraction", "SGLang 101, section 2.3: admission and retraction"),
  },
  link: {
    name: { l4: "PCIe Gen4 x16 slot and riser", gb10: "NVLink-C2C between the dielets" },
    is: { l4: "The link between the host and the card. NVIDIA lists PCIe Gen4 x16 for the L4.", gb10: "The chip-to-chip link between the CPU dielet and the GPU dielet. NVIDIA gives the GPU about 600 GB/s of aggregate bandwidth over it." },
    does: { l4: "The token ids cross it once per request. Without CUDA graphs, every kernel launch of every decode step also crosses it as a command from the host.", gb10: "The GPU dielet reads the token ids, the weights and the KV cache from the shared LPDDR5X through it. The memory controllers sit on the CPU dielet." },
    why: "A launch costs microseconds. A decode step costs tens of milliseconds. So launch gaps are small next to the weight read, and CUDA graphs changed the measured step time on the L4 by under 1 percent up to 16 users.",
    without: { l4: "The GPU has no work and no inputs.", gb10: "The GPU dielet cannot reach the memory, because the memory subsystem is on the other dielet." },
    lesson: manual("s-forwardmode-and-cuda-graphs", "SGLang 101, section 4.1: CUDA graphs"),
  },
  sms: {
    name: { l4: "58 streaming multiprocessors", gb10: "The SM field of the GPU dielet" },
    is: { l4: "The compute units of the AD104 die. NVIDIA lists 58 SMs in 5 GPCs, with 4 fourth-generation Tensor Cores in each SM, 232 in all.", gb10: "The compute units of the Blackwell GPU dielet. NVIDIA lists 6,144 CUDA cores and fifth-generation Tensor Cores, and does not publish the SM count, so the drawing shows abstract tiles." },
    does: "Prefill sends hundreds or thousands of tokens through every layer at once, so the Tensor Cores stay busy. Decode sends one token per running request through every layer, so the SMs wait for the weights most of the time.",
    why: "The same silicon is compute bound in prefill and memory bound in decode.",
    without: "Nothing computes.",
    lesson: lesson(P17 + "08-inference-metrics-goodput", "Inference metrics and goodput"),
  },
  l2: {
    name: { l4: "L2 cache, 48 MB", gb10: "Graphics L2, 24 MB" },
    is: "The cache between the memory controllers and the SMs.",
    does: { l4: "Every weight passes through the L2 on its way to the SMs. At 48 MB it holds about 0.3 percent of the 16.41 GB of BF16 weights, so each decode step streams the weights from GDDR6 again.", gb10: "Every weight passes through the 24 MB graphics L2 on its way to the SMs. The weights are tens of GB, so each decode step streams the chosen experts from LPDDR5X again." },
    why: "A cache helps when data is used again soon. The weights of a large model are used once per step and are far larger than the cache.",
    without: "The SMs would reach for memory with no staging, and nothing else would change much: the bandwidth of the memory sets the pace.",
    lesson: manual("s-forwardmode-and-cuda-graphs", "SGLang 101, section 4.1"),
  },
  weights: {
    name: { l4: "Weights in GDDR6", gb10: "Weights in LPDDR5X" },
    is: { l4: "The region of memory that holds the model. The startup log says 15.28 GB of BF16 weights for Qwen3-8B, or 8.81 GB for the FP8 checkpoint.", gb10: "The region of unified memory that holds the model. The startup log says 57.75 GB of BF16 weights for Qwen3-30B-A3B, or 29.75 GB for FP8." },
    does: { l4: "Memory is interleaved across the 32-bit channels, so every package holds a slice of every tensor. A decode step reads all of them, from all six channels at once. At the peak 300 GB/s, 16.41 GB takes 54.7 ms. The measured step at one user took 60.16 ms.", gb10: "The model is a mixture of experts, so a decode step reads only the experts that its tokens picked. The memory is shared with the CPU and gives 273 GB/s." },
    why: "This is the read that sets the pace of decode. Halve the bytes and the step gets faster: FP8 took the L4 step from 60.16 to 39.66 ms at one user.",
    without: "There is no model.",
    lesson: lesson(P17 + "09-production-quantization", "Production quantization"),
  },
  pool: {
    name: "KV pool",
    is: "The token slots that hold the keys and values of every running request and every cached prefix.",
    does: "SGLang sizes the pool at startup from the memory fraction and counts it in tokens. Each cell on the packages stands for a share of the pool. Yellow cells are this request, teal cells are other requests, orange cells are shared prefixes that the radix tree reuses.",
    why: "The pool decides how many users fit. On the L4, FP8 grew it from 24,094 to 142,369 tokens. At a memory fraction of 0.74 it shrank to 6,559 tokens for BF16, and four 2,048-token prefixes no longer fitted.",
    without: "Every decode step would compute the keys and values of the whole conversation again.",
    lesson: manual("s-kv-bytes-per-token-and-the-kv-pool", "SGLang 101, section 3.1: the KV pool"),
  },
  detok: {
    name: "Detokenizer process",
    is: "The third SGLang process. It runs on the CPU.",
    does: "It turns each new token id back into text and streams it to the client.",
    why: "Streaming lets the user read the first token after the time to first token, not after the whole answer.",
    without: "The client gets token ids, or waits for the whole answer.",
    lesson: manual("s-streaming-stop-strings-and-the-openai-api", "SGLang 101, section 2.5: streaming"),
  },
  package: {
    name: { l4: "GPU package: substrate, die and balls", gb10: "GB10 package: two dielets on one substrate" },
    is: { l4: "The AD104 die sits on a substrate, and the substrate sits on a grid of solder balls on the card. Explode the machine to see the layers. NVIDIA does not publish the die size or the ball count, so both are drawn to a plausible size.", gb10: "An S-dielet with the CPU and the memory subsystem and a G-dielet with the GPU, both on TSMC 3nm, in 2.5D packaging. Explode the machine to see the layers." },
    does: "The balls carry power and every memory and PCIe signal from the board into the package. The bumps under the die carry them into the silicon.",
    why: "Every byte of every weight crosses these pins on every decode step.",
    without: "The die has no power and no memory.",
    lesson: lesson(P17 + "28-self-hosted-serving-selection", "Self-hosted serving selection"),
  },
  cooler: {
    name: { l4: "Passive heatsink", gb10: "Cooler" },
    is: { l4: "The L4 is a 72 W card with passive cooling. The server fans push air through it.", gb10: "The GB10 chip has a TDP of 140 W for the CPU and the GPU together." },
    does: "It is drawn see-through so that the die and the memory stay in view. Explode the machine to lift it off.",
    why: { l4: "Our first L4 sweep ran at 87 C with a thermal slowdown and an SM clock of 360 MHz. The step at one user took 103.38 ms instead of 60.16 ms.", gb10: "A hot chip slows its clock. Record the clock and the temperature with every benchmark." },
    without: "The clock drops and every number on the page gets worse.",
    lesson: manual("s-sglang-benchmark-serving", "SGLang 101, section 5.1: record the GPU clock"),
  },
};

export const SCENARIOS = [
  { label: "Healthy L4", note: "BF16, 8 users, 112.62 tok/s.", config: {} },
  { label: "One user", note: "The weight read sets the step: 60.16 ms.", config: { users: 1 } },
  { label: "Pool full", note: "64 users, 37 fit, 27 wait.", config: { users: 64 } },
  { label: "FP8 at 64 users", note: "142,369-token pool, 735.91 tok/s.", config: { dtype: "fp8", users: 64 } },
  { label: "Small pool, long prefix", note: "0.74, 2,048 shared tokens: the prefixes fall out.", config: { workload: "shared", shared: 2048, frac: "0.74" } },
  { label: "Same, with FP8", note: "107,299 tokens keep every prefix.", config: { workload: "shared", shared: 2048, frac: "0.74", dtype: "fp8" } },
  { label: "Radix cache off", note: "4,096 shared tokens computed again.", config: { workload: "shared", shared: 4096, radix: false } },
  { label: "CUDA graphs off", note: "Launch gaps: 0.47 ms of 60.63.", config: { graphs: false, users: 1 } },
  { label: "Hot card", note: "Throttled clock: 103.38 ms per step.", config: { clock: "hot", users: 1 } },
  { label: "GB10, one user", note: "Unified memory, 32.52 ms per step.", config: { gpu: "gb10", users: 1 } },
  { label: "GB10 with FP8", note: "Half the bytes: 18.41 ms per step.", config: { gpu: "gb10", dtype: "fp8", users: 1 } },
];

export const BREAK_NOTES = [
  "Broke the pool: 64 users, the BF16 pool holds 37 of them.",
  "Broke the prefixes: a 0.74 memory fraction leaves 6,559 tokens.",
  "Broke the cooling: the card throttles to 360 MHz.",
  "Broke the cache: the radix tree is off.",
  "Broke the graphs: every kernel launches from the host.",
];
