import contextlib
import hashlib
import importlib.util
import io
import json
import unittest
from pathlib import Path
from types import SimpleNamespace


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "hermes-google-doc.py"
SPEC = importlib.util.spec_from_file_location("hermes_google_doc", MODULE_PATH)
hermes = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(hermes)


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def fixture_document(text, revision_id="rev-1", document_id="doc-1"):
    text_length = hermes.utf16_length(text)
    return {
        "documentId": document_id,
        "revisionId": revision_id,
        "body": {
            "content": [
                {
                    "startIndex": 1,
                    "endIndex": text_length + 2,
                    "paragraph": {
                        "elements": [
                            {
                                "startIndex": 1,
                                "endIndex": text_length + 1,
                                "textRun": {"content": text},
                            }
                        ]
                    },
                }
            ]
        },
    }


class FakeRequest:
    def __init__(self, value):
        self.value = value

    def execute(self):
        return self.value


class FakeFiles:
    def __init__(self, metadata):
        self.metadata = metadata
        self.calls = []

    def get(self, **kwargs):
        self.calls.append(kwargs)
        return FakeRequest(self.metadata)


class FakeDocuments:
    def __init__(self, before, after):
        self.before = before
        self.after = after
        self.get_calls = 0
        self.batch_calls = []

    def get(self, **kwargs):
        self.get_calls += 1
        return FakeRequest(self.before if self.get_calls == 1 else self.after)

    def batchUpdate(self, **kwargs):
        self.batch_calls.append(kwargs)
        return FakeRequest({"replies": [{}, {}]})


class FakeGoogleApi:
    def __init__(self, before, after, metadata):
        self.documents = FakeDocuments(before, after)
        self.files = FakeFiles(metadata)

    def build_service(self, kind, version):
        if kind == "docs":
            return SimpleNamespace(documents=lambda: self.documents)
        if kind == "drive":
            return SimpleNamespace(files=lambda: self.files)
        raise AssertionError(f"service inattendu: {kind} {version}")


class HermesGoogleDocTests(unittest.TestCase):
    def test_utf16_index_and_batch_requests_with_astral_character(self):
        document = fixture_document("A😀B\n")
        self.assertEqual(hermes.utf16_length("A😀B"), 4)
        runs = hermes.text_runs(document)
        self.assertEqual(runs[0][:2], (0, 5))
        self.assertEqual(hermes.docs_index(runs, 1), 2)
        self.assertEqual(hermes.docs_index(runs, 3), 4)

        requests = hermes.build_batch_update_requests(
            document,
            [{"start": 1, "end": 3, "text": "東京"}],
        )
        self.assertEqual(
            requests,
            [
                {
                    "deleteContentRange": {
                        "range": {"startIndex": 2, "endIndex": 4}
                    }
                },
                {
                    "insertText": {
                        "location": {"index": 2},
                        "text": "東京",
                    }
                },
            ],
        )

    def test_batch_is_atomic_and_uses_right_to_left_edits(self):
        document = fixture_document("A😀B\n")
        requests = hermes.build_batch_update_requests(
            document,
            [
                {"start": 1, "end": 3, "text": "X"},
                {"start": 3, "end": 4, "text": "Y"},
            ],
        )
        self.assertEqual(requests[0]["deleteContentRange"]["range"], {"startIndex": 4, "endIndex": 5})
        self.assertEqual(requests[2]["deleteContentRange"]["range"], {"startIndex": 2, "endIndex": 4})

    def test_patch_checks_hash_revision_and_can_edit_before_batch(self):
        before = fixture_document("A😀B\n")
        after = fixture_document("AXB\n")
        metadata = {
            "id": "doc-1",
            "mimeType": "application/vnd.google-apps.document",
            "capabilities": {"canEdit": True},
        }
        fake_api = FakeGoogleApi(before, after, metadata)
        args = SimpleNamespace(
            doc_id="doc-1",
            edits_json=json.dumps([{"start": 1, "end": 3, "text": "X"}]),
            expected_sha256=digest("A😀B\n"),
            expected_after_sha256=digest("AXB\n"),
            expected_revision_id="rev-1",
        )

        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            original_loader = hermes.google_api_module
            hermes.google_api_module = lambda: fake_api
            try:
                hermes.patch(args)
            finally:
                hermes.google_api_module = original_loader

        result = json.loads(output.getvalue())
        self.assertEqual(result["status"], "updated")
        self.assertEqual(len(fake_api.documents.batch_calls), 1)
        body = fake_api.documents.batch_calls[0]["body"]
        self.assertEqual(body["writeControl"], {"requiredRevisionId": "rev-1"})
        self.assertEqual(len(body["requests"]), 2)

    def test_patch_refuses_stale_hash_before_capability_or_write(self):
        before = fixture_document("A😀B\n")
        metadata = {
            "id": "doc-1",
            "mimeType": "application/vnd.google-apps.document",
            "capabilities": {"canEdit": True},
        }
        fake_api = FakeGoogleApi(before, before, metadata)
        args = SimpleNamespace(
            doc_id="doc-1",
            edits_json="[]",
            expected_sha256=digest("autre"),
            expected_after_sha256=digest("A😀B\n"),
            expected_revision_id="rev-1",
        )
        original_loader = hermes.google_api_module
        hermes.google_api_module = lambda: fake_api
        try:
            with self.assertRaisesRegex(RuntimeError, "changé depuis le dry-run"):
                hermes.patch(args)
        finally:
            hermes.google_api_module = original_loader
        self.assertEqual(fake_api.files.calls, [])
        self.assertEqual(fake_api.documents.batch_calls, [])

    def test_patch_refuses_revision_or_edit_capability_mismatch(self):
        before = fixture_document("A😀B\n", revision_id="rev-current")
        after = fixture_document("AXB\n", revision_id="rev-current")
        for metadata, expected_revision, message in [
            (
                {
                    "id": "doc-1",
                    "mimeType": "application/vnd.google-apps.document",
                    "capabilities": {"canEdit": True},
                },
                "rev-old",
                "révision",
            ),
            (
                {
                    "id": "doc-1",
                    "mimeType": "application/vnd.google-apps.document",
                    "capabilities": {"canEdit": False},
                },
                "rev-current",
                "canEdit",
            ),
        ]:
            fake_api = FakeGoogleApi(before, after, metadata)
            args = SimpleNamespace(
                doc_id="doc-1",
                edits_json=json.dumps([{"start": 1, "end": 3, "text": "X"}]),
                expected_sha256=digest("A😀B\n"),
                expected_after_sha256=digest("AXB\n"),
                expected_revision_id=expected_revision,
            )
            original_loader = hermes.google_api_module
            hermes.google_api_module = lambda: fake_api
            try:
                with self.assertRaisesRegex(RuntimeError, message):
                    hermes.patch(args)
            finally:
                hermes.google_api_module = original_loader
            self.assertEqual(fake_api.documents.batch_calls, [])


if __name__ == "__main__":
    unittest.main()
