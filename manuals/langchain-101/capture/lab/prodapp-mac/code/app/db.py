SCHEMA = """
create table if not exists threads (
    thread_id text primary key,
    user_id text not null,
    created_at timestamptz not null default now()
);
create table if not exists orders (
    id text primary key,
    user_id text not null,
    item text not null,
    status text not null,
    total_cents integer not null,
    refunded_cents integer not null default 0
);
create table if not exists refunds (
    refund_id bigserial primary key,
    idempotency_key text not null unique,
    order_id text not null references orders(id),
    amount_cents integer not null,
    reason text not null,
    created_at timestamptz not null default now()
);
create table if not exists tickets (
    ticket_id bigserial primary key,
    user_id text not null,
    thread_id text not null,
    subject text not null,
    body text not null
);
"""

CATALOG = [
    ("Trail running shoes", "delivered", 12900),
    ("Rain jacket", "shipped", 8900),
    ("Water bottle", "processing", 2400),
]


async def create_schema(conn):
    for statement in filter(str.strip, SCHEMA.split(";")):
        await conn.execute(statement)


async def setup(pool, users):
    async with pool.connection() as conn:
        await create_schema(conn)
        rows = [
            (f"ORD-{user}-{n}", user, item, status, cents)
            for user in users
            for n, (item, status, cents) in enumerate(CATALOG, start=1)
        ]
        async with conn.cursor() as cur:
            await cur.executemany(
                "insert into orders (id, user_id, item, status, total_cents) values (%s, %s, %s, %s, %s)"
                " on conflict (id) do nothing",
                rows,
            )


async def reset(pool):
    async with pool.connection() as conn:
        await create_schema(conn)
        await conn.execute("truncate refunds, tickets, orders, threads restart identity")
