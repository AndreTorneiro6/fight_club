import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const revision = "a".repeat(40),
  image = `fightclub:git-${"a".repeat(40)}`;
function run(failure = "", branch = "refs/heads/deploy") {
  const root = mkdtempSync(join(tmpdir(), "fightclub-deployment-"));
  const source = join(root, "checkout");
  mkdirSync(source);
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(root, ".env.production"),
    "UNCHANGED_SECRET=keep-this-private\nFIGHT_CLUB_APP_IMAGE=prior-image\n",
    { mode: 0o600 },
  );
  writeFileSync(join(root, ".deployed-revision"), "previous\n");
  writeFileSync(join(bin, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  writeFileSync(
    join(bin, "git"),
    `#!/usr/bin/env node
if(process.argv.includes('rev-parse')) console.log(process.env.DEPLOY_TEST_REVISION);
if(process.argv.includes('diff') && process.env.DEPLOY_TEST_FAIL==='dirty') process.exit(1);
`,
    { mode: 0o700 },
  );
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2), root=process.env.FIGHT_CLUB_DEPLOY_DIR;
fs.appendFileSync(path.join(root,'calls'),JSON.stringify({args,image:process.env.FIGHT_CLUB_APP_IMAGE})+'\\n');
if(args[0]==='login'){fs.readFileSync(0);process.exit(0);}
if(args[0]==='image'&&args[1]==='inspect'){console.log(process.env.DEPLOY_TEST_FAIL==='revision'?'wrong':process.env.DEPLOY_TEST_REVISION);process.exit(0);}
if(args[0]==='inspect'){
 const format=args.at(-1);
 if(format==='{{.Image}}')console.log('sha256:previous');
 if(format==='{{.State.Health.Status}}')console.log('healthy');
 if(format==='{{.State.Running}}')console.log('true');
 if(format==='{{.RestartCount}}')console.log('0');
 process.exit(0);
}
if(args[0]==='compose'&&process.env.DEPLOY_TEST_FAIL==='up'&&process.env.FIGHT_CLUB_APP_IMAGE!=='fightclub:previous-deployment')process.exit(1);
`,
    { mode: 0o700 },
  );
  const result = spawnSync(
    "bash",
    [resolve("scripts/deploy-production.sh"), source],
    {
      cwd: root,
      input: "test-registry-token",
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        FIGHT_CLUB_DEPLOY_DIR: root,
        GITHUB_REF: branch,
        GITHUB_SHA: revision,
        DEPLOY_TEST_FAIL: failure,
        DEPLOY_TEST_REVISION: revision,
      },
    },
  );
  return {
    root,
    result,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
test("deployment builds the validated checkout, backs up first, preserves settings and updates only app/worker", () => {
  const check = run();
  try {
    assert.equal(check.result.status, 0, check.result.stderr);
    const env = readFileSync(join(check.root, ".env.production"), "utf8");
    assert.ok(env.includes("UNCHANGED_SECRET=keep-this-private"));
    assert.ok(env.includes(`FIGHT_CLUB_APP_IMAGE=${image}`));
    assert.equal(
      readFileSync(join(check.root, ".deployed-revision"), "utf8"),
      revision + "\n",
    );
    const calls = readFileSync(join(check.root, "calls"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const backup = calls.findIndex((call) => call.args[0] === "exec");
    const up = calls.findIndex((call) => call.args[0] === "compose");
    assert.ok(backup >= 0 && up > backup);
    assert.deepEqual(calls[up].args.slice(-5), [
      "up",
      "-d",
      "--no-deps",
      "app",
      "worker",
    ]);
    assert.ok(!check.result.stdout.includes("test-registry-token"));
    assert.ok(!check.result.stdout.includes("keep-this-private"));
  } finally {
    check.cleanup();
  }
});
test("a failed update restores both services, existing settings and deployment markers", () => {
  const check = run("up");
  try {
    assert.equal(check.result.status, 1);
    assert.equal(
      readFileSync(join(check.root, ".env.production"), "utf8"),
      "UNCHANGED_SECRET=keep-this-private\nFIGHT_CLUB_APP_IMAGE=prior-image\n",
    );
    assert.equal(
      readFileSync(join(check.root, ".deployed-revision"), "utf8"),
      "previous\n",
    );
    const calls = readFileSync(join(check.root, "calls"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(
      calls.filter((call) => call.args[0] === "compose").at(-1).image,
      "fightclub:previous-deployment",
    );
  } finally {
    check.cleanup();
  }
});
test("wrong revisions, branches and dirty checkouts are rejected before production is changed", () => {
  for (const [failure, branch] of [
    ["revision", "refs/heads/deploy"],
    ["", "refs/heads/main"],
    ["dirty", "refs/heads/deploy"],
  ]) {
    const check = run(failure, branch);
    try {
      assert.notEqual(check.result.status, 0);
      assert.equal(
        readFileSync(join(check.root, ".deployed-revision"), "utf8"),
        "previous\n",
      );
    } finally {
      check.cleanup();
    }
  }
});
