from contextlib import asynccontextmanager

import psycopg

KEY = "select {fn}(hashtextextended(%s, 0))"


class ThreadLocks:
    def __init__(self, conn):
        self.conn = conn
        self.held = set()

    @classmethod
    async def connect(cls, dsn):
        return cls(await psycopg.AsyncConnection.connect(dsn, autocommit=True))

    async def call(self, fn, name):
        cur = await self.conn.execute(KEY.format(fn=fn), (name,))
        return (await cur.fetchone())[0]

    async def acquire(self, thread_id):
        if thread_id in self.held:
            return False
        self.held.add(thread_id)
        if await self.call("pg_try_advisory_lock", thread_id):
            return True
        self.held.discard(thread_id)
        return False

    async def release(self, thread_id):
        if thread_id in self.held:
            await self.call("pg_advisory_unlock", thread_id)
            self.held.discard(thread_id)

    @asynccontextmanager
    async def exclusive(self, name):
        await self.call("pg_advisory_lock", name)
        try:
            yield
        finally:
            await self.call("pg_advisory_unlock", name)

    async def close(self):
        await self.conn.close()
