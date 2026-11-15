from langchain.agents import create_agent
from langchain.agents.middleware import (
    HumanInTheLoopMiddleware,
    ModelCallLimitMiddleware,
    ModelFallbackMiddleware,
    SummarizationMiddleware,
    ToolErrorMiddleware,
    ToolRetryMiddleware,
)

from .middleware import Tracing, ToolTimeout, tool_error_message
from .tools import IDEMPOTENT, TOOLS, Ctx, refund_description

SYSTEM = (
    "You are the support assistant for an outdoor gear shop. "
    "Use tools to look up orders and help-center answers; never invent order data. "
    "Refunds need human approval. Keep replies short."
)


def build_agent(model, backup, checkpointer, store, settings, extra=()):
    return create_agent(
        model,
        tools=TOOLS,
        system_prompt=SYSTEM,
        context_schema=Ctx,
        checkpointer=checkpointer,
        store=store,
        middleware=[
            SummarizationMiddleware(model, trigger=("messages", settings.summarize_after), keep=("messages", 6)),
            ModelCallLimitMiddleware(run_limit=settings.model_calls_per_run, exit_behavior="end"),
            ModelFallbackMiddleware(backup),
            HumanInTheLoopMiddleware(
                {"refund_order": {"allowed_decisions": ["approve", "reject"], "description": refund_description}},
                interrupt_mode="per_call",
            ),
            ToolErrorMiddleware(tool_error_message),
            ToolRetryMiddleware(tools=IDEMPOTENT, max_retries=2, initial_delay=0.1, on_failure="error"),
            Tracing(),
            ToolTimeout(settings.tool_timeout, {"refund_order": settings.refund_timeout}),
            *extra,
        ],
    )
