import numpy as np
import heapq


class KVCache:
    def __init__(self, num_layers, num_heads, head_dim, max_seq_len, dtype=np.float16):
        self.num_layers = num_layers
        self.num_heads = num_heads
        self.head_dim = head_dim
        self.max_seq_len = max_seq_len
        self.dtype = dtype

        self.k_cache = np.zeros(
            (num_layers, num_heads, max_seq_len, head_dim), dtype=dtype
        )
        self.v_cache = np.zeros(
            (num_layers, num_heads, max_seq_len, head_dim), dtype=dtype
        )
        self.seq_len = 0

    def update(self, layer_idx, new_keys, new_values):
        num_new = new_keys.shape[1]
        end = self.seq_len + num_new
        self.k_cache[layer_idx, :, self.seq_len:end, :] = new_keys
        self.v_cache[layer_idx, :, self.seq_len:end, :] = new_values
        return (
            self.k_cache[layer_idx, :, :end, :],
            self.v_cache[layer_idx, :, :end, :]
        )

    def advance(self, num_tokens):
        self.seq_len += num_tokens

    def memory_bytes(self):
        return self.k_cache.nbytes + self.v_cache.nbytes

    def used_bytes(self):
        per_token = 2 * self.num_layers * self.num_heads * self.head_dim * np.dtype(self.dtype).itemsize
        return per_token * self.seq_len


def scaled_dot_product_attention(query, keys, values):
    head_dim = query.shape[-1]
    scores = np.matmul(query, keys.transpose(0, 1, 3, 2)) / np.sqrt(head_dim)
    seq_len_q = scores.shape[-2]
    seq_len_k = scores.shape[-1]
    if seq_len_q > 1:
        mask = np.triu(np.ones((seq_len_q, seq_len_k), dtype=np.float32), k=seq_len_k - seq_len_q + 1)
        scores = scores + mask * (-1e9)
    max_scores = np.max(scores, axis=-1, keepdims=True)
    exp_scores = np.exp(scores - max_scores)
    attn_weights = exp_scores / np.sum(exp_scores, axis=-1, keepdims=True)
    return np.matmul(attn_weights, values)


