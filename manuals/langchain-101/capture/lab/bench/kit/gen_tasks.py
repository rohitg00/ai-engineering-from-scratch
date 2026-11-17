import json
import random
import sqlite3

from corpus import RETRIEVAL_QA
from env import BENCH, CATALOG, DB_PATH, SHIPPING, rate, to_kg

FIRST = ["Ada", "Bram", "Cleo", "Dev", "Esme", "Finn", "Greta", "Hugo", "Ines", "Jory", "Kaia", "Lars", "Mira", "Nils", "Opal", "Pavel", "Quinn", "Rosa", "Soren", "Tilde"]
LAST = ["Achterberg", "Bellweather", "Corrigan", "Dahlstrom", "Eckhart", "Fairweather", "Gallo", "Halvorsen", "Ibsen", "Jansma"]
CITIES = ["Ostry", "Dunmere", "Pike Hollow", "Harrow Cross", "Fenwick"]
PRODUCTS = [("spade", "garden", 24.0), ("hose reel", "garden", 39.5), ("pruning shears", "garden", 18.25), ("seed tray", "garden", 6.4),
            ("chef knife", "kitchen", 54.0), ("cast pan", "kitchen", 47.9), ("kettle", "kitchen", 32.0), ("spice rack", "kitchen", 21.75),
            ("cordless drill", "tools", 119.0), ("socket set", "tools", 64.5), ("tape measure", "tools", 9.9), ("stud finder", "tools", 27.0),
            ("bench vise", "tools", 88.0), ("desk lamp", "home", 36.0), ("wool throw", "home", 58.0), ("door mat", "home", 15.5),
            ("wall clock", "home", 29.0), ("bird feeder", "garden", 22.0)]
STATUSES = ["delivered"] * 7 + ["shipped"] * 2 + ["cancelled"]


