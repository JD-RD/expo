#!/usr/bin/env python3
"""Small write-capable relay for the Hermes Google Docs client.

OAuth material is resolved by Hermes' external google_api.py. This file only
returns Drive edit capability or applies a guarded section/generic update.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
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


def text_runs(document: dict) -> list[tuple[int, int, int, int]]:
    """Map logical UTF-16 offsets to the indexes exposed by Google Docs.

    The first two tuple members are offsets in the concatenated document text;
    the last two are the corresponding Google Docs UTF-16 indexes.  Keeping
    both coordinate systems explicit prevents Python code-point offsets from
    being used accidentally for astral characters such as emoji.
    """
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
            content_length = utf16_length(content)
            runs.append((
                offset,
                offset + content_length,
                start_index,
                start_index + content_length,
            ))
            offset += content_length
    return runs


def docs_index(runs: list[tuple[int, int, int, int]], offset: int) -> int:
    """Convert a logical UTF-16 text offset to a Google Docs index."""
    if not isinstance(offset, int) or offset < 0:
        raise RuntimeError("offset texte invalide")
    for start, end, google_start, google_end in runs:
        if start <= offset <= end:
            return google_end if offset == end else google_start + (offset - start)
    if runs and offset == runs[-1][1]:
        return runs[-1][3]
    raise RuntimeError("impossible de convertir la position texte en index Google Docs")


def body_end_index(document: dict) -> int:
    indexes = [
        element.get("endIndex")
        for element in document.get("body", {}).get("content", [])
        if isinstance(element.get("endIndex"), int)
    ]
    if not indexes:
        raise RuntimeError("endIndex du corps Google Docs absent")
    return max(indexes)


def google_index_for_offset(document: dict, offset: int) -> int:
    """Convert a logical UTF-16 offset, including the body end, to an API index."""
    text_length = utf16_length(document_text(document))
    if offset < 0 or offset > text_length:
        raise RuntimeError(
            f"offset texte hors limites: {offset}; longueur UTF-16: {text_length}"
        )
    runs = text_runs(document)
    if offset == text_length:
        # Google Docs reserves the final body index for the structural newline.
        return max(body_end_index(document) - 1, 1)
    return docs_index(runs, offset)


def validate_document_metadata(metadata: dict, doc_id: str) -> None:
    if metadata.get("id") != doc_id:
        raise RuntimeError("le document retourné ne correspond pas à l’identifiant demandé")
    if metadata.get("mimeType") != "application/vnd.google-apps.document":
        raise RuntimeError("la cible n’est pas un Google Doc")
    capabilities = metadata.get("capabilities") or {}
    if capabilities.get("canEdit") is not True:
        raise RuntimeError("canEdit=false; écriture refusée")


def _edit_values(edit: dict) -> tuple[int, int, str]:
    if not isinstance(edit, dict):
        raise RuntimeError("chaque édition doit être un objet")
    start = edit.get("start", edit.get("start_offset"))
    end = edit.get("end", edit.get("end_offset"))
    text = edit.get("text", "")
    if not isinstance(start, int) or not isinstance(end, int):
        raise RuntimeError("les positions d’édition doivent être des entiers UTF-16")
    if not isinstance(text, str):
        raise RuntimeError("le texte d’édition doit être une chaîne")
    if start < 0 or end < start:
        raise RuntimeError("la plage d’édition est invalide")
    return start, end, text


def build_batch_update_requests(document: dict, edits: list[dict]) -> list[dict]:
    """Build one atomic batch from edits produced by the pure change-plan engine.

    ``start`` and ``end`` are offsets in the concatenated document text using
    JavaScript/Google UTF-16 units.  Edits must describe the original document;
    they are emitted from right to left so earlier indexes remain stable.
    """
    if not isinstance(edits, list):
        raise RuntimeError("edits doit être une liste")

    text_length = utf16_length(document_text(document))
    normalized = []
    for edit in edits:
        start, end, text = _edit_values(edit)
        if end > text_length:
            raise RuntimeError(
                f"la plage d’édition dépasse le document: {start}–{end}; longueur: {text_length}"
            )
        normalized.append({"start": start, "end": end, "text": text})

    normalized.sort(key=lambda item: (item["start"], item["end"]))
    previous = None
    for edit in normalized:
        same_insertion_point = (
            previous is not None
            and previous["start"] == previous["end"] == edit["start"] == edit["end"]
        )
        if previous is not None and (edit["start"] < previous["end"] or same_insertion_point):
            raise RuntimeError("les éditions se chevauchent ou partagent une position")
        previous = edit

    requests = []
    for edit in reversed(normalized):
        start_index = google_index_for_offset(document, edit["start"])
        end_index = google_index_for_offset(document, edit["end"])
        if edit["start"] != edit["end"]:
            requests.append({
                "deleteContentRange": {
                    "range": {"startIndex": start_index, "endIndex": end_index}
                }
            })
        if edit["text"]:
            requests.append({
                "insertText": {
                    "location": {"index": start_index},
                    "text": edit["text"],
                }
            })
    return requests


# Short alias for callers/tests that refer to the transport operation directly.
build_patch_requests = build_batch_update_requests


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


def patch(args) -> None:
    """Apply a generic pure-engine patch through one guarded batchUpdate.

    The Node change-plan engine owns validation and sequential text planning.
    It passes the resulting non-overlapping edits as UTF-16 offsets.  This
    relay only performs the remote concurrency/capability checks and transport.
    """
    try:
        edits_payload = json.loads(args.edits_json)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"edits JSON invalide: {error}") from error
    edits = edits_payload.get("edits") if isinstance(edits_payload, dict) else edits_payload
    if not isinstance(edits, list):
        raise RuntimeError("edits JSON doit être une liste ou un objet {edits: [...]}")

    for name in ("expected_sha256", "expected_after_sha256"):
        value = getattr(args, name)
        if len(value) != 64 or any(character not in "0123456789abcdefABCDEF" for character in value):
            raise RuntimeError(f"{name} doit être une empreinte SHA-256 hexadécimale")

    google_api = google_api_module()
    service = google_api.build_service("docs", "v1")
    document = service.documents().get(documentId=args.doc_id).execute()
    if document.get("documentId") != args.doc_id:
        raise RuntimeError("le document lu ne correspond pas à l’identifiant demandé")

    current = document_text(document)
    actual_hash = hashlib.sha256(current.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(actual_hash, args.expected_sha256.lower()):
        raise RuntimeError("le Google Doc a changé depuis le dry-run; écriture refusée")

    revision_id = document.get("revisionId")
    if not revision_id:
        raise RuntimeError("revisionId absent; écriture refusée")
    if revision_id != args.expected_revision_id:
        raise RuntimeError("la révision Google Docs a changé depuis le dry-run; écriture refusée")

    drive = google_api.build_service("drive", "v3")
    metadata = drive.files().get(
        fileId=args.doc_id,
        fields="id,mimeType,capabilities(canEdit)",
    ).execute()
    validate_document_metadata(metadata, args.doc_id)

    requests = build_batch_update_requests(document, edits)
    expected_after = args.expected_after_sha256.lower()
    if not requests:
        if not hmac.compare_digest(actual_hash, expected_after):
            raise RuntimeError("le patch sans édition ne correspond pas à l’empreinte finale attendue")
        print(json.dumps({
            "status": "noop",
            "action": "noop",
            "requests": 0,
            "revisionId": revision_id,
        }, ensure_ascii=False))
        return

    result = service.documents().batchUpdate(
        documentId=args.doc_id,
        body={
            "requests": requests,
            "writeControl": {"requiredRevisionId": revision_id},
        },
    ).execute()

    after_document = service.documents().get(documentId=args.doc_id).execute()
    if after_document.get("documentId") != args.doc_id:
        raise RuntimeError("la relecture ne correspond pas à l’identifiant demandé")
    after_text = document_text(after_document)
    after_hash = hashlib.sha256(after_text.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(after_hash, expected_after):
        raise RuntimeError("relecture post-écriture non conforme; état distant incertain")

    print(json.dumps({
        "status": "updated",
        "action": "patch",
        "requests": len(requests),
        "replies": len(result.get("replies", [])),
        "beforeSha256": actual_hash,
        "afterSha256": after_hash,
    }, ensure_ascii=False))


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

    generic = sub.add_parser(
        "patch",
        help="appliquer les éditions UTF-16 préparées par le moteur pur",
    )
    generic.add_argument("doc_id")
    generic.add_argument(
        "--edits-json",
        required=True,
        help="liste JSON d’éditions {start,end,text}, en offsets UTF-16 du texte",
    )
    generic.add_argument("--expected-sha256", required=True)
    generic.add_argument("--expected-after-sha256", required=True)
    generic.add_argument("--expected-revision-id", required=True)
    generic.set_defaults(func=patch)

    args = parser.parse_args()
    try:
        args.func(args)
    except Exception as error:
        print(f"ERROR hermes-google-doc: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