class MultiHeadAttention:
    def __init__(self, d_model, num_heads):
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads
        scale = np.sqrt(2.0 / d_model)
        self.W_q = np.random.randn(d_model, d_model).astype(np.float32) * scale
        self.W_k = np.random.randn(d_model, d_model).astype(np.float32) * scale
        self.W_v = np.random.randn(d_model, d_model).astype(np.float32) * scale
        self.W_o = np.random.randn(d_model, d_model).astype(np.float32) * scale

    def forward(self, x, kv_cache=None, layer_idx=0):
        batch, seq_len, d_model = x.shape
        Q = np.matmul(x, self.W_q).reshape(batch, seq_len, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
        K = np.matmul(x, self.W_k).reshape(batch, seq_len, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
        V = np.matmul(x, self.W_v).reshape(batch, seq_len, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)

        if kv_cache is not None:
            K_full, V_full = kv_cache.update(layer_idx, K[0], V[0])
            K = K_full[np.newaxis, :, :, :]
            V = V_full[np.newaxis, :, :, :]
            if seq_len == 1:
                kv_cache.advance(1)

        attn_out = scaled_dot_product_attention(Q, K, V)
        attn_out = attn_out.transpose(0, 2, 1, 3).reshape(batch, -1, d_model)
        return np.matmul(attn_out, self.W_o)


class Request:
    def __init__(self, request_id, prompt_tokens, output_tokens, arrival_step):
        self.request_id = request_id
        self.prompt_tokens = prompt_tokens
        self.output_tokens = output_tokens
        self.arrival_step = arrival_step
        self.tokens_generated = 0
        self.start_step = None
        self.end_step = None

    def is_done(self):
        return self.tokens_generated >= self.output_tokens


def simulate_static_batching(requests, batch_size):
    step = 0
    completed = []
    queue = sorted(requests, key=lambda r: r.arrival_step)

    while queue:
        batch = []
        while queue and len(batch) < batch_size:
            r = queue.pop(0)
            r.start_step = max(step, r.arrival_step)
            batch.append(r)

        if batch:
            step = max(step, max(r.start_step for r in batch))
            max_output = max(r.output_tokens for r in batch)
            for r in batch:
                r.tokens_generated = r.output_tokens
                r.end_step = step + max_output
            step += max_output
            completed.extend(batch)

    return completed


def simulate_continuous_batching(requests, batch_size):
    step = 0
    completed = []
    queue = sorted(requests, key=lambda r: r.arrival_step)
    queue_idx = 0
    active = []
    waiting = []

    while queue_idx < len(queue) or active or waiting:
        while queue_idx < len(queue) and queue[queue_idx].arrival_step <= step:
            waiting.append(queue[queue_idx])
            queue_idx += 1

        while waiting and len(active) < batch_size:
            r = waiting.pop(0)
            r.start_step = step
            active.append(r)

        if not active:
            if waiting:
                step += 1
                continue
            elif queue_idx < len(queue):
                step = queue[queue_idx].arrival_step
                continue
            else:
                break

        for r in active:
            r.tokens_generated += 1

        done = [r for r in active if r.is_done()]
        for r in done:
            r.end_step = step + 1
            completed.append(r)
        active = [r for r in active if not r.is_done()]

        step += 1

    return completed


def batching_stats(completed):
    latencies = [r.end_step - r.arrival_step for r in completed]
    total_time = max(r.end_step for r in completed) - min(r.arrival_step for r in completed)
    total_tokens = sum(r.output_tokens for r in completed)
    return {
        "avg_latency": np.mean(latencies),
        "p50_latency": np.median(latencies),
        "p99_latency": np.percentile(latencies, 99),
        "total_time": total_time,
        "throughput": total_tokens / total_time if total_time > 0 else 0,
    }


class TrieNode:
    def __init__(self):
        self.children = {}
        self.kv_data = None
        self.hit_count = 0


class PrefixCache:
    def __init__(self, max_entries=1000):
        self.root = TrieNode()
        self.max_entries = max_entries
        self.total_entries = 0
        self.hits = 0
        self.misses = 0

    def _walk(self, token_ids):
        node = self.root
        depth = 0
        for tid in token_ids:
            if tid not in node.children:
                break
            node = node.children[tid]
            depth += 1
        return node, depth

    def lookup(self, token_ids):
        node, depth = self._walk(token_ids)
        if depth > 0:
            self.hits += 1
            current = self.root
            for tid in token_ids[:depth]:
                current = current.children[tid]
                current.hit_count += 1
            kv_entries = []
            current = self.root
            for tid in token_ids[:depth]:
                current = current.children[tid]
                if current.kv_data is not None:
                    kv_entries.append(current.kv_data)
            return depth, kv_entries
        self.misses += 1
        return 0, []

    def insert(self, token_ids, kv_per_token):
        node = self.root
        for i, tid in enumerate(token_ids):
            if tid not in node.children:
                if self.total_entries >= self.max_entries:
                    return i
                node.children[tid] = TrieNode()
                self.total_entries += 1
            node = node.children[tid]
            if i < len(kv_per_token):
                node.kv_data = kv_per_token[i]
        return len(token_ids)

    def hit_rate(self):
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


class DraftModel:
    def __init__(self, vocab_size, acceptance_rate=0.8):
        self.vocab_size = vocab_size
        self.acceptance_rate = acceptance_rate

    def generate(self, context, num_tokens):
        return np.random.randint(0, self.vocab_size, size=num_tokens)

    def get_probs(self, context, token):
        return np.random.dirichlet(np.ones(self.vocab_size))


class TargetModel:
    def __init__(self, vocab_size):
        self.vocab_size = vocab_size

    def get_probs(self, context, tokens=None):
        if tokens is not None:
            return [np.random.dirichlet(np.ones(self.vocab_size)) for _ in tokens]
        return np.random.dirichlet(np.ones(self.vocab_size))


def speculative_decode(draft_model, target_model, context, num_speculative=5,
                       draft_cost=1.0, target_cost=10.0, verify_cost=12.0):
    total_tokens = 0
    total_cost = 0.0
    accepted_counts = []
    context = list(context)
    max_tokens = 100

    while total_tokens < max_tokens:
        draft_tokens = draft_model.generate(context, num_speculative)
        total_cost += draft_cost * num_speculative

        target_probs = target_model.get_probs(context, draft_tokens)
        total_cost += verify_cost

        accepted = 0
        for i, token in enumerate(draft_tokens):
            draft_p = draft_model.get_probs(context + list(draft_tokens[:i]), token)
            target_p = target_probs[i]

            r = np.random.random()

            if r < draft_model.acceptance_rate:
                accepted += 1
                context.append(token)
                total_tokens += 1
            else:
                new_token = np.random.choice(draft_model.vocab_size, p=target_p)
                context.append(new_token)
                total_tokens += 1
                break

        accepted_counts.append(accepted)

        if accepted == num_speculative:
            bonus_probs = target_model.get_probs(context)
            bonus_token = np.random.choice(draft_model.vocab_size, p=bonus_probs)
            context.append(bonus_token)
            total_tokens += 1

    sequential_cost = total_tokens * target_cost
    return {
        "total_tokens": total_tokens,
        "speculative_cost": total_cost,
        "sequential_cost": sequential_cost,
        "speedup": sequential_cost / total_cost if total_cost > 0 else 1.0,
        "avg_accepted": np.mean(accepted_counts),
        "acceptance_rate": np.mean(accepted_counts) / num_speculative,
    }


MODEL_CONFIGS = {
    "Llama-3-8B": {
        "num_layers": 32, "num_kv_heads": 8, "head_dim": 128,
        "model_params_b": 8, "gqa": True,
    },
    "Llama-3-70B": {
        "num_layers": 80, "num_kv_heads": 8, "head_dim": 128,
        "model_params_b": 70, "gqa": True,
    },
    "Llama-3-405B": {
        "num_layers": 126, "num_kv_heads": 8, "head_dim": 128,
        "model_params_b": 405, "gqa": True,
    },
    "Mistral-7B": {
        "num_layers": 32, "num_kv_heads": 8, "head_dim": 128,
        "model_params_b": 7, "gqa": True,
    },
    "GPT-4-est": {
        "num_layers": 120, "num_kv_heads": 96, "head_dim": 128,
        "model_params_b": 1800, "gqa": False,
    },
}


def kv_cache_memory(config, seq_len, dtype_bytes=2):
    per_token = 2 * config["num_layers"] * config["num_kv_heads"] * config["head_dim"] * dtype_bytes
    total = per_token * seq_len
    return {
        "per_token_bytes": per_token,
        "per_token_kb": per_token / 1024,
        "total_bytes": total,
        "total_mb": total / (1024 ** 2),
        "total_gb": total / (1024 ** 3),
    }


def memory_budget(config, gpu_memory_gb, model_dtype_bytes=2, kv_dtype_bytes=2):
    model_memory_gb = config["model_params_b"] * 1e9 * model_dtype_bytes / (1024 ** 3)
    overhead_gb = gpu_memory_gb * 0.1
    available_for_kv = gpu_memory_gb - model_memory_gb - overhead_gb

    if available_for_kv <= 0:
        return {"error": "Model does not fit in GPU memory", "model_memory_gb": model_memory_gb}

    per_token = 2 * config["num_layers"] * config["num_kv_heads"] * config["head_dim"] * kv_dtype_bytes
    max_tokens = int(available_for_kv * (1024 ** 3) / per_token)

    return {
        "gpu_memory_gb": gpu_memory_gb,
        "model_memory_gb": round(model_memory_gb, 1),
        "overhead_gb": round(overhead_gb, 1),
        "available_for_kv_gb": round(available_for_kv, 1),
        "max_total_tokens": max_tokens,
        "max_users_at_2k": max_tokens // 2048,
        "max_users_at_4k": max_tokens // 4096,
        "max_users_at_32k": max_tokens // 32768,
    }


if __name__ == "__main__":
    np.random.seed(42)

    print("=" * 70)
    print("STEP 1: KV Cache Memory Analysis")
    print("=" * 70)

    print(f"\n  {'Model':<20s} {'Per Token':>12s} {'@ 4K ctx':>12s} {'@ 32K ctx':>12s} {'@ 128K ctx':>12s}")
    print("  " + "-" * 68)

    for name, config in MODEL_CONFIGS.items():
        mem_4k = kv_cache_memory(config, 4096)
        mem_32k = kv_cache_memory(config, 32768)
        mem_128k = kv_cache_memory(config, 131072)
        pt = kv_cache_memory(config, 1)
        print(f"  {name:<20s} {pt['per_token_kb']:>10.1f}KB {mem_4k['total_gb']:>10.2f}GB "
              f"{mem_32k['total_gb']:>10.2f}GB {mem_128k['total_gb']:>10.2f}GB")

    print(f"\n  Memory budget for Llama 3 70B on different GPU configs:")
    print(f"  {'GPU Config':<25s} {'Model':>8s} {'KV Avail':>10s} {'@2K users':>10s} {'@4K users':>10s}")
    print("  " + "-" * 63)

    config_70b = MODEL_CONFIGS["Llama-3-70B"]
    for gpu_name, gpu_gb in [("1xA100-80GB", 80), ("2xA100-80GB", 160), ("4xA100-80GB", 320), ("8xH100-80GB", 640)]:
        budget = memory_budget(config_70b, gpu_gb)
        if "error" in budget:
            print(f"  {gpu_name:<25s} {budget['model_memory_gb']:>7.1f}GB   DOES NOT FIT")
        else:
            print(f"  {gpu_name:<25s} {budget['model_memory_gb']:>7.1f}GB {budget['available_for_kv_gb']:>9.1f}GB "
                  f"{budget['max_users_at_2k']:>10d} {budget['max_users_at_4k']:>10d}")

    print("\n" + "=" * 70)
    print("STEP 2: KV Cache with Attention")
    print("=" * 70)

    d_model = 64
    num_heads = 4
    seq_len = 8
    head_dim = d_model // num_heads

    cache = KVCache(num_layers=1, num_heads=num_heads, head_dim=head_dim, max_seq_len=128)
    attn = MultiHeadAttention(d_model, num_heads)

    prompt = np.random.randn(1, seq_len, d_model).astype(np.float32)
    prefill_out = attn.forward(prompt, kv_cache=cache, layer_idx=0)
    cache.advance(seq_len)

    print(f"\n  Prefill: {seq_len} tokens processed")
    print(f"  KV cache after prefill: {cache.seq_len} tokens, {cache.used_bytes()} bytes")
    print(f"  Output shape: {prefill_out.shape}")

    for step in range(4):
        new_token = np.random.randn(1, 1, d_model).astype(np.float32)
        decode_out = attn.forward(new_token, kv_cache=cache, layer_idx=0)
        print(f"  Decode step {step + 1}: cache={cache.seq_len} tokens, "
              f"output shape={decode_out.shape}, used={cache.used_bytes()} bytes")

    print("\n" + "=" * 70)
    print("STEP 3: Static vs Continuous Batching")
    print("=" * 70)

    def make_requests(n=30, seed=42):
        rng = np.random.RandomState(seed)
        requests = []
        for i in range(n):
            arrival = rng.randint(0, 20)
            output_len = int(rng.pareto(1.5) * 15) + 5
            output_len = min(output_len, 200)
            requests.append(Request(i, prompt_tokens=100, output_tokens=output_len, arrival_step=arrival))
        return requests

    batch_size = 8

    static_requests = make_requests()
    static_results = simulate_static_batching(static_requests, batch_size)
    static_stats = batching_stats(static_results)

    continuous_requests = make_requests()
    continuous_results = simulate_continuous_batching(continuous_requests, batch_size)
    continuous_stats = batching_stats(continuous_results)

    print(f"\n  {30} requests, batch_size={batch_size}")
    print(f"  Output lengths: min={min(r.output_tokens for r in make_requests())}, "
          f"max={max(r.output_tokens for r in make_requests())}, "
          f"mean={np.mean([r.output_tokens for r in make_requests()]):.1f}")

    print(f"\n  {'Metric':<25s} {'Static':>12s} {'Continuous':>12s} {'Improvement':>12s}")
    print("  " + "-" * 61)

    for metric in ["avg_latency", "p50_latency", "p99_latency", "total_time", "throughput"]:
        s = static_stats[metric]
        c = continuous_stats[metric]
        if metric == "throughput":
            improvement = f"{c/s:.2f}x" if s > 0 else "N/A"
        else:
            improvement = f"{(s-c)/s*100:.1f}% less" if s > 0 else "N/A"
        print(f"  {metric:<25s} {s:>12.1f} {c:>12.1f} {improvement:>12s}")

    print("\n" + "=" * 70)
    print("STEP 4: Prefix Caching")
    print("=" * 70)

    cache = PrefixCache(max_entries=5000)

    system_prompts = [
        list(range(100, 200)),
        list(range(200, 350)),
        list(range(400, 480)),
    ]

    for i, prefix in enumerate(system_prompts):
        kv_data = [np.random.randn(4, 16).astype(np.float16) for _ in prefix]
        inserted = cache.insert(prefix, kv_data)
        print(f"\n  Cached system prompt {i+1}: {len(prefix)} tokens, {inserted} inserted")

    num_requests = 100
    hit_count = 0
    tokens_saved = 0

    for i in range(num_requests):
        prompt_idx = np.random.randint(0, len(system_prompts))
        system = system_prompts[prompt_idx]
        user_tokens = list(np.random.randint(500, 1000, size=np.random.randint(20, 50)))
        full_tokens = system + user_tokens

        depth, kv_entries = cache.lookup(full_tokens)
        if depth > 0:
            hit_count += 1
            tokens_saved += depth

    print(f"\n  {num_requests} requests with shared system prompts:")
    print(f"  Cache hit rate: {cache.hit_rate():.1%}")
    print(f"  Tokens saved (prefix reuse): {tokens_saved}")
    print(f"  Avg tokens saved per hit: {tokens_saved / max(hit_count, 1):.1f}")
    print(f"  Total entries in trie: {cache.total_entries}")

    print("\n" + "=" * 70)
    print("STEP 5: Speculative Decoding")
    print("=" * 70)

    vocab_size = 500
    num_trials = 10

    strategies = [
        ("Draft-target (8B->70B)", 0.78, 5),
        ("EAGLE", 0.85, 6),
        ("N-gram lookup", 0.50, 4),
    ]

    print(f"\n  {'Strategy':<25s} {'Accept Rate':>12s} {'Avg Accept':>12s} {'Speedup':>10s}")
    print("  " + "-" * 59)

    for name, acc_rate, spec_k in strategies:
        trial_speedups = []
        trial_accept_rates = []
        trial_avg_accepts = []

        for _ in range(num_trials):
            draft = DraftModel(vocab_size, acceptance_rate=acc_rate)
            target = TargetModel(vocab_size)
            context = list(np.random.randint(0, vocab_size, size=10))
            result = speculative_decode(draft, target, context, num_speculative=spec_k)
            trial_speedups.append(result["speedup"])
            trial_accept_rates.append(result["acceptance_rate"])
            trial_avg_accepts.append(result["avg_accepted"])

        print(f"  {name:<25s} {np.mean(trial_accept_rates):>11.1%} "
              f"{np.mean(trial_avg_accepts):>12.2f} {np.mean(trial_speedups):>9.2f}x")

    print("\n" + "=" * 70)
    print("STEP 6: Ops:Byte Analysis")
    print("=" * 70)

    a100_tflops = 312
    a100_bandwidth_tbs = 2.0
    crossover = a100_tflops / a100_bandwidth_tbs

    print(f"\n  A100 specs: {a100_tflops} TFLOPS (BF16), {a100_bandwidth_tbs} TB/s bandwidth")
    print(f"  Crossover ops:byte ratio: {crossover:.0f}")

    scenarios = [
        ("Prefill, batch=1, seq=4096", 4096),
        ("Decode, batch=1", 1),
        ("Decode, batch=8", 8),
        ("Decode, batch=32", 32),
        ("Decode, batch=128", 128),
        ("Decode, batch=256", 256),
        ("Decode, batch=512", 512),
    ]

    print(f"\n  {'Scenario':<35s} {'Ops:Byte':>10s} {'Bound':>12s} {'Utilization':>12s}")
    print("  " + "-" * 69)

    for name, ops_per_byte in scenarios:
        bound = "Compute" if ops_per_byte >= crossover else "Memory"
        if bound == "Memory":
            util = ops_per_byte / crossover * 100
        else:
            util = 100.0
        print(f"  {name:<35s} {ops_per_byte:>10d} {bound:>12s} {util:>11.1f}%")

    print("\n  Takeaway: batch decode until ops:byte exceeds the crossover point.")
    print(f"  On A100, this means batch size >= ~{int(crossover)} for full compute utilization.")

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("  1. KV cache trades memory for compute: 320KB/token for Llama 3 70B")
    print("  2. Continuous batching fills idle GPU slots as requests finish")
    print("  3. PagedAttention eliminates memory fragmentation (simulated via trie)")
    print("  4. Prefix caching reuses KV entries for shared system prompts")
    print("  5. Speculative decoding gets 2-3x speedup by batching verification")
    print("  6. Ops:byte ratio determines whether you are compute or memory bound")
    print("\n  Production stack: vLLM or SGLang with PagedAttention + continuous")
    print("  batching + prefix caching. Add speculative decoding for latency.")