def build_db():
    rng = random.Random(20261114)
    if DB_PATH.exists():
        DB_PATH.unlink()
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, joined DATE NOT NULL);
    CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), order_date DATE NOT NULL, status TEXT NOT NULL);
    CREATE TABLE order_items (order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL);
    """)
    names = set()
    cid = 0
    while cid < 48:
        n = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        if n in names:
            continue
        names.add(n)
        cid += 1
        con.execute("INSERT INTO customers VALUES (?,?,?,?)", (cid, n, rng.choice(CITIES), f"{rng.choice([2022, 2023, 2024, 2025])}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}"))
    for i, (n, c, p) in enumerate(PRODUCTS[:-1], 1):
        con.execute("INSERT INTO products VALUES (?,?,?,?)", (i, n, c, p))
    con.execute("INSERT INTO products VALUES (?,?,?,?)", (len(PRODUCTS), *PRODUCTS[-1]))
    active = list(range(1, 45))
    for oid in range(1, 241):
        con.execute("INSERT INTO orders VALUES (?,?,?,?)", (oid, rng.choice(active), f"2025-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}", rng.choice(STATUSES)))
        for pid in rng.sample(range(1, len(PRODUCTS)), rng.randint(1, 5)):
            con.execute("INSERT INTO order_items VALUES (?,?,?)", (oid, pid, rng.randint(1, 4)))
    con.commit()
    return con


def q1(con, sql):
    return con.execute(sql).fetchone()[0]


def sql_tasks(con):
    rev = "SUM(oi.qty * p.price)"
    j = "FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id"
    top_cust = con.execute("SELECT c.name, COUNT(*) n FROM orders o JOIN customers c ON c.id=o.customer_id GROUP BY c.id ORDER BY n DESC, c.id").fetchall()
    assert top_cust[0][1] > top_cust[1][1], "tie for top customer"
    specs = [
        ("How many customers live in Ostry?", "SELECT COUNT(*) FROM customers WHERE city='Ostry'", "num"),
        ("What is the total revenue (quantity times unit price) of delivered orders? Round to 2 decimals.", f"SELECT ROUND({rev},2) {j} WHERE o.status='delivered'", "num"),
        ("Which product has the highest total quantity ordered across all orders, regardless of status? Answer with the product name.", f"SELECT p.name {j} GROUP BY p.id ORDER BY SUM(oi.qty) DESC, p.id LIMIT 1", "str"),
        ("How many orders have status 'cancelled'?", "SELECT COUNT(*) FROM orders WHERE status='cancelled'", "num"),
        ("Which customer placed the most orders? Answer with the full name.", None, "str"),
        ("What is the average price of products in the 'tools' category? Round to 2 decimals.", "SELECT ROUND(AVG(price),2) FROM products WHERE category='tools'", "num"),
        ("How many distinct customers ordered the product 'kettle'?", f"SELECT COUNT(DISTINCT o.customer_id) {j} WHERE p.name='kettle'", "num"),
        ("What was the revenue (quantity times unit price) of all non-cancelled orders placed in March 2025? Round to 2 decimals.", f"SELECT ROUND({rev},2) {j} WHERE o.status!='cancelled' AND o.order_date LIKE '2025-03-%'", "num"),
        ("Which customer city generated the highest revenue (quantity times unit price) from delivered orders?", f"SELECT c.city {j} JOIN customers c ON c.id=o.customer_id WHERE o.status='delivered' GROUP BY c.city ORDER BY {rev} DESC LIMIT 1", "str"),
        ("How many products have never been ordered?", "SELECT COUNT(*) FROM products WHERE id NOT IN (SELECT product_id FROM order_items)", "num"),
        ("What total quantity of 'garden' category products was sold in delivered orders?", f"SELECT SUM(oi.qty) {j} WHERE o.status='delivered' AND p.category='garden'", "num"),
        (None, None, "str"),
        ("How many customers joined in 2024?", "SELECT COUNT(*) FROM customers WHERE joined LIKE '2024-%'", "num"),
        ("What is the most expensive product in the 'kitchen' category? Answer with the product name.", "SELECT name FROM products WHERE category='kitchen' ORDER BY price DESC LIMIT 1", "str"),
        ("How many orders contain more than 3 distinct line items?", "SELECT COUNT(*) FROM (SELECT order_id FROM order_items GROUP BY order_id HAVING COUNT(*) > 3)", "num"),
        (None, None, "num"),
        ("How many orders were placed in the fourth quarter (October to December) of 2025?", "SELECT COUNT(*) FROM orders WHERE order_date >= '2025-10-01' AND order_date <= '2025-12-31'", "num"),
        ("What is the average number of line items per order? Round to 2 decimals.", "SELECT ROUND(AVG(n),2) FROM (SELECT COUNT(*) n FROM order_items GROUP BY order_id)", "num"),
        ("Which product category has the most products?", "SELECT category FROM products GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1", "str"),
        ("How many customers have never placed an order?", "SELECT COUNT(*) FROM customers WHERE id NOT IN (SELECT customer_id FROM orders)", "num"),
    ]
    c5 = con.execute("SELECT name FROM customers WHERE id=7").fetchone()[0]
    c9 = top_cust[2][0]
    specs[11] = (f"What is the date of the earliest order placed by {c5}? Answer as YYYY-MM-DD.", f"SELECT MIN(order_date) FROM orders o JOIN customers c ON c.id=o.customer_id WHERE c.name='{c5}'", "str")
    specs[15] = (f"What is the total revenue (quantity times unit price) of delivered orders by {c9}? Round to 2 decimals.", f"SELECT ROUND({rev},2) {j} JOIN customers c ON c.id=o.customer_id WHERE o.status='delivered' AND c.name='{c9}'", "num")
    out = []
    for i, (q, sql, kind) in enumerate(specs, 1):
        ans = top_cust[0][0] if sql is None else q1(con, sql)
        out.append({"id": f"sql{i:02d}", "family": "sql", "turns": [q], "answer": str(ans), "answer_kind": kind,
                    "truth_sql": sql, "required": [{"tool": "sql_query"}]})
    return out


def chain_tasks():
    out = []
    curs = ["EUR", "USD", "GBP", "CHF"]
    items = list(CATALOG)
    rng = random.Random(7)
    carriers = sorted(SHIPPING)
    for k in range(4):
        it = items[k]
        n = [3, 5, 2, 7][k]
        cur = [c for c in curs if c != CATALOG[it]["currency"]][k % 3]
        a = n * CATALOG[it]["price"] * rate(CATALOG[it]["currency"], cur)
        out.append(("A", f"What is the total price of {n} units of the '{it}' in {cur}? Round to 2 decimals.", a, [it], False))
    for k in range(4):
        it = items[4 + k]
        n = [4, 6, 3, 10][k]
        a = n * to_kg(CATALOG[it]["weight"], CATALOG[it]["weight_unit"])
        out.append(("B", f"What is the total weight in kilograms of {n} units of the '{it}'? Round to 3 decimals.", a, [it], False))
    for k in range(4):
        it = items[8 + k]
        n = [5, 2, 8, 3][k]
        car, zone = carriers[(k * 2 + 1) % 6]
        per, scur = SHIPPING[(car, zone)]
        cur = ["EUR", "GBP", "USD", "CHF"][k]
        if cur == scur:
            cur = "JPY"
        a = n * to_kg(CATALOG[it]["weight"], CATALOG[it]["weight_unit"]) * per * rate(scur, cur)
        out.append(("C", f"I want to ship {n} units of the '{it}' with {car} ({zone} zone). Shipping is charged per kilogram of total weight. What does shipping cost in {cur}? Round to 2 decimals.", a, [it], True))
    for k in range(4):
        it = items[(k * 3 + 1) % 12]
        n = [2, 4, 3, 6][k]
        car, zone = carriers[(k * 2) % 6]
        per, scur = SHIPPING[(car, zone)]
        cur = ["USD", "EUR", "CHF", "GBP"][k]
        goods = n * CATALOG[it]["price"] * rate(CATALOG[it]["currency"], cur)
        ship = n * to_kg(CATALOG[it]["weight"], CATALOG[it]["weight_unit"]) * per * rate(scur, cur)
        out.append(("D", f"What is the total cost in {cur} of buying {n} units of the '{it}' and shipping them with {car} ({zone} zone), where shipping is charged per kilogram of total weight? Round to 2 decimals.", goods + ship, [it], True))
    pairs = [("trail lantern", "camp stove"), ("rain shell", "dry bag"), ("water filter", "headlamp"), ("cook set", "tent footprint")]
    for a_it, b_it in pairs:
        def per_kg(it):
            return CATALOG[it]["price"] * rate(CATALOG[it]["currency"], "EUR") / to_kg(CATALOG[it]["weight"], CATALOG[it]["weight_unit"])
        ans = a_it if per_kg(a_it) < per_kg(b_it) else b_it
        assert abs(per_kg(a_it) - per_kg(b_it)) / max(per_kg(a_it), per_kg(b_it)) > 0.05
        out.append(("E", f"Which is cheaper per kilogram when priced in EUR: the '{a_it}' or the '{b_it}'? Answer with the item name only.", ans, [a_it, b_it], False))
    tasks = []
    for i, (kind, q, a, its, ship) in enumerate(out, 1):
        req = [{"tool": "get_item_info", "arg": "item", "value": it} for it in its]
        if ship:
            req.append({"tool": "get_shipping_rate"})
        tasks.append({"id": f"chain{i:02d}", "family": "chain", "template": kind, "turns": [q],
                      "answer": a if isinstance(a, str) else round(a, 4), "answer_kind": "str" if isinstance(a, str) else "num", "required": req})
    return tasks


def retrieval_tasks():
    return [{"id": rid, "family": "retrieval", "turns": [q], "answer": a, "answer_kind": "num" if a.replace(".", "").isdigit() else "str",
             "support_doc": d, "required": [{"tool": "search_docs"}]} for rid, q, a, d in RETRIEVAL_QA]


def file_tasks():
    T = []

    def add(q, init, exp):
        T.append({"turns": [q], "fs_init": init, "fs_expected": exp})

    add("Create a file notes/todo.txt whose content is exactly: buy milk", {"README.md": "# Workspace\n"}, {"README.md": "# Workspace\n", "notes/todo.txt": "buy milk"})
    add("Rename report_draft.md to report_final.md. Do not change its content.", {"report_draft.md": "Q3 report\nRevenue up 4%.\n", "notes.txt": "keep\n"}, {"report_final.md": "Q3 report\nRevenue up 4%.\n", "notes.txt": "keep\n"})
    add("In config.ini, change the port from 8080 to 9090. Leave every other line unchanged.", {"config.ini": "[server]\nhost=0.0.0.0\nport=8080\nworkers=4\n"}, {"config.ini": "[server]\nhost=0.0.0.0\nport=9090\nworkers=4\n"})
    add("Delete every file whose name ends in .tmp. Keep all other files.", {"a.tmp": "x", "b.tmp": "y", "build/c.tmp": "z", "main.py": "print(1)\n", "tmp_notes.txt": "keep\n"}, {"main.py": "print(1)\n", "tmp_notes.txt": "keep\n"})
    add("Move every .log file in the workspace root into a folder named logs, keeping the file names.", {"app.log": "start\n", "db.log": "conn\n", "app.py": "pass\n"}, {"logs/app.log": "start\n", "logs/db.log": "conn\n", "app.py": "pass\n"})
    add("Count the data rows in data.csv (do not count the header line) and write that number, digits only, into a new file count.txt.", {"data.csv": "id,name\n1,ann\n2,bo\n3,cy\n4,di\n5,ed\n6,flo\n"}, {"data.csv": "id,name\n1,ann\n2,bo\n3,cy\n4,di\n5,ed\n6,flo\n", "count.txt": "6"})
    add("Copy README.md to docs/README.md. Keep the original file.", {"README.md": "# Tool\nUsage: run it.\n"}, {"README.md": "# Tool\nUsage: run it.\n", "docs/README.md": "# Tool\nUsage: run it.\n"})
    add("In report.md, replace every occurrence of the word DRAFT with FINAL, then rename the file to report_v2.md.", {"report.md": "DRAFT\nStatus: DRAFT review\n"}, {"report_v2.md": "FINAL\nStatus: FINAL review\n"})
    add("Append a new last line '- deploy' to tasks.md. Keep the existing lines.", {"tasks.md": "# Tasks\n- build\n- test\n"}, {"tasks.md": "# Tasks\n- build\n- test\n- deploy\n"})
    add("Create ab.txt containing the content of a.txt followed by the content of b.txt, then delete a.txt and b.txt.", {"a.txt": "alpha\n", "b.txt": "beta\n"}, {"ab.txt": "alpha\nbeta\n"})
    add("Rename every file with the extension .jpeg to the extension .jpg. Keep the rest of each name.", {"cat.jpeg": "c", "dog.jpeg": "d", "pics/owl.jpeg": "o", "list.txt": "3 pics\n"}, {"cat.jpg": "c", "dog.jpg": "d", "pics/owl.jpg": "o", "list.txt": "3 pics\n"})
    add("Create src/main.py containing exactly print('hello') and create an empty file tests/__init__.py.", {}, {"src/main.py": "print('hello')", "tests/__init__.py": ""})
    add("Rename README.TXT to readme.txt (lower case). Keep its content.", {"README.TXT": "hello\n"}, {"readme.txt": "hello\n"})
    add("Fix the spelling mistake 'recieve' to 'receive' everywhere in notes.md.", {"notes.md": "We recieve mail.\nYou recieve it daily.\nThey recieve none.\n"}, {"notes.md": "We receive mail.\nYou receive it daily.\nThey receive none.\n"})
    add("Read the version field in package.json and write just that version string into a new file version.txt.", {"package.json": '{\n  "name": "orrin",\n  "version": "2.4.1"\n}\n'}, {"package.json": '{\n  "name": "orrin",\n  "version": "2.4.1"\n}\n', "version.txt": "2.4.1"})
    add("Remove the line DEBUG=true from settings.env. Keep the other lines in order.", {"settings.env": "HOST=localhost\nDEBUG=true\nPORT=5000\n"}, {"settings.env": "HOST=localhost\nPORT=5000\n"})
    add("Write the lines of names.txt sorted alphabetically into a new file names_sorted.txt, one name per line. Keep names.txt as is.", {"names.txt": "mira\nada\nsoren\ncleo\n"}, {"names.txt": "mira\nada\nsoren\ncleo\n", "names_sorted.txt": "ada\ncleo\nmira\nsoren\n"})
    add("Move every file in inbox/ whose name starts with 'invoice' into a folder invoices/ at the workspace root. Leave other files in inbox/.", {"inbox/invoice_01.pdf": "i1", "inbox/invoice_02.pdf": "i2", "inbox/memo.txt": "m"}, {"invoices/invoice_01.pdf": "i1", "invoices/invoice_02.pdf": "i2", "inbox/memo.txt": "m"})
    add("Create index.txt at the workspace root that lists the names of all .md files in docs/, one file name per line, sorted alphabetically, names only without the folder.", {"docs/setup.md": "s", "docs/api.md": "a", "docs/faq.md": "f", "docs/logo.png": "p"}, {"docs/setup.md": "s", "docs/api.md": "a", "docs/faq.md": "f", "docs/logo.png": "p", "index.txt": "api.md\nfaq.md\nsetup.md\n"})
    add("Swap the contents of left.txt and right.txt.", {"left.txt": "LEFT\n", "right.txt": "RIGHT\n"}, {"left.txt": "RIGHT\n", "right.txt": "LEFT\n"})
    return [{"id": f"files{i:02d}", "family": "files", **t} for i, t in enumerate(T, 1)]


def multiturn_tasks():
    T = []
    for k, (old, bike, new) in enumerate([(4471, 9023, 5582), (1188, 3307, 2290), (6045, 7712, 6150), (3901, 2468, 8833)]):
        T.append({"turns": [f"Save my gym locker code {old} in my notes under the key 'locker'.", f"Also save my bike lock code {bike} under the key 'bike'.",
                            f"My locker code changed to {new}. Update my notes.", "What is my current locker code? Submit it as the answer."],
                  "kv_expected": {"locker": str(new), "bike": str(bike)}, "answer": str(new), "answer_kind": "num"})
    for k, (budget, spent, cur) in enumerate([(450, 120, "USD"), (900, 275, "GBP"), (300, 45, "CHF"), (1200, 380, "USD")]):
        T.append({"turns": [f"My trip budget is {budget} EUR. Save it in my notes under the key 'budget_eur'.",
                            f"I just paid {spent} EUR for the hotel deposit. Update 'budget_eur' to the remaining budget.",
                            f"How much is my remaining budget worth in {cur}? Submit the amount rounded to 2 decimals."],
                  "kv_expected": {"budget_eur": str(budget - spent)}, "answer": round((budget - spent) * rate("EUR", cur), 4), "answer_kind": "num"})
    for k, (a, b, c, d) in enumerate([("tent", "stove", "headlamp", "stove"), ("map", "compass", "whistle", "map"), ("rope", "gloves", "helmet", "rope"), ("kettle", "mugs", "coffee", "mugs")]):
        rest = [x for x in (a, b, c) if x != d]
        T.append({"turns": [f"Start a packing list in my notes under the key 'packing' with these items, comma separated: {a}, {b}.",
                            f"Add {c} to the packing list.", f"Remove {d} from the packing list.",
                            "How many items are on my packing list now? Submit the number."],
                  "kv_expected": {"packing": ",".join(rest)}, "kv_list_keys": ["packing"], "answer": str(len(rest)), "answer_kind": "num"})
    for k, (x, y, z, m) in enumerate([(17, 25, 8, 3), (12, 30, 7, 2), (40, 9, 11, 4), (5, 16, 23, 5)]):
        T.append({"turns": [f"I will give you three numbers over the next messages. Do not save them anywhere yet. The first number is {x}.",
                            f"The second number is {y}.", f"The third number is {z}. Now multiply the sum of the three numbers by {m} and save the result in my notes under the key 'result'."],
                  "kv_expected": {"result": str((x + y + z) * m)}, "answer": None})
    for k, (home, amount, frm) in enumerate([("GBP", 200, "USD"), ("CHF", 150, "EUR"), ("USD", 80, "GBP"), ("EUR", 5000, "JPY")]):
        T.append({"turns": [f"My home currency is {home}. Save it in my notes under the key 'currency'.", "Delete the key 'temp' from my notes.",
                            f"Convert {amount} {frm} into my home currency and submit the amount rounded to 2 decimals."],
                  "kv_init": {"temp": "scratch", "city": "Ostry"}, "kv_expected": {"currency": home, "city": "Ostry"}, "answer": round(amount * rate(frm, home), 4), "answer_kind": "num"})
    return [{"id": f"multi{i:02d}", "family": "multiturn", **t} for i, t in enumerate(T, 1)]


def main():
    con = build_db()
    tasks = chain_tasks() + sql_tasks(con) + retrieval_tasks() + file_tasks() + multiturn_tasks()
    con.close()
    with open(BENCH / "data" / "tasks.jsonl", "w") as f:
        for t in tasks:
            f.write(json.dumps(t) + "\n")
    subset = []
    for fam in ["chain", "sql", "retrieval", "files", "multiturn"]:
        ids = [t["id"] for t in tasks if t["family"] == fam]
        subset += ids[0::3][:6]
    (BENCH / "data" / "subset30.txt").write_text("\n".join(subset) + "\n")
    print(len(tasks), "tasks;", len(subset), "subset")


if __name__ == "__main__":
    main()
