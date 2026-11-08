import subprocess,tempfile
from pathlib import Path
with tempfile.TemporaryDirectory() as tmp:
    binary=str(Path(tmp)/'sse-fixture')
    subprocess.run(['go','build','-o',binary,'.'],check=True)
    server=subprocess.Popen([binary,'--seconds','10'],stdout=subprocess.PIPE,text=True)
    try:
        url=server.stdout.readline().strip()
        if not url: raise RuntimeError('fixture did not start')
        subprocess.run(['node','--experimental-strip-types','cli.ts',url],check=True)
    finally:
        server.terminate();server.wait(timeout=5)
