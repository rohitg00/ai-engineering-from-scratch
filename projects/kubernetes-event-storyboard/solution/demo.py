import subprocess
subprocess.run(['go','run','.'],check=True)
subprocess.run(['node','--experimental-strip-types','cli.ts'],check=True)
