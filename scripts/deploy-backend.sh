#!/usr/bin/env bash
#
# Push the database schema and deploy all edge functions to a Supabase project.
# Use this when moving to (or updating) your own Supabase project.
#
# Prerequisites:
#   - Supabase CLI installed            (https://supabase.com/docs/guides/cli)
#   - A personal access token           (https://supabase.com/dashboard/account/tokens)
#   - Your project's reference id        (Project Settings → General → Reference ID)
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx
#   export SUPABASE_PROJECT_REF=abcdefgh...        # the new project ref
#   export SUPABASE_DB_PASSWORD=...                # only needed for `db push`
#   ./scripts/deploy-backend.sh
#
# Optional: set secrets first by copying supabase/functions/.env.example to
# supabase/functions/.env and filling it in — the script will load it if present.

set -euo pipefail

cd "$(dirname "$0")/.."

: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF to your project ref}"
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)}"

echo "▸ Linking to project ${SUPABASE_PROJECT_REF}..."
supabase link --project-ref "${SUPABASE_PROJECT_REF}"

# 1) Set edge-function secrets (if a local secrets file exists)
if [ -f supabase/functions/.env ]; then
  echo "▸ Setting edge-function secrets from supabase/functions/.env..."
  supabase secrets set --env-file supabase/functions/.env
else
  echo "▸ Skipping secrets (no supabase/functions/.env found)."
  echo "  Copy supabase/functions/.env.example → supabase/functions/.env and re-run,"
  echo "  or set them in the dashboard (Project Settings → Edge Functions → Secrets)."
fi

# 2) Apply all SQL migrations
echo "▸ Pushing database migrations..."
supabase db push

# 3) Deploy every edge function under supabase/functions/
echo "▸ Deploying edge functions..."
for dir in supabase/functions/*/; do
  name="$(basename "$dir")"
  # Skip shared/util folders that aren't deployable functions.
  case "$name" in
    _*) continue ;;
  esac
  echo "  - ${name}"
  supabase functions deploy "${name}"
done

echo "✓ Backend deploy complete for ${SUPABASE_PROJECT_REF}"
echo "  Remember to update VITE_SUPABASE_* (in .env and/or Cloudflare/GitHub) to this project."
