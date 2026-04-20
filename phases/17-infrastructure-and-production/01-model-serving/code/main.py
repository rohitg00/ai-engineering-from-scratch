import asyncio
import time
import json
import random
import statistics
from dataclasses import dataclass, field
from asyncio import Queue
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
from io import BytesIO


@dataclass
class InferenceRequest:
    request_id: str
    prompt: str
    max_tokens: int
    temperature: float
    stream: bool
    created_at: float = field(default_factory=time.time)
    result_queue: asyncio.Queue = field(default_factory=asyncio.Queue)


@dataclass
class TokenEvent:
    token: str
    is_done: bool = False
    latency_ms: float = 0.0


@dataclass
class RequestMetrics:
    request_id: str
    prompt_tokens: int
    generated_tokens: int
    ttft_ms: float
    total_ms: float
    queue_wait_ms: float
    tokens_per_second: float


class SimulatedModel:
    def __init__(self, model_name="simulated-7b", vocab_size=32000):
        self.model_name = model_name
        self.vocab_size = vocab_size
        self.vocabulary = self._build_vocabulary()

    def _build_vocabulary(self):
        words = [
            "The", "model", "generates", "text", "based", "on", "the",
            "input", "prompt", "provided", "by", "the", "user", ".",
            "Each", "token", "is", "produced", "sequentially", "during",
            "the", "decode", "phase", "of", "inference", ".", "The",
            "prefill", "stage", "processes", "the", "entire", "context",
            "window", "in", "a", "single", "forward", "pass", ".",
            "GPU", "memory", "is", "managed", "through", "paged",
            "attention", "mechanisms", "that", "allocate", "and", "free",
            "key-value", "cache", "blocks", "dynamically", ".",
            "Continuous", "batching", "allows", "new", "requests", "to",
            "join", "an", "in-flight", "batch", "without", "waiting", ".",
            "Streaming", "delivers", "tokens", "to", "users", "as",
            "they", "are", "generated", ",", "reducing", "perceived",
            "latency", "significantly", "."
        ]
        return words

    async def prefill(self, prompt_tokens):
        base_ms = 20 + (prompt_tokens * 0.5)
        jitter = random.uniform(0.8, 1.2)
        delay = (base_ms * jitter) / 1000.0
        await asyncio.sleep(delay)
        return delay * 1000

    async def decode_step(self):
        base_ms = random.uniform(15, 35)
        await asyncio.sleep(base_ms / 1000.0)
        token = random.choice(self.vocabulary)
        return token, base_ms

    def tokenize(self, text):
        return text.split()

    def count_tokens(self, text):
        return len(self.tokenize(text))


class ServingMetrics:
    def __init__(self):
        self.requests_completed = 0
        self.requests_failed = 0
        self.ttft_values = []
        self.total_latency_values = []
        self.queue_wait_values = []
        self.tps_values = []
        self.tokens_generated = 0
        self.start_time = time.time()

    def record(self, metrics: RequestMetrics):
        self.requests_completed += 1
        self.ttft_values.append(metrics.ttft_ms)
        self.total_latency_values.append(metrics.total_ms)
        self.queue_wait_values.append(metrics.queue_wait_ms)
        self.tps_values.append(metrics.tokens_per_second)
        self.tokens_generated += metrics.generated_tokens

    def record_failure(self):
        self.requests_failed += 1

    def percentile(self, values, p):
        if not values:
            return 0.0
        sorted_vals = sorted(values)
        idx = int(len(sorted_vals) * p / 100)
        idx = min(idx, len(sorted_vals) - 1)
        return sorted_vals[idx]

    def summary(self):
        elapsed = time.time() - self.start_time
        rps = self.requests_completed / elapsed if elapsed > 0 else 0

        return {
            "requests_completed": self.requests_completed,
            "requests_failed": self.requests_failed,
            "requests_per_second": round(rps, 2),
            "total_tokens_generated": self.tokens_generated,
            "ttft_p50_ms": round(self.percentile(self.ttft_values, 50), 1),
            "ttft_p99_ms": round(self.percentile(self.ttft_values, 99), 1),
            "latency_p50_ms": round(self.percentile(self.total_latency_values, 50), 1),
            "latency_p99_ms": round(self.percentile(self.total_latency_values, 99), 1),
            "queue_wait_p50_ms": round(self.percentile(self.queue_wait_values, 50), 1),
            "queue_wait_p99_ms": round(self.percentile(self.queue_wait_values, 99), 1),
            "tps_avg": round(statistics.mean(self.tps_values), 1) if self.tps_values else 0,
            "uptime_seconds": round(elapsed, 1),
        }


