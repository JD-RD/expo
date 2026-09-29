#!/usr/bin/env python3
"""Small write-capable relay for the Hermes Google Docs client.

OAuth material is resolved by Hermes' external google_api.py. This file only
returns Drive edit capability or applies an exact, hash-guarded section update.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path


def google_api_module():
    api_path = Path(
        os.environ.get(
            "HERMES_GOOGLE_API",
            Path.home() / ".hermes/skills/productivity/google-workspace/scripts/google_api.py",
        )
    ).expanduser().resolve()
    if not api_path.is_file():
        raise RuntimeError(f"google_api.py introuvable: {api_path}")
    sys.path.insert(0, str(api_path.parent))
    import google_api  # type: ignore

    return google_api


def document_text(document: dict) -> str:
    parts: list[str] = []
    for element in document.get("body", {}).get("content", []):
        paragraph = element.get("paragraph", {})
        for child in paragraph.get("elements", []):
            text_run = child.get("textRun", {})
            if text_run.get("content"):
                parts.append(text_run["content"])
    return "".join(parts)


def utf16_length(value: str) -> int:
    """Return the number of UTF-16 code units used by Google Docs indexes."""
    return len(value.encode("utf-16-le")) // 2


def text_runs(document: dict) -> list[tuple[int, int, int]]:
    runs = []
    offset = 0
    for element in document.get("body", {}).get("content", []):
        paragraph = element.get("paragraph", {})
        for child in paragraph.get("elements", []):
            text_run = child.get("textRun", {})
            content = text_run.get("content", "")
            if not content:
                continue
            start_index = child.get("startIndex")
            if not isinstance(start_index, int):
                raise RuntimeError("index Google Docs absent d’un textRun")
            runs.append((offset, offset + len(content), start_index))
            offset += utf16_length(content)
    return runs


def docs_index(runs: list[tuple[int, int, int]], offset: int) -> int:
    for start, end, google_start in runs:
        if start <= offset <= end:
            return google_start + (offset - start)
    if runs and offset == runs[-1][1]:
        return runs[-1][2] + (runs[-1][1] - runs[-1][0])
    raise RuntimeError("impossible de convertir la position texte en index Google Docs")


def marker_region(text: str) -> tuple[int, int] | None:
    start_marker = "<!-- EXPO:SYNC:START -->"
    end_marker = "<!-- EXPO:SYNC:END -->"
    starts = [index for index in range(len(text)) if text.startswith(start_marker, index)]
    ends = [index for index in range(len(text)) if text.startswith(end_marker, index)]
    if len(starts) != len(ends) or len(starts) > 1:
        raise RuntimeError("marqueurs EXPO absents par paire ou présents plusieurs fois")
    if not starts:
        return None
    if starts[0] >= ends[0]:
        raise RuntimeError("marqueur EXPO de fin placé avant celui de début")
    return starts[0], ends[0] + len(end_marker)


def separator(text: str) -> str:
    if not text:
        return ""
    return "\n" if text.endswith("\n") else "\n\n"


def capability(args) -> None:
    google_api = google_api_module()
    service = google_api.build_service("drive", "v3")
    metadata = service.files().get(
        fileId=args.doc_id,
        fields="id,name,mimeType,webViewLink,capabilities(canEdit)",
    ).execute()
    print(json.dumps({
        "id": metadata.get("id", ""),
        "name": metadata.get("name", ""),
        "mimeType": metadata.get("mimeType", ""),
        "webViewLink": metadata.get("webViewLink", ""),
        "canEdit": metadata.get("capabilities", {}).get("canEdit", False),
    }, ensure_ascii=False))


def sync(args) -> None:
    google_api = google_api_module()
    service = google_api.build_service("docs", "v1")
    document = service.documents().get(documentId=args.doc_id).execute()
    current = document_text(document)
    actual_hash = hashlib.sha256(current.encode("utf-8")).hexdigest()
    if actual_hash != args.expected_sha256:
        raise RuntimeError("le Google Doc a changé depuis le dry-run; écriture refusée")

    drive = google_api.build_service("drive", "v3")
    metadata = drive.files().get(
        fileId=args.doc_id,
        fields="id,mimeType,capabilities(canEdit)",
    ).execute()
    if metadata.get("mimeType") != "application/vnd.google-apps.document":
        raise RuntimeError("la cible n’est pas un Google Doc")
    if metadata.get("capabilities", {}).get("canEdit") is not True:
        raise RuntimeError("canEdit=false; écriture refusée")

    region = marker_region(current)
    requests = []
    if region is None:
        end_index = max(
            (element.get("endIndex", 1) for element in document.get("body", {}).get("content", [])),
            default=1,
        )
        insert_index = max(end_index - 1, 1)
        requests.append({"insertText": {"location": {"index": insert_index}, "text": separator(current) + args.text + "\n"}})
        action = "append"
    else:
        start_offset, end_offset = region
        runs = text_runs(document)
        start_index = docs_index(runs, utf16_length(current[:start_offset]))
        end_index = docs_index(runs, utf16_length(current[:end_offset]))
        requests.extend([
            {"deleteContentRange": {"range": {"startIndex": start_index, "endIndex": end_index}}},
            {"insertText": {"location": {"index": start_index}, "text": args.text}},
        ])
        action = "replace"

    revision_id = document.get("revisionId")
    if not revision_id:
        raise RuntimeError("revisionId absent; écriture refusée")

    result = service.documents().batchUpdate(
        documentId=args.doc_id,
        body={
            "requests": requests,
            "writeControl": {"requiredRevisionId": revision_id},
        },
    ).execute()
    print(json.dumps({"status": "updated", "action": action, "replies": len(result.get("replies", []))}))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    check = sub.add_parser("capability")
    check.add_argument("doc_id")
    check.set_defaults(func=capability)

    update = sub.add_parser("sync")
    update.add_argument("doc_id")
    update.add_argument("--text", required=True)
    update.add_argument("--expected-sha256", required=True)
    update.set_defaults(func=sync)

    args = parser.parse_args()
    try:
        args.func(args)
    except Exception as error:
        print(f"ERROR hermes-google-doc: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
