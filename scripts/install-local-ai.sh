#!/usr/bin/env bash
# Run from the project directory on the ARM64 Raspberry Pi. Downloads binaries
# and weights only; inference remains on the isolated Docker data network.
set -euo pipefail
[[ $(uname -m) == aarch64 ]] || { echo 'This installer requires ARM64.' >&2; exit 1; }
release=0.40.7
mkdir -p .local-ai/runtime .local-ai/models
archive="${OLLAMA_ARCHIVE:-.local-ai/ollama-linux-arm64.tar.zst}"
if [[ ! -f "$archive" ]]; then
  curl -fL --retry 3 "https://github.com/ollama/ollama/releases/download/v${release}/ollama-linux-arm64.tar.zst" -o "$archive"
fi
checksum_file=$(mktemp)
trap 'rm -f "$checksum_file"' EXIT
curl -fsSL "https://github.com/ollama/ollama/releases/download/v${release}/sha256sum.txt" -o "$checksum_file"
expected=$(awk '$2 ~ /(^|\/)ollama-linux-arm64.tar.zst$/ {print $1}' "$checksum_file")
[[ -n "$expected" ]] || { echo 'Missing Ollama release checksum.' >&2; exit 1; }
printf '%s  %s\n' "$expected" "$archive" | sha256sum --check
# Retain licences and ARM CPU libraries, without the multi-GB GPU runtimes.
tar --zstd --extract --file "$archive" --directory .local-ai/runtime --exclude='lib/ollama/cuda*' --exclude='lib/ollama/vulkan*' --exclude='lib/ollama/rocm*'
compose=(docker compose --env-file .env.production -f compose.production.yaml -f compose.pi.yaml --profile local-ai)
"${compose[@]}" build ollama
# Only the model-download process has outbound access. No ports are published.
docker run --rm --name fightclub-model-download --user 1000:1000 --env OLLAMA_NO_CLOUD=1 --env OLLAMA_MODELS=/models --env OLLAMA_HOST=127.0.0.1:11434 --env HOME=/tmp --volume "$PWD/.local-ai/runtime:/opt/ollama:ro" --volume "$PWD/.local-ai/models:/models" --entrypoint /bin/sh fightclub-ollama:cpu -ec '/opt/ollama/bin/ollama serve >/tmp/ollama.log 2>&1 & service_pid=$!; trap "kill $service_pid" EXIT; for attempt in $(seq 1 30); do /opt/ollama/bin/ollama list >/dev/null 2>&1 && break; sleep 1; done; /opt/ollama/bin/ollama pull qwen3:0.6b'
"${compose[@]}" up -d --no-deps ollama
