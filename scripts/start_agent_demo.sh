#!/bin/sh
set -e

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -x ".venv/bin/python" ]; then
  echo "Missing .venv. Create it first with:"
  echo "  python3 -m venv .venv"
  echo "  .venv/bin/python -m pip install -e '.[agent,test]'"
  exit 1
fi

if [ -z "$GEMINI_API_KEY" ]; then
  printf "Paste GEMINI_API_KEY (input hidden): "
  stty -echo
  IFS= read -r GEMINI_API_KEY
  stty echo
  printf "\n"
  export GEMINI_API_KEY
fi

export PYTHONPATH="$ROOT_DIR/src"
exec .venv/bin/python -m uav_benchmark.agent.server
