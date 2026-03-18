"""
Pipeline event bus — real-time pub/sub for the visualizer.

Every backend operation (recommend, scoring, quote, policy, webhook) calls
`await emit(type, data)`.  The SSE endpoint in routes/events.py fans events
out to all connected browser clients.

Design:
  - Module-level list of asyncio.Queue subscribers.
  - emit() uses put_nowait — never blocks; drops silently if a subscriber queue is full.
  - Queues are cleaned up when the SSE connection closes.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# Each connected SSE client gets one queue.
_subscribers: list[asyncio.Queue] = []


def subscribe() -> asyncio.Queue:
    """Register a new SSE subscriber. Returns its dedicated queue."""
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    _subscribers.append(q)
    logger.debug("Visualizer subscriber added  (total=%d)", len(_subscribers))
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    """Remove a subscriber queue (called when the SSE connection closes)."""
    try:
        _subscribers.remove(q)
        logger.debug("Visualizer subscriber removed (total=%d)", len(_subscribers))
    except ValueError:
        pass  # already gone


async def emit(event_type: str, data: dict[str, Any]) -> None:
    """
    Broadcast an event to every connected visualizer client.

    Args:
        event_type:  Dot-namespaced string, e.g. "pipeline.start", "scoring.result".
        data:        Arbitrary JSON-serialisable dict — step-specific payload.
    """
    if not _subscribers:
        return  # no visualizer open — skip silently

    event = {"type": event_type, "ts": time.time(), "data": data}
    for q in _subscribers:
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass  # slow consumer — drop rather than block the request