class ModelServer:
    def __init__(self, model, max_queue_size=50, max_batch_size=8):
        self.model = model
        self.queue = asyncio.Queue(maxsize=max_queue_size)
        self.max_batch_size = max_batch_size
        self.metrics = ServingMetrics()
        self.active_requests = 0
        self.running = False

    async def enqueue(self, request: InferenceRequest):
        if self.queue.full():
            return False
        await self.queue.put(request)
        return True

    async def process_single(self, request: InferenceRequest):
        start_time = time.time()
        queue_wait_ms = (start_time - request.created_at) * 1000

        prompt_tokens = self.model.count_tokens(request.prompt)
        prefill_ms = await self.model.prefill(prompt_tokens)

        ttft_ms = (time.time() - start_time) * 1000
        first_token = True

        generated_tokens = 0
        decode_start = time.time()

        for _ in range(request.max_tokens):
            token, step_ms = await self.model.decode_step()
            generated_tokens += 1

            event = TokenEvent(
                token=token,
                is_done=False,
                latency_ms=step_ms,
            )
            await request.result_queue.put(event)

            if first_token:
                first_token = False

            if token == "." and generated_tokens > 10 and random.random() < 0.3:
                break

        await request.result_queue.put(TokenEvent(token="", is_done=True))

        total_ms = (time.time() - start_time) * 1000
        decode_time = time.time() - decode_start
        tps = generated_tokens / decode_time if decode_time > 0 else 0

        metrics = RequestMetrics(
            request_id=request.request_id,
            prompt_tokens=prompt_tokens,
            generated_tokens=generated_tokens,
            ttft_ms=ttft_ms,
            total_ms=total_ms,
            queue_wait_ms=queue_wait_ms,
            tokens_per_second=tps,
        )
        self.metrics.record(metrics)
        return metrics

    async def process_batch(self, requests):
        tasks = [self.process_single(req) for req in requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        completed = []
        for req, result in zip(requests, results):
            if isinstance(result, Exception):
                self.metrics.record_failure()
                await req.result_queue.put(TokenEvent(token="", is_done=True))
            else:
                completed.append(result)

        return completed

    async def batch_worker(self):
        self.running = True
        while self.running:
            batch = []

            try:
                first = await asyncio.wait_for(self.queue.get(), timeout=0.1)
                batch.append(first)
            except asyncio.TimeoutError:
                continue

            while len(batch) < self.max_batch_size:
                try:
                    req = self.queue.get_nowait()
                    batch.append(req)
                except asyncio.QueueEmpty:
                    break

            self.active_requests = len(batch)
            await self.process_batch(batch)
            self.active_requests = 0

    def stop(self):
        self.running = False


def format_sse_event(data):
    return f"data: {json.dumps(data)}\n\n"


def format_sse_done():
    return "data: [DONE]\n\n"


async def handle_completion(server, prompt, max_tokens, temperature, stream):
    request_id = f"req-{random.randint(10000, 99999)}"
    request = InferenceRequest(
        request_id=request_id,
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=stream,
    )

    accepted = await server.enqueue(request)
    if not accepted:
        return None, 429

    if stream:
        events = []
        while True:
            event = await request.result_queue.get()
            if event.is_done:
                events.append(format_sse_done())
                break
            chunk = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "choices": [{
                    "index": 0,
                    "delta": {"content": event.token + " "},
                    "finish_reason": None,
                }],
            }
            events.append(format_sse_event(chunk))
        return events, 200

    tokens = []
    while True:
        event = await request.result_queue.get()
        if event.is_done:
            break
        tokens.append(event.token)

    response = {
        "id": request_id,
        "object": "chat.completion",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": " ".join(tokens)},
            "finish_reason": "stop",
        }],
        "usage": {
            "prompt_tokens": server.model.count_tokens(prompt),
            "completion_tokens": len(tokens),
            "total_tokens": server.model.count_tokens(prompt) + len(tokens),
        },
    }
    return response, 200


