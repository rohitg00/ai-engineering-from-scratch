import subprocess
for mode in [[],['--local-http']]:
    subprocess.run(['go','run','.']+mode,check=True)
    subprocess.run(['node','--experimental-strip-types','cli.ts'],check=True)
