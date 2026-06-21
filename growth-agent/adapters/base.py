"""Channel adapter interface + registry.

Each channel (koreapas, and later linkedin/reddit/threads) implements one
adapter. Adding a platform is a drop-in: implement Adapter and register it.
"""

from typing import Protocol


class Adapter(Protocol):
    channel: str

    def build_body(self, subject: str, hook_html: str, tracked_url: str) -> str:
        """Compose the full post body from the LLM hook + the fixed template."""
        ...

    def already_posted(self, subject: str) -> bool:
        """True if an equivalent ad is already live (avoid duplicate spam)."""
        ...

    def post(self, subject: str, body: str) -> str:
        """Publish. Returns the external URL (or a best-effort board URL)."""
        ...


_REGISTRY: dict[str, Adapter] = {}


def register(adapter: Adapter) -> None:
    _REGISTRY[adapter.channel] = adapter


def get(channel: str) -> Adapter:
    if channel not in _REGISTRY:
        raise KeyError(f"No adapter registered for channel '{channel}'")
    return _REGISTRY[channel]


def channels() -> list[str]:
    return list(_REGISTRY)
