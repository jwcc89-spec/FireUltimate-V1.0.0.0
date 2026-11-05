import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  extractPlainTextFromDecodedMime,
  getDispatchPlainTextFromRawBody,
  tryDecodeRawBody,
} from "./extractDispatchPlainText.ts";

const GMAIL_STYLE_MIME = `MIME-Version: 1.0
From: Test <test@gmail.com>
To: cifpdil@cad.fireultimate.app
Content-Type: multipart/alternative; boundary="000000000000ab"

--000000000000ab
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

ICOMM CAD =E2=80=94 NEW INCIDENT
CFS: 25-004567
CALL: 2025-00098765

--000000000000ab
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

<div>CFS: 25-004567</div>

--000000000000ab--
`;

describe("extractPlainTextFromDecodedMime", () => {
  test("extracts first text/plain with quoted-printable (Gmail-style multipart)", () => {
    const plain = extractPlainTextFromDecodedMime(GMAIL_STYLE_MIME);
    assert.ok(plain);
    assert.match(plain, /ICOMM CAD/);
    assert.match(plain, /— NEW INCIDENT/);
    assert.match(plain, /CFS: 25-004567/);
    assert.doesNotMatch(plain, /ARC-Seal/);
  });
});

describe("getDispatchPlainTextFromRawBody", () => {
  test("decodes base64-wrapped Gmail MIME end-to-end", () => {
    const b64 = Buffer.from(GMAIL_STYLE_MIME, "utf8").toString("base64");
    assert.ok(tryDecodeRawBody(b64));
    const plain = getDispatchPlainTextFromRawBody(b64);
    assert.ok(plain);
    assert.match(plain, /CFS: 25-004567/);
    assert.doesNotMatch(plain, /Content-Transfer-Encoding/);
  });
});
