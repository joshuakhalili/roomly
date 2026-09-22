#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
types_file=$(mktemp lib/supabase/.database-types.XXXXXX)
trap 'rm -f "$types_file"' EXIT HUP INT TERM
supabase gen types typescript --local > "$types_file"
if ! test -s "$types_file"; then
  echo 'Supabase returned no types; the existing types were preserved.' >&2
  exit 1
fi
mv "$types_file" lib/supabase/database.types.ts
