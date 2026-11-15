import os
from dataclasses import dataclass, field


def parse_tokens(text):
    pairs = (item.split("=", 1) for item in text.split(",") if item)
    return {token: user for token, user in pairs}


@dataclass
class Settings:
    database_url: str = "postgresql:///lc_prod"
    model: str = "fake:primary"
    backup_model: str = "fake:backup"
    model_latency: float = 0.0
    tokens: dict = field(default_factory=lambda: {"tok-alice": "alice", "tok-bob": "bob"})
    pool_max: int = 20
    summarize_after: int = 24
    model_calls_per_run: int = 8
    tool_timeout: float = 5.0
    refund_timeout: float = 15.0
    drain_seconds: float = 20.0
    otel_file: str | None = "runs/otel-spans.jsonl"
    log_file: str | None = None

    @classmethod
    def from_env(cls):
        env = os.environ.get
        base = cls()
        return cls(
            database_url=env("DATABASE_URL", base.database_url),
            model=env("MODEL", base.model),
            backup_model=env("BACKUP_MODEL", base.backup_model),
            model_latency=float(env("MODEL_LATENCY", base.model_latency)),
            tokens=parse_tokens(env("AUTH_TOKENS", "")) or base.tokens,
            pool_max=int(env("POOL_MAX", base.pool_max)),
            summarize_after=int(env("SUMMARIZE_AFTER", base.summarize_after)),
            model_calls_per_run=int(env("MODEL_CALLS_PER_RUN", base.model_calls_per_run)),
            tool_timeout=float(env("TOOL_TIMEOUT", base.tool_timeout)),
            refund_timeout=float(env("REFUND_TIMEOUT", base.refund_timeout)),
            drain_seconds=float(env("DRAIN_SECONDS", base.drain_seconds)),
            otel_file=env("OTEL_FILE", base.otel_file) or None,
            log_file=env("LOG_FILE") or None,
        )