async def simulate_client(server, client_id, prompt, max_tokens=50):
    request_id = f"client-{client_id}-{random.randint(1000, 9999)}"
    request = InferenceRequest(
        request_id=request_id,
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=0.7,
        stream=True,
    )

    accepted = await server.enqueue(request)
    if not accepted:
        return client_id, None, "rejected (queue full)"

    tokens = []
    first_token_time = None
    start_time = time.time()

    while True:
        event = await request.result_queue.get()
        if event.is_done:
            break
        if first_token_time is None:
            first_token_time = time.time()
        tokens.append(event.token)

    total_time = time.time() - start_time
    ttft = (first_token_time - start_time) if first_token_time else 0

    return client_id, {
        "tokens": len(tokens),
        "ttft_ms": round(ttft * 1000, 1),
        "total_ms": round(total_time * 1000, 1),
        "text_preview": " ".join(tokens[:8]) + "...",
    }, "ok"


async def load_test(server, num_clients=15, stagger_ms=50):
    prompts = [
        "Explain how transformers process sequences in parallel",
        "Write a function to compute cosine similarity between vectors",
        "What is the difference between supervised and unsupervised learning",
        "Describe how attention mechanisms work in neural networks",
        "Explain gradient descent and its variants",
        "What is backpropagation and why is it important",
        "How do convolutional neural networks detect features",
        "Describe the encoder-decoder architecture",
        "What is transfer learning and when should you use it",
        "Explain the bias-variance tradeoff in machine learning",
        "How does batch normalization improve training stability",
        "What are embeddings and how are they learned",
        "Describe the difference between RNNs and transformers",
        "How does dropout prevent overfitting",
        "Explain the concept of a loss landscape",
    ]

    tasks = []
    for i in range(num_clients):
        prompt = prompts[i % len(prompts)]
        max_tokens = random.randint(20, 60)
        tasks.append(simulate_client(server, i, prompt, max_tokens))
        await asyncio.sleep(stagger_ms / 1000.0)

    results = await asyncio.gather(*tasks)
    return results


