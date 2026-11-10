#!/usr/bin/env bash
# Deploys the public demo to Vercel from GitHub Actions (no Vercel Git integration needed):
# links or creates the project, sets the demo environment, deploys to production, then
# smoke-tests the public URL. Needs VERCEL_TOKEN and DATABASE_URL; PROJECT_NAME is optional.
set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}" "${DATABASE_URL:?DATABASE_URL is required}"
PROJECT_NAME="${PROJECT_NAME:-smashpoint-demo}"

# Pasted secrets often carry a trailing newline or spaces, and Neon's "Connect" dialog offers
# a `psql '<url>'` snippet: keep just the token / the connection URL.
VERCEL_TOKEN=$(printf '%s' "$VERCEL_TOKEN" | tr -d '[:space:]')
DB_URL=$(grep -oE "postgres(ql)?://[^'\"[:space:]]+" <<<"$DATABASE_URL" | head -n 1 || true)
if [[ -z $DB_URL ]]; then
  echo "::error::DATABASE_URL doesn't contain a postgres:// connection string. Copy the connection string from Neon (Connect → Connection string, pooling on) into the secret."
  exit 1
fi
DATABASE_URL=$DB_URL

# Run the functions next to the database: every page makes several queries, so a function in
# Mumbai talking to a database in Ohio would add seconds. Map the AWS region in the host
# (e.g. Neon's ep-…-pooler.us-east-2.aws.neon.tech) to the nearest Vercel region.
DB_HOST=$(sed -E 's#^[a-z]+://([^@/]*@)?([^/:?]+).*#\2#' <<<"$DATABASE_URL")
case "$DB_HOST" in
  *ap-south-1*) FN_REGION=bom1 ;;
  *us-east-1*) FN_REGION=iad1 ;;
  *us-east-2*) FN_REGION=cle1 ;;
  *us-west-2*) FN_REGION=pdx1 ;;
  *eu-central-1*) FN_REGION=fra1 ;;
  *eu-west-1*) FN_REGION=dub1 ;;
  *eu-west-2*) FN_REGION=lhr1 ;;
  *ap-southeast-1*) FN_REGION=sin1 ;;
  *ap-southeast-2*) FN_REGION=syd1 ;;
  *ap-northeast-1*) FN_REGION=hnd1 ;;
  *sa-east-1*) FN_REGION=gru1 ;;
  *) FN_REGION="" ;;
esac
if [[ -n $FN_REGION ]]; then
  jq --arg r "$FN_REGION" '.regions = [$r]' vercel.json > vercel.json.tmp && mv vercel.json.tmp vercel.json
  echo "▶ Database region detected; functions will run in Vercel region $FN_REGION"
fi

