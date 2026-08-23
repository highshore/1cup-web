#!/usr/bin/env python3
"""Translate unfilled English Wiktionary meanings to Korean using local TranslateGemma.

The worker is deliberately idempotent: it selects only rows with a null
definition_ko and each PATCH repeats that null guard. Stop it at any time and
run it again to continue. It uses the existing MLX TranslateGemma runner and
never sends dictionary text to a hosted inference API.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


DEFAULT_PIPELINE_ROOT = Path("/Users/ksk/Desktop/1cup-article-pipeline")
DEFAULT_MODEL_CACHE = Path(
    "/Users/ksk/.cache/huggingface/models--mlx-community--translategemma-12b-it-4bit/snapshots"
)
HANGUL = re.compile(r"[가-힣]")
ASCII_LOWER_WORD = re.compile(r"\b[a-z][a-z-]{2,}\b")


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


class SupabaseRest:
    def __init__(self, base_url: str, service_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    def request(
        self,
        method: str,
        path: str,
        params: list[tuple[str, str]],
        payload: Any | None = None,
    ) -> Any:
        query = urllib.parse.urlencode(params, safe="(),:*")
        url = f"{self.base_url}/rest/v1/{path}?{query}" if query else f"{self.base_url}/rest/v1/{path}"
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(url, data=body, headers=self.headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                content = response.read()
                return json.loads(content) if content else None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase {method} {path} failed: HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Supabase {method} {path} failed: {exc.reason}") from exc

    def untranslated_meanings(self, limit: int) -> list[dict[str, Any]]:
        result = self.request(
            "GET",
            "dictionary_meanings",
            [
                (
                    "select",
                    "id,definition_en,grammar_type,entry:dictionary_entries(term),"
                    "translation_failure:dictionary_translation_failures!left(meaning_id)",
                ),
                ("source", "eq.wiktionary"),
                ("definition_ko", "is.null"),
                ("definition_en", "not.is.null"),
                ("translation_failure", "is.null"),
                ("order", "id.asc"),
                ("limit", str(limit)),
            ],
        )
        return result if isinstance(result, list) else []

    def failed_meanings(self, limit: int) -> list[dict[str, Any]]:
        result = self.request(
            "GET",
            "dictionary_translation_failures",
            [
                (
                    "select",
                    "meaning_id,meaning:dictionary_meanings!inner("
                    "id,definition_en,grammar_type,source,definition_ko,entry:dictionary_entries(term))",
                ),
                ("meaning.source", "eq.wiktionary"),
                ("meaning.definition_ko", "is.null"),
                ("order", "last_attempt_at.asc"),
                ("limit", str(limit)),
            ],
        )
        if not isinstance(result, list):
            return []
        return [row["meaning"] for row in result if isinstance(row.get("meaning"), dict)]

    def save_translation(self, meaning_id: str, translation: str) -> None:
        self.request(
            "PATCH",
            "dictionary_meanings",
            [("id", f"eq.{meaning_id}"), ("definition_ko", "is.null")],
            {"definition_ko": translation, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
        )

    def record_failure(self, meaning_id: str, error: str) -> None:
        self.request(
            "POST",
            "rpc/record_dictionary_translation_failure",
            [],
            {"p_meaning_id": meaning_id, "p_error": error[:4000]},
        )

    def clear_failure(self, meaning_id: str) -> None:
        self.request("DELETE", "dictionary_translation_failures", [("meaning_id", f"eq.{meaning_id}")])

    def reset_logged_translations(self, log_path: Path) -> int:
        if not log_path.exists():
            return 0
        ids: list[str] = []
        seen: set[str] = set()
        for line in log_path.read_text(encoding="utf-8").splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            meaning_id = event.get("id") if event.get("status") == "ok" else None
            if isinstance(meaning_id, str) and meaning_id not in seen:
                seen.add(meaning_id)
                ids.append(meaning_id)
        for start in range(0, len(ids), 100):
            chunk = ids[start : start + 100]
            self.request(
                "PATCH",
                "dictionary_meanings",
                [("id", f"in.({','.join(chunk)})"), ("source", "eq.wiktionary")],
                {"definition_ko": None, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            )
        return len(ids)


class DictionaryTranslateGemmaService:
    """Adds the word and part of speech to the local model's translation context."""

    def __init__(self, service: Any) -> None:
        self._service = service

    def translate(self, task: Any, *, retry_policy: Any) -> Any:
        original_build_messages = self._service.build_messages

        def build_messages(context_task: Any) -> list[dict[str, Any]]:
            term = str(context_task.metadata.get("term") or "").strip()
            grammar = str(context_task.metadata.get("grammar_type") or "").strip()
            context = (
                "Translate this English dictionary sense into concise, natural Korean. "
                "Return only the Korean definition. Do not include labels, explanations, "
                "or English words. Preserve the meaning for the given headword and part of speech.\n\n"
                f"Headword: {term}\nPart of speech: {grammar}\nDefinition: {context_task.text}"
            )
            return [{"role": "user", "content": [{
                "type": "text", "source_lang_code": "en", "target_lang_code": "ko", "text": context,
            }]}]

        self._service.build_messages = build_messages
        try:
            return self._service.translate(task, retry_policy=retry_policy)
        finally:
            self._service.build_messages = original_build_messages


