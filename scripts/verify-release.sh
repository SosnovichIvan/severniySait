#!/usr/bin/env bash
set -euo pipefail
version="${1:?A version is required}"
[[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || exit 2
# Checkout can represent an annotated tag as a local lightweight tag. Fetch the
# authoritative remote object into a separate namespace without replacing it.
git fetch --no-tags origin main
git fetch --no-tags origin "refs/tags/$version:refs/release-tags/$version"
git rev-parse --verify "refs/release-tags/$version^{commit}"
git merge-base --is-ancestor "refs/release-tags/$version^{commit}" origin/main