async def main():
    print("=" * 60)
    print("MODEL SERVING FROM SCRATCH")
    print("=" * 60)

    print("\nSTEP 1: Initialize Model and Server")
    print("-" * 40)

    model = SimulatedModel(model_name="simulated-7b")
    server = ModelServer(model, max_queue_size=50, max_batch_size=4)

    print(f"  Model: {model.model_name}")
    print(f"  Vocabulary: {len(model.vocabulary)} tokens")
    print(f"  Max queue size: 50")
    print(f"  Max batch size: 4")

    worker_task = asyncio.create_task(server.batch_worker())

    print("\nSTEP 2: Single Request (non-streaming)")
    print("-" * 40)

    request = InferenceRequest(
        request_id="test-001",
        prompt="Explain how transformers work",
        max_tokens=20,
        temperature=0.7,
        stream=False,
    )

    await server.enqueue(request)

    tokens = []
    start = time.time()
    first_token_at = None

    while True:
        event = await request.result_queue.get()
        if event.is_done:
            break
        if first_token_at is None:
            first_token_at = time.time()
        tokens.append(event.token)

    elapsed = time.time() - start
    ttft = (first_token_at - start) if first_token_at else 0

    print(f"  Prompt: \"{request.prompt}\"")
    print(f"  Generated: {len(tokens)} tokens")
    print(f"  TTFT: {ttft*1000:.1f}ms")
    print(f"  Total: {elapsed*1000:.1f}ms")
    print(f"  TPS: {len(tokens)/elapsed:.1f}")
    print(f"  Output: {' '.join(tokens[:10])}...")

    print("\nSTEP 3: Streaming Response")
    print("-" * 40)

    request = InferenceRequest(
        request_id="test-002",
        prompt="What is gradient descent",
        max_tokens=15,
        temperature=0.7,
        stream=True,
    )

    await server.enqueue(request)

    print("  Streaming tokens: ", end="", flush=True)
    stream_tokens = []
    while True:
        event = await request.result_queue.get()
        if event.is_done:
            break
        print(event.token, end=" ", flush=True)
        stream_tokens.append(event.token)
    print(f"\n  Total streamed: {len(stream_tokens)} tokens")

    print("\nSTEP 4: Concurrent Batch Processing")
    print("-" * 40)

    prompts = [
        "Explain neural networks",
        "What is overfitting",
        "Describe backpropagation",
        "How does attention work",
        "What are embeddings",
    ]

    requests = []
    for i, p in enumerate(prompts):
        req = InferenceRequest(
            request_id=f"batch-{i}",
            prompt=p,
            max_tokens=25,
            temperature=0.7,
            stream=True,
        )
        await server.enqueue(req)
        requests.append(req)

    print(f"  Submitted {len(requests)} requests to queue")
    print(f"  Queue depth: {server.queue.qsize()}")

    batch_results = []
    for req in requests:
        tokens = []
        while True:
            event = await req.result_queue.get()
            if event.is_done:
                break
            tokens.append(event.token)
        batch_results.append((req.request_id, len(tokens)))

    for req_id, count in batch_results:
        print(f"  {req_id}: {count} tokens generated")

    print("\nSTEP 5: Load Test (15 concurrent clients)")
    print("-" * 40)

    server.metrics = ServingMetrics()
    results = await load_test(server, num_clients=15, stagger_ms=30)

    succeeded = 0
    rejected = 0
    for client_id, result, status in results:
        if status == "ok" and result:
            succeeded += 1
        else:
            rejected += 1

    print(f"  Clients: 15")
    print(f"  Succeeded: {succeeded}")
    print(f"  Rejected (queue full): {rejected}")

    print("\n  Per-client results:")
    for client_id, result, status in results:
        if result:
            print(f"    Client {client_id:2d}: {result['tokens']:2d} tokens, "
                  f"TTFT={result['ttft_ms']:6.1f}ms, "
                  f"Total={result['total_ms']:7.1f}ms, "
                  f"Preview: {result['text_preview']}")
        else:
            print(f"    Client {client_id:2d}: {status}")

    print("\nSTEP 6: Server Metrics")
    print("-" * 40)

    summary = server.metrics.summary()
    print(f"  Requests completed: {summary['requests_completed']}")
    print(f"  Requests failed: {summary['requests_failed']}")
    print(f"  Requests/sec: {summary['requests_per_second']}")
    print(f"  Total tokens: {summary['total_tokens_generated']}")
    print(f"  TTFT P50: {summary['ttft_p50_ms']}ms")
    print(f"  TTFT P99: {summary['ttft_p99_ms']}ms")
    print(f"  Latency P50: {summary['latency_p50_ms']}ms")
    print(f"  Latency P99: {summary['latency_p99_ms']}ms")
    print(f"  Queue wait P50: {summary['queue_wait_p50_ms']}ms")
    print(f"  Queue wait P99: {summary['queue_wait_p99_ms']}ms")
    print(f"  Avg TPS: {summary['tps_avg']}")
    print(f"  Uptime: {summary['uptime_seconds']}s")

    print("\nSTEP 7: OpenAI-Compatible Response Format")
    print("-" * 40)

    response, status = await handle_completion(
        server,
        prompt="Explain attention mechanisms",
        max_tokens=10,
        temperature=0.7,
        stream=False,
    )

    print(f"  Status: {status}")
    print(f"  Response format:")
    print(json.dumps(response, indent=2))

    print("\nSTEP 8: SSE Streaming Format")
    print("-" * 40)

    events, status = await handle_completion(
        server,
        prompt="What is a neural network",
        max_tokens=8,
        temperature=0.7,
        stream=True,
    )

    print(f"  Status: {status}")
    print(f"  SSE events ({len(events)} total):")
    for event in events[:5]:
        print(f"    {event.strip()}")
    if len(events) > 5:
        print(f"    ... ({len(events) - 5} more events)")
    print(f"    {events[-1].strip()}")

    server.stop()
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("  Built an HTTP model server with:")
    print("    - Async request queuing (bounded, backpressure via 429)")
    print("    - Batch processing (up to 4 concurrent requests)")
    print("    - SSE streaming (tokens delivered as generated)")
    print("    - OpenAI-compatible response format")
    print("    - Latency metrics (TTFT, P50, P99, TPS)")
    print("    - Load testing (15 concurrent simulated clients)")
    print()
    print("  In production, replace SimulatedModel with:")
    print("    - vLLM for high-throughput serving with PagedAttention")
    print("    - TGI for Hugging Face model ecosystem integration")
    print("    - Triton for multi-model enterprise serving")
    print("    - Ollama for simple local development")
    print()
    print("  The serving layer stays the same. The model is a plugin.")


if __name__ == "__main__":
    asyncio.run(main())
