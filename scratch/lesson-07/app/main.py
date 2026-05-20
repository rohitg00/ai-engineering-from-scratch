import socket
import sys

from rich.console import Console
from rich.panel import Panel


def main() -> None:
    console = Console()
    message = f"""Привет из твоего первого контейнера!
У тебя установлен python - {sys.version} на компьютере - {socket.gethostname()}"""
    console.print(Panel(message))


if __name__ == "__main__":
    main()
