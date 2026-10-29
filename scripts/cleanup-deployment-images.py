#!/usr/bin/env python3
"""Retain container images and the Fight Club rollback; retire old Fight Club tags."""
import json
import subprocess


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True)


containers = docker("ps", "-aq").split()
protected = {
    item["Image"] for item in json.loads(docker("inspect", *containers))
} if containers else set()
# Fail closed: never clean images without a known live app and rollback.
for kind, reference in [("container", "fight-club-app-1"),
                        ("container", "fight-club-worker-1"),
                        ("image", "fightclub:previous-deployment")]:
    item = json.loads(docker("image", "inspect", reference) if kind == "image"
                      else docker("inspect", reference))[0]
    protected.add(item["Id"] if kind == "image" else item["Image"])

image_ids = sorted(set(docker("image", "ls", "-aq", "fightclub").split()))
for image in json.loads(docker("image", "inspect", *image_ids)) if image_ids else []:
    if image["Id"] in protected:
        continue
    for tag in image.get("RepoTags") or []:
        if tag.startswith("fightclub:"):
            # No force: Docker also protects containers created after our snapshot.
            subprocess.run(["docker", "image", "rm", tag], check=True)

# Keep a week of build reuse so daily releases can reuse compiler/package caches.
subprocess.run(["docker", "builder", "prune", "--all", "--force", "--filter", "until=168h"], check=True)
