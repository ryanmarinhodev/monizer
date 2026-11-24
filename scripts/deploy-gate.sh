#!/usr/bin/env bash
# Wait without rebuilding; only successful push runs for this SHA qualify.
set -euo pipefail
commit=$(git rev-parse HEAD)
attempts=1
if [[ "${1:-}" == --wait ]]; then attempts=180; fi
for ((attempt=0; attempt<attempts; attempt++)); do
  main=$(gh api "repos/$REPOSITORY/commits/main" --jq .sha)
  if [[ "$commit" != "$main" ]]; then
    echo 'Skipping superseded commit.'
    exit 0
  fi
  ready=true
  for workflow in ci.yml fork-images.yml; do
    run=$(gh api "repos/$REPOSITORY/actions/workflows/$workflow/runs?head_sha=$commit&branch=main&event=push&per_page=1" \
      --jq '.workflow_runs[0] | [.conclusion // "pending", .id] | @tsv')
    read -r conclusion id <<< "$run"
    case "$conclusion" in
      success) ;;
      pending) ready=false ;;
      *) echo "ERROR: $workflow concluded $conclusion for $commit" >&2; exit 1 ;;
    esac
    if [[ "$workflow" == ci.yml ]]; then order=$id; fi
  done
  if [[ "$ready" == true ]]; then
    [[ "$order" =~ ^[0-9]+$ ]]
    printf 'ready=true\ncommit=%s\norder=%s\n' "$commit" "$order" >> "$GITHUB_OUTPUT"
    exit 0
  fi
  if (( attempts == 1 )); then exit 0; fi
  echo "Waiting for CI and images ($((attempt + 1))/$attempts)."
  sleep 30
done
echo 'ERROR: Timed out waiting for CI and images' >&2
exit 1
