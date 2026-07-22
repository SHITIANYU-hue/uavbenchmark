#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"
echo "JD 变量树审阅页：http://127.0.0.1:8766/JD业务变量树_version2.html"
exec python3 -m http.server 8766 --bind 127.0.0.1
