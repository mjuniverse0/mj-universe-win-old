#!/usr/bin/env python3
"""
MJ Universe — lytter til TikTok LIVE-chat (ikke Telegram).

Bruker TikTokLive (uoffisiell reverse-engineering). Du kan logge kommentarer,
telle likes/gaver, eller sende dem til en Discord-webhook — men du kan *ikke*
svare automatisk inne i TikTok-chatten med dette biblioteket.

Krav:
  • Python 3.10+
  • Kontoen må være LIVE mens scriptet kjører

Oppsett:
  pip install -r requirements-bot.txt

  # TikTok-brukernavn uten @ (den som streamer)
  set TIKTOK_UNIQUE_ID=mj_universe

  # Valgfritt: Discord webhook (JSON {"content": "..."})
  set CHAT_WEBHOOK_URL=https://discord.com/api/webhooks/...

  python bot.py
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse, urlunparse

from TikTokLive import TikTokLiveClient
from TikTokLive.events import CommentEvent, ConnectEvent, DisconnectEvent, LiveEndEvent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("tiktok-chat")


def unique_id_from_env() -> str:
    raw = os.environ.get("TIKTOK_UNIQUE_ID", "").strip().lstrip("@")
    if not raw:
        log.error("Sett miljøvariabel TIKTOK_UNIQUE_ID (TikTok-brukernavn som er LIVE).")
        sys.exit(1)
    return raw


def normalize_discord_webhook_url(url: str) -> str:
    """
    Discord execute-webhook must be POST. urllib follows some redirects with GET,
    which yields 405. Fix: https (not http) and versioned path /api/v10/webhooks/…
    """
    p = urlparse(url.strip())
    host = (p.hostname or "").lower()
    if p.scheme.lower() == "http" and (
        host == "discord.com"
        or host.endswith(".discord.com")
        or host == "discordapp.com"
        or host.endswith(".discordapp.com")
    ):
        p = p._replace(scheme="https")
    path = p.path or ""
    m = re.match(r"^/api/webhooks/(\d+)/([^/]+)/?$", path)
    if m and "/api/v" not in path:
        p = p._replace(path=f"/api/v10/webhooks/{m.group(1)}/{m.group(2)}")
    return urlunparse(p)


def maybe_discord_webhook(line: str) -> None:
    raw = os.environ.get("CHAT_WEBHOOK_URL", "").strip()
    url = normalize_discord_webhook_url(raw)
    if not url:
        return
    if url != raw and not getattr(maybe_discord_webhook, "_url_norm_logged", False):
        log.info("Webhook-URL normalisert (https og/eller /api/v10/…) — unngår POST→GET ved redirect (405).")
        setattr(maybe_discord_webhook, "_url_norm_logged", True)
    payload = json.dumps({"content": line[:1900]}).encode("utf-8")
    # Discord/Cloudflare often returns 403 for urllib's default User-Agent (Python-urllib/…).
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MJUniverse-TikTokBot/1.0",
    }
    req = urllib.request.Request(
        url,
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=8)
    except urllib.error.HTTPError as e:
        snippet = ""
        try:
            snippet = e.read().decode("utf-8", errors="replace")[:400]
        except Exception:
            pass
        log.warning(
            "Webhook HTTP %s %s%s",
            e.code,
            e.reason,
            f" — {snippet!r}" if snippet else "",
        )
    except urllib.error.URLError as e:
        log.warning("Webhook feilet: %s", e)


def main() -> None:
    uid = unique_id_from_env()
    client = TikTokLiveClient(unique_id=f"@{uid}")

    @client.on(ConnectEvent)
    async def on_connect(_event: ConnectEvent) -> None:
        rid = getattr(client, "room_id", None)
        log.info("Koblet til @%s LIVE (room_id=%s)", uid, rid)

    @client.on(DisconnectEvent)
    async def on_disconnect(_event: DisconnectEvent) -> None:
        log.info("Frakoblet fra TikTok LIVE")

    @client.on(LiveEndEvent)
    async def on_live_end(_event: LiveEndEvent) -> None:
        log.info("Sendingen er avsluttet")

    @client.on(CommentEvent)
    async def on_comment(event: CommentEvent) -> None:
        user = getattr(event, "user", None)
        nick = (
            getattr(user, "nickname", None)
            or getattr(user, "nick_name", None)
            or getattr(user, "unique_id", None)
            or "?"
        )
        text = getattr(event, "comment", None) or getattr(event, "text", None) or ""
        line = f"[TikTok] **{nick}**: {text}"
        log.info("%s: %s", nick, text)
        maybe_discord_webhook(line)

    log.info("Starter — @%s må være LIVE. Ctrl+C for å stoppe.", uid)
    client.run()


if __name__ == "__main__":
    main()
