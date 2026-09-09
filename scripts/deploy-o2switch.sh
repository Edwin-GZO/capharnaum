#!/usr/bin/env bash
set -euo pipefail

readonly APPLICATION_DIR="/home2/gavu5696/capharnaum-app"
readonly NODE_ENVIRONMENT="/home2/gavu5696/nodevenv/capharnaum-app/22/bin/activate"
readonly DEPLOY_MARKER="$APPLICATION_DIR/.deployed-commit"
readonly CHECKS_URL="https://api.github.com/repos/Edwin-GZO/capharnaum/commits"

cd "$APPLICATION_DIR"
git fetch --quiet origin main

target_commit="$(git rev-parse origin/main)"
deployed_commit="$(cat "$DEPLOY_MARKER" 2>/dev/null || true)"

if [[ "$target_commit" == "$deployed_commit" ]]; then
  exit 0
fi

# GitHub peut avoir besoin de quelques secondes pour créer le contrôle après un push.
check_conclusion="$({
  curl --fail --silent --show-error \
    --header "Accept: application/vnd.github+json" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    "$CHECKS_URL/$target_commit/check-runs"
} | python3 -c '
import json
import sys

runs = [
    run for run in json.load(sys.stdin).get("check_runs", [])
    if run.get("name") == "test"
]
print(runs[0].get("conclusion", "") if runs else "")
')"

if [[ "$check_conclusion" != "success" ]]; then
  printf 'Déploiement différé : la vérification GitHub de %s vaut « %s ».\n' \
    "$target_commit" "${check_conclusion:-absente}"
  exit 0
fi

git merge --ff-only "$target_commit"
source "$NODE_ENVIRONMENT"
npm ci --omit=dev --no-audit --no-fund

printf '%s\n' "$target_commit" > "$DEPLOY_MARKER"
mkdir -p "$APPLICATION_DIR/tmp"
touch "$APPLICATION_DIR/tmp/restart.txt"
printf 'Capharnaüm déployé : %s à %s\n' "$target_commit" "$(date --iso-8601=seconds)"
