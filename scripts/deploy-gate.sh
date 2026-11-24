#!/usr/bin/env bash
# Both completion events call this gate; the last successful one can deploy.
set -euo pipefail
commit=$(git rev-parse HEAD)
main=$(gh api "repos/$REPOSITORY/commits/main" --jq .sha)
if [[ "$commit" != "$main" ]]; then
  echo 'Skipping superseded commit.'
  exit 0
fi
for workflow in ci.yml fork-images.yml; do
  run=$(gh api "repos/$REPOSITORY/actions/workflows/$workflow/runs?head_sha=$commit&branch=main&event=push&per_page=1" \
    --jq '.workflow_runs[0] | [.conclusion // "pending", .id] | @tsv')
  read -r conclusion id <<< "$run"
  if [[ "$conclusion" != success ]]; then
    echo "$workflow has not succeeded for $commit; waiting for its completion event."
    exit 0
  fi
  if [[ "$workflow" == ci.yml ]]; then order=$id; fi
done
[[ "$order" =~ ^[0-9]+$ ]]
printf 'ready=true\ncommit=%s\norder=%s\n' "$commit" "$order" >> "$GITHUB_OUTPUT"