def write_event(path: Path, event: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")


def model_path(value: str | None) -> str:
    if value:
        return value
    snapshots = sorted(path for path in DEFAULT_MODEL_CACHE.iterdir() if path.is_dir())
    if not snapshots:
        raise RuntimeError(f"No local TranslateGemma snapshot found under {DEFAULT_MODEL_CACHE}")
    return str(snapshots[-1])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=10, help="Meanings fetched per database batch.")
    parser.add_argument("--max-meanings", type=int, default=0, help="Stop after this many attempted meanings (0 = all).")
    parser.add_argument("--model", help="Local TranslateGemma snapshot path.")
    parser.add_argument("--log", type=Path, default=Path("/tmp/one-cup-wiktionary/translation.log.jsonl"))
    parser.add_argument("--errors", type=Path, default=Path("/tmp/one-cup-wiktionary/translation.errors.jsonl"))
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Retry rows previously quarantined after a failed local translation.",
    )
    parser.add_argument(
        "--reset-previous-run",
        action="store_true",
        help="Clear translations listed in --log so they are regenerated with contextual prompting.",
    )
    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be positive")
    if args.max_meanings < 0:
        parser.error("--max-meanings cannot be negative")

    env = load_env(args.env_file)
    base_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        raise RuntimeError(".env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

    sys.path.insert(0, str(DEFAULT_PIPELINE_ROOT / "src"))
    from local_translategemma.retry import RetryPolicy
    from local_translategemma.schemas import ModelConfig, TranslationTask
    from local_translategemma.service import TranslateGemmaService

    base_service = TranslateGemmaService(
        ModelConfig(model_id=model_path(args.model), offline=True, max_tokens=128, chunk_input_tokens=512)
    )
    base_service.warmup()
    service = DictionaryTranslateGemmaService(base_service)
    database = SupabaseRest(base_url, service_key)

    if args.reset_previous_run:
        reset_count = database.reset_logged_translations(args.log)
        print(f"Cleared {reset_count:,} prior local translations for contextual regeneration.", flush=True)

    attempted = succeeded = failed = 0
    while args.max_meanings == 0 or attempted < args.max_meanings:
        remaining = args.max_meanings - attempted if args.max_meanings else args.batch_size
        rows = (
            database.failed_meanings(min(args.batch_size, remaining))
            if args.retry_failed
            else database.untranslated_meanings(min(args.batch_size, remaining))
        )
        if not rows:
            break

        for row in rows:
            if args.max_meanings and attempted >= args.max_meanings:
                break
            attempted += 1
            meaning_id = str(row["id"])
            definition = str(row.get("definition_en") or "").strip()
            entry = row.get("entry") if isinstance(row.get("entry"), dict) else {}
            term = str(entry.get("term") or "")
            grammar = str(row.get("grammar_type") or "")
            try:
                result = service.translate(
                    TranslationTask(
                        line_number=attempted,
                        record_id=meaning_id,
                        source_lang_code="en",
                        target_lang_code="ko",
                        text=definition,
                        metadata={"term": term, "grammar_type": grammar},
                    )
                    , retry_policy=RetryPolicy()
                )
                translation = result.translation.strip()
                if not translation or not HANGUL.search(translation):
                    raise RuntimeError("TranslateGemma returned no Korean text")
                if ASCII_LOWER_WORD.search(translation):
                    raise RuntimeError("TranslateGemma output still contains an English word")
                database.save_translation(meaning_id, translation)
                database.clear_failure(meaning_id)
                succeeded += 1
                write_event(args.log, {
                    "status": "ok", "id": meaning_id, "term": term, "grammar_type": grammar,
                    "translation": translation, "elapsed_seconds": round(result.elapsed_seconds, 3),
                })
            except Exception as exc:  # Keep the long-running batch moving past bad rows.
                failed += 1
                try:
                    database.record_failure(meaning_id, str(exc))
                except Exception as record_error:
                    print(
                        f"Could not quarantine failed translation {meaning_id}: {record_error}",
                        file=sys.stderr,
                        flush=True,
                    )
                write_event(args.errors, {
                    "status": "error", "id": meaning_id, "term": term, "grammar_type": grammar,
                    "definition_en": definition, "error": str(exc),
                })
                print(f"Translation failed for {term!r} ({meaning_id}): {exc}", file=sys.stderr, flush=True)
            if attempted % 10 == 0:
                print(f"Attempted {attempted:,}; translated {succeeded:,}; failed {failed:,}", flush=True)

    print(json.dumps({"attempted": attempted, "translated": succeeded, "failed": failed}, ensure_ascii=False))
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
