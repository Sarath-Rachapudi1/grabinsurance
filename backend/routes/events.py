"""
GET /api/v1/events/stream

Server-Sent Events endpoint for the pipeline visualizer.
The frontend connects here once and receives a real-time stream of every
backend operation as it happens — AI scoring, policy issuance, webhooks, etc.

SSE format:
  data: {"type": "pipeline.start", "ts": 1234567890.1, "data": {...}}\n\n

Keepalive SSE comments are sent every 15 s to prevent connection timeouts.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from event_bus import subscribe, unsubscribe

router    = APIRouter()
logger    = logging.getLogger(__name__)
KEEPALIVE = 15  # seconds between keepalive comments


@router.get("/events/stream", include_in_schema=True)
async def event_stream() -> StreamingResponse:
    """
    Subscribe to the backend pipeline event stream.
    Open this URL in the Visualizer page — it stays connected indefinitely.
    """

    async def generator():
        q = subscribe()
        try:
            # Immediately confirm connection
            welcome = {"type": "connected", "ts": time.time(), "data": {"message": "Pipeline visualizer connected"}}
            yield f"data: {json.dumps(welcome)}\n\n"

            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=KEEPALIVE)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # SSE comment — keeps the connection alive through proxies
                    yield ": keepalive\n\n"

        except (asyncio.CancelledError, GeneratorExit):
            pass  # client disconnected — clean exit
        finally:
            unsubscribe(q)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering in prod
            "Connection":        "keep-alive",
        },
    )
