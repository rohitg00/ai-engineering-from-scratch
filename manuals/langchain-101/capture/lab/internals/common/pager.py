import hashlib
import time

from langchain_core.tools import tool

ITEMS = ["bolts", "hinges", "rivets", "washers", "springs", "clamps", "gaskets", "pulleys"]
TOOL_FN_S = []


def cursor(k):
    return hashlib.sha1(f"page-{k}".encode()).hexdigest()[:6]


def make_reader(k_pages):
    index = {"start": 1, **{cursor(k): k for k in range(2, k_pages + 1)}}

    @tool
    def read_page(cursor_id: str) -> str:
        """Read one page of the inventory document. Pass the cursor that the previous page named."""
        t0 = time.perf_counter()
        try:
            k = index.get(cursor_id.strip())
            if k is None:
                return f"error: unknown cursor {cursor_id!r}. Use the next cursor named on the last page you read."
            body = f"Page {k} of {k_pages}. Shelf {k}: {(k * 7) % 13 + 1} boxes of {ITEMS[k % len(ITEMS)]}."
            if k == k_pages:
                return body + " This is the last page. END"
            return body + f" Next cursor: {cursor(k + 1)}"
        finally:
            TOOL_FN_S.append(time.perf_counter() - t0)

    return read_page


SYSTEM = ("You read a document page by page with the read_page tool. Start with cursor_id 'start'. "
          "Each page names the next cursor. Call read_page with exactly that cursor, one call per turn, never two at once. "
          "When a page says END, reply with the single word DONE.")
USER = "Read the whole inventory document."