echo "▶ Checking the Vercel token"
vget() { curl -sS -o "$2" -w '%{http_code}' -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com$1" || echo 000; }
err() { jq -c '.error // {}' "$1" 2>/dev/null || true; }
USER_CODE=$(vget /v2/user /tmp/vercel-user.json)
TEAMS_CODE=$(vget /v2/teams /tmp/vercel-teams.json)
TOKEN_CODE=$(vget /v5/user/tokens/current /tmp/vercel-token.json)
if [[ $USER_CODE == 200 ]]; then
  echo "  account: $(jq -r '.user.username // .user.email // "?"' /tmp/vercel-user.json)"
else
  echo "  /v2/user → HTTP $USER_CODE $(err /tmp/vercel-user.json)"
fi
if [[ $TEAMS_CODE == 200 ]]; then
  echo "  teams: $(jq -r '[.teams[]?.slug] | if length == 0 then "(none)" else join(", ") end' /tmp/vercel-teams.json)"
else
  echo "  /v2/teams → HTTP $TEAMS_CODE $(err /tmp/vercel-teams.json)"
fi
if [[ $TOKEN_CODE == 200 ]]; then
  # Token metadata only (type, origin, team scopes, expiry), never the token itself.
  echo "  token: $(jq -c '.token | {type, origin, expiresAt, scopes: [.scopes[]? | {type, teamId}]}' /tmp/vercel-token.json 2>/dev/null || true)"
else
  echo "  /v5/user/tokens/current → HTTP $TOKEN_CODE $(err /tmp/vercel-token.json)"
fi

# Deploy into: an explicit VERCEL_SCOPE (team slug or id), else the account's default team,
# else the team the token is limited to, else the first team it can list.
TEAM="${VERCEL_SCOPE:-}"
if [[ -z $TEAM && $USER_CODE == 200 ]]; then TEAM=$(jq -r '.user.defaultTeamId // empty' /tmp/vercel-user.json); fi
if [[ -z $TEAM && $TOKEN_CODE == 200 ]]; then TEAM=$(jq -r '[.token.scopes[]? | select(.type == "team") | .teamId][0] // empty' /tmp/vercel-token.json); fi
if [[ -z $TEAM && $TEAMS_CODE == 200 ]]; then TEAM=$(jq -r '.teams[0].id // empty' /tmp/vercel-teams.json); fi

if [[ $USER_CODE != 200 && -z $TEAM ]]; then
  reason=$(jq -r '.error.message // empty' /tmp/vercel-user.json 2>/dev/null || true)
  echo "::error::Vercel won't identify VERCEL_TOKEN${reason:+ ($reason)}, so it isn't a usable account token. Create one at https://vercel.com/account/settings/tokens (Scope: your Hobby team; Expiration: 30 or 90 days), copy it right away, and use it to update the VERCEL_TOKEN repository secret."
  exit 1
fi

SCOPE=""
if [[ -n $TEAM ]]; then
  SCOPE=$TEAM
  if [[ $TEAM == team_* ]]; then
    # The CLI's --scope wants the team slug: from the team list if we have it, else look it up.
    SLUG=""
    if [[ $TEAMS_CODE == 200 ]]; then SLUG=$(jq -r --arg id "$TEAM" '[.teams[]? | select(.id == $id) | .slug][0] // empty' /tmp/vercel-teams.json 2>/dev/null || true); fi
    if [[ -z $SLUG ]]; then
      code=$(vget "/v2/teams/$TEAM" /tmp/vercel-team.json)
      if [[ $code == 200 ]]; then SLUG=$(jq -r '.slug // empty' /tmp/vercel-team.json 2>/dev/null || true); else echo "  /v2/teams/$TEAM → HTTP $code $(err /tmp/vercel-team.json)"; fi
    fi
    SCOPE=${SLUG:-$TEAM}
  fi
fi
V=(vercel --token "$VERCEL_TOKEN")
if [[ -n $SCOPE ]]; then
  V+=(--scope "$SCOPE")
  echo "  deploying into team: $SCOPE"
fi

echo "▶ Linking Vercel project '$PROJECT_NAME'"
if ! "${V[@]}" link --yes --project "$PROJECT_NAME" >/dev/null; then
  echo "  Not found; creating it"
  "${V[@]}" project add "$PROJECT_NAME"
  "${V[@]}" link --yes --project "$PROJECT_NAME" >/dev/null
fi
ORG_ID=$(jq -r .orgId .vercel/project.json)
PROJECT_ID=$(jq -r .projectId .vercel/project.json)
TEAM_QS=""
if [[ $ORG_ID == team_* ]]; then TEAM_QS="teamId=$ORG_ID"; fi

api() {
  local method=$1 path=$2 body=${3:-}
  local url="https://api.vercel.com$path"
  if [[ -n $TEAM_QS ]]; then
    if [[ $url == *\?* ]]; then url+="&$TEAM_QS"; else url+="?$TEAM_QS"; fi
  fi
  local args=(-sS --fail-with-body -X "$method" -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json")
  if [[ -n $body ]]; then args+=(--data "$body"); fi
  curl "${args[@]}" "$url"
}

# `vercel link` writes a short-lived OIDC token to .env.local; it must not be uploaded.
rm -f .env.local

echo "▶ Configuring environment variables"
ENV_JSON=$(api GET "/v9/projects/$PROJECT_ID/env?decrypt=true")
set_env() {
  api POST "/v10/projects/$PROJECT_ID/env?upsert=true" \
    "$(jq -nc --arg k "$1" --arg v "$2" '[{key: $k, value: $v, type: "encrypted", target: ["production", "preview"]}]')" >/dev/null
  echo "  set $1"
}
# A secret is kept only if Production can read it and it's long enough (the app refuses to
# start with a short or placeholder AUTH_SECRET). Anything else is replaced.
usable_secret() {
  jq -e --arg k "$1" --argjson n "$2" '[.envs[]? | select(.key == $k and ((.target // []) | index("production")) and ((.value // "") | length >= $n) and ((.value // "") | test("^change-me") | not))] | length > 0' <<<"$ENV_JSON" >/dev/null
}
remove_env() {
  for id in $(jq -r --arg k "$1" '.envs[]? | select(.key == $k) | .id' <<<"$ENV_JSON"); do
    api DELETE "/v9/projects/$PROJECT_ID/env/$id" >/dev/null
  done
}
ensure_secret() { # key min-length generator...
  local key=$1 min=$2; shift 2
  if usable_secret "$key" "$min"; then
    echo "  kept $key"
  else
    remove_env "$key"
    set_env "$key" "$("$@")"
  fi
}

set_env DATABASE_URL "$DATABASE_URL"
set_env SEED_DEMO_DATA true
# Generated once and then kept, so redeploys don't sign everyone out.
ensure_secret AUTH_SECRET 32 openssl rand -base64 32
ensure_secret CRON_SECRET 16 openssl rand -hex 24

# Razorpay TEST keys (optional repository secrets). Without them the demo runs with online
# payment switched off; live keys are refused so the public demo can never take real money.
if [[ -n ${RAZORPAY_KEY_ID:-} && -n ${RAZORPAY_KEY_SECRET:-} ]]; then
  if [[ $RAZORPAY_KEY_ID != rzp_test_* ]]; then
    echo "::error::RAZORPAY_KEY_ID for the demo must be a TEST key (rzp_test_…)."
    exit 1
  fi
  set_env RAZORPAY_KEY_ID "$RAZORPAY_KEY_ID"
  set_env RAZORPAY_KEY_SECRET "$RAZORPAY_KEY_SECRET"
  if [[ -n ${RAZORPAY_WEBHOOK_SECRET:-} ]]; then set_env RAZORPAY_WEBHOOK_SECRET "$RAZORPAY_WEBHOOK_SECRET"; fi
  echo "  Razorpay test mode enabled"
else
  for key in RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET; do
    if jq -e --arg k "$key" 'any(.envs[]?; .key == $k)' <<<"$ENV_JSON" >/dev/null; then remove_env "$key"; fi
  done
  echo "  No Razorpay test keys: online booking is switched off on the demo"
fi

# Settings that don't belong in the demo, and variables of the earlier academy app: a localhost
# NEXT_PUBLIC_SITE_URL ends up in links and metadata (without it the app uses the Vercel
# production URL), and ADMIN_* with a placeholder password fails later builds.
for key in NEXT_PUBLIC_SITE_URL ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME DEMO_MODE PAYMENT_PROVIDER SMS_PROVIDER_API_KEY WHATSAPP_PROVIDER_API_KEY; do
  if jq -e --arg k "$key" 'any(.envs[]?; .key == $k)' <<<"$ENV_JSON" >/dev/null; then
    remove_env "$key"
    echo "  removed $key (not used by the demo)"
  fi
done

echo "▶ Deploying (built on Vercel; the build applies migrations and loads the demo data on first deploy)"
DEPLOY_URL=$("${V[@]}" deploy --prod --yes)
echo "  deployment: $DEPLOY_URL"

echo "▶ Finding the public domain"
DOMAIN=$(api GET "/v9/projects/$PROJECT_ID/domains" | jq -r '[.domains[]?.name] | sort_by(length) | first // empty')
if [[ -z $DOMAIN ]]; then DOMAIN=$(api GET "/v9/projects/$PROJECT_ID" | jq -r '.targets.production.alias[0] // empty'); fi
if [[ -z $DOMAIN ]]; then echo "Could not determine the production domain"; exit 1; fi
SITE="https://$DOMAIN"

echo "▶ Smoke-testing $SITE"
for i in $(seq 1 30); do
  if curl -fsS --max-time 20 "$SITE/api/health" 2>/dev/null | jq -e '.ok == true' >/dev/null 2>&1; then
    echo "  /api/health → ok"
    break
  fi
  if [[ $i == 30 ]]; then
    echo "Health check failed at $SITE/api/health. Last response:"
    curl -sS -D - --max-time 30 "$SITE/api/health" 2>&1 | head -c 2000 || true
    echo
    exit 1
  fi
  sleep 5
done
for path in / /admin/login /privacy /terms /cancellation-policy; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$SITE$path")
  echo "  $path → $code"
  if [[ $code != 200 ]]; then curl -sS --max-time 30 "$SITE$path" 2>&1 | head -c 1500 || true; echo; exit 1; fi
done

echo "✅ Live: $SITE"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  {
    echo "## On The Sol Sports Academy demo is live"
    echo
    echo "**$SITE**"
    echo
    echo "Admin: $SITE/admin/login — admin@example.com / \`onthesol@123\` (demo data only)."
  } >> "$GITHUB_STEP_SUMMARY"
fi
if [[ -n ${GITHUB_OUTPUT:-} ]]; then echo "url=$SITE" >> "$GITHUB_OUTPUT"; fi
echo "::notice title=Demo is live::$SITE"
