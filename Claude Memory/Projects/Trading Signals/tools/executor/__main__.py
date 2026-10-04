"""Entry point for `python -m executor` (see tradeguard-executor.service).

Delegates to main.main() rather than duplicating the orchestration logic —
there is exactly one _run() implementation (in main.py), reviewed and tested
once, instead of two copies that can silently drift apart.
"""
from .main import main

if __name__ == "__main__":
    raise SystemExit(main())
