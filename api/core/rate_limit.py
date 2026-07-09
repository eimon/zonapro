import time
from collections import defaultdict
from fastapi import Request, HTTPException

_submissions: dict[str, list[float]] = defaultdict(list)
WINDOW = 3600  # 1 hour in seconds
MAX_SUBMISSIONS = 3


def check_rate_limit(request: Request) -> None:
    ip = request.client.host
    now = time.time()
    window_start = now - WINDOW
    _submissions[ip] = [t for t in _submissions[ip] if t > window_start]
    if len(_submissions[ip]) >= MAX_SUBMISSIONS:
        raise HTTPException(
            status_code=429,
            headers={"Retry-After": "3600"},
            detail="Demasiadas consultas. Intentá de nuevo en una hora.",
        )
    _submissions[ip].append(now)
