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

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

if [ -z "$DEEPSEEK_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
  echo "No LLM API key is configured."
  echo "Choose the provider for this local session:"
  echo "  1) Gemini"
  echo "  2) DeepSeek"
  printf "Provider [1]: "
  IFS= read -r PROVIDER_CHOICE
  case "$PROVIDER_CHOICE" in
    2|deepseek|DeepSeek)
      KEY_NAME="DEEPSEEK_API_KEY"
      UAV_LLM_PROVIDER="deepseek"
      ;;
    *)
      KEY_NAME="GEMINI_API_KEY"
      UAV_LLM_PROVIDER="gemini"
      ;;
  esac

  printf "Paste %s (input hidden): " "$KEY_NAME"
  if test -t 0; then
    stty -echo
    trap 'stty echo 2>/dev/null || true; printf "\n"' 0 1 2 15
  fi
  IFS= read -r INPUT_KEY
  if test -t 0; then
    stty echo
    trap - 0 1 2 15
    printf "\n"
  fi
  if [ -z "$INPUT_KEY" ]; then
    echo "API key cannot be empty."
    exit 1
  fi
  if [ "$KEY_NAME" = "DEEPSEEK_API_KEY" ]; then
    DEEPSEEK_API_KEY="$INPUT_KEY"
    export DEEPSEEK_API_KEY
  else
    GEMINI_API_KEY="$INPUT_KEY"
    export GEMINI_API_KEY
  fi
  export UAV_LLM_PROVIDER
fi

export PYTHONPATH="$ROOT_DIR/src"
exec .venv/bin/python -m uav_benchmark.agent.server
