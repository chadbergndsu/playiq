import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildZip } from "./zip";

describe("buildZip", () => {
  it("creates a zip with local + central headers", async () => {
    const zip = buildZip([
      { name: "readme.txt", data: "hello cutup" },
      { name: "clips/a.mp4", data: new Uint8Array([0, 1, 2, 3]) },
    ]);
    assert.equal(zip.type, "application/zip");
    const buf = new Uint8Array(await zip.arrayBuffer());
    // PK\x03\x04 local file header
    assert.equal(buf[0], 0x50);
    assert.equal(buf[1], 0x4b);
    assert.equal(buf[2], 0x03);
    assert.equal(buf[3], 0x04);
    assert.ok(buf.length > 40);
  });
});
