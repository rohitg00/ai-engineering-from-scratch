import dis
import io
import os
import py_compile
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "ledger.py")
TAG = sys.implementation.cache_tag


def compile_fixtures():
    py_compile.compile(SOURCE, cfile=os.path.join(HERE, f"ledger.{TAG}.pyc"), dfile="ledger.py", doraise=True, invalidation_mode=py_compile.PycInvalidationMode.CHECKED_HASH)
    py_compile.compile(SOURCE, cfile=os.path.join(HERE, f"ledger.{TAG}.timestamp.pyc"), dfile="ledger.py", doraise=True, invalidation_mode=py_compile.PycInvalidationMode.TIMESTAMP)


def adaptive_listing():
    sys.path.insert(0, HERE)
    import ledger

    for score in range(0, 200):
        ledger.grade(score)
        ledger.total([score, 1, 2])
    out = io.StringIO()
    dis.dis(ledger.grade, file=out, adaptive=True)
    out.write("\n")
    dis.dis(ledger.total, file=out, adaptive=True)
    return out.getvalue()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "adaptive":
        sys.stdout.write(adaptive_listing())
    else:
        compile_fixtures()
        print(f"{sys.version.split()[0]} wrote ledger.{TAG}.pyc and ledger.{TAG}.timestamp.pyc")
