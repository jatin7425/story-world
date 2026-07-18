#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <worker_base_url> [cookie_file]"
  echo "Example: $0 https://story-world.example.workers.dev cookiejar.txt"
  exit 1
fi

URL="$1"
COOKIE_FILE="${2:-cookiejar.txt}"

echo "Posting migration request to $URL/api/admin/images/migrate using cookie file $COOKIE_FILE"
curl --fail --show-error --silent -X POST -b "$COOKIE_FILE" -c "$COOKIE_FILE" "$URL/api/admin/images/migrate" | jq || true

echo "Done. If the response is empty, check that the cookie file contains a valid admin session cookie."
