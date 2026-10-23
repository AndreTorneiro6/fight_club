import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateCartoon } from "../lib/cartoon-photo";

test("Python cartoon uses photo pixels, strips metadata and rejects invalid files", async () => {
  const fixture = spawnSync("python3", [
    "-c",
    `
from PIL import Image
import sys
im=Image.new('RGB',(32,32),'red')
im.save(sys.stdout.buffer,format='PNG')
`,
  ]);
  assert.equal(fixture.status, 0, "Python and Pillow must be installed");
  const first = generateCartoon("red", fixture.stdout);
  assert.equal(
    generateCartoon("red", fixture.stdout),
    first,
    "same photo work is coalesced",
  );
  const output = await first;
  const inspect = spawnSync(
    "python3",
    [
      "-c",
      `
from PIL import Image
import sys
im=Image.open(sys.stdin.buffer)
assert im.size == (512,512)
assert im.getpixel((256,256))[0] > 200
assert im.getpixel((256,256))[1] < 30
assert not im.getexif()
`,
    ],
    { input: output },
  );
  assert.equal(inspect.status, 0, inspect.stderr.toString());
  await assert.rejects(generateCartoon("broken", Buffer.from("not an image")));
});
