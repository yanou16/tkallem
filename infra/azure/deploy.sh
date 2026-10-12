#!/usr/bin/env bash
# Creates (or updates) the API on Azure App Service: resource group, Linux B1 plan, Web App for Containers running the
# image built by .github/workflows/api-image.yml, with its settings from infra/azure/api.env. Safe to run again.
#
#   az login
#   APP=tkallem-api-<something-unique> ./infra/azure/deploy.sh
#
# Cost: the B1 plan only (about 13 $/month, taken from the Azure for Students credit). Delete everything with:
#   az group delete -n "$RG"
set -euo pipefail

RG="${RG:-tkallem}"
LOCATION="${LOCATION:-eastus2}"          # next to Neon (AWS us-east-2, Ohio); any US East region is fine
PLAN="${PLAN:-tkallem-plan}"
APP="${APP:?set APP to a globally unique name, e.g. APP=tkallem-api-rayane}"
IMAGE="${IMAGE:-ghcr.io/yanou16/tkallem-api:latest}"
ENV_FILE="${ENV_FILE:-$(dirname "$0")/api.env}"

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE: copy api.env.example and fill it in." >&2; exit 1; }

echo "== Resource group and plan"
az group create -n "$RG" -l "$LOCATION" -o none
az appservice plan show -g "$RG" -n "$PLAN" -o none 2>/dev/null \
  || az appservice plan create -g "$RG" -n "$PLAN" -l "$LOCATION" --is-linux --sku B1 -o none

echo "== Web app (container)"
az webapp show -g "$RG" -n "$APP" -o none 2>/dev/null \
  || az webapp create -g "$RG" -p "$PLAN" -n "$APP" --container-image-name "$IMAGE" -o none

# Private package on GitHub Container Registry: give App Service a token with read:packages.
if [ -n "${GHCR_USER:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  az webapp config container set -g "$RG" -n "$APP" --container-image-name "$IMAGE" \
    --container-registry-url https://ghcr.io --container-registry-user "$GHCR_USER" \
    --container-registry-password "$GHCR_TOKEN" -o none
fi

echo "== Always on, HTTPS only, health check"
az webapp config set -g "$RG" -n "$APP" --always-on true --http20-enabled true --min-tls-version 1.2 \
  --ftps-state Disabled --generic-configurations '{"healthCheckPath": "/health"}' -o none
az webapp update -g "$RG" -n "$APP" --https-only true -o none

echo "== Settings from $ENV_FILE (values are not printed)"
SETTINGS_JSON="$(mktemp)"
trap 'rm -f "$SETTINGS_JSON"' EXIT
python3 - "$ENV_FILE" "$SETTINGS_JSON" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
fixed = {"WEBSITES_PORT": "8000", "FORWARDED_HOPS": "1", "RUN_MIGRATIONS": "1"}  # App Service routing and proxy
items = dict(fixed)
for line in open(src):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        value = value[1:-1]  # KEY='value' or KEY="value", as in a .env file
    if value:  # empty lines in the file keep the API's defaults
        items[key.strip()] = value
json.dump([{"name": k, "value": v, "slotSetting": False} for k, v in items.items()], open(dst, "w"))
print(f"{len(items)} settings")
PY
az webapp config appsettings set -g "$RG" -n "$APP" --settings "@$SETTINGS_JSON" -o none

echo "== Publish profile for GitHub Actions (secret AZURE_WEBAPP_PUBLISH_PROFILE)"
az resource update -g "$RG" --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies \
  --parent "sites/$APP" --name scm --set properties.allow=true -o none
PROFILE="$(dirname "$0")/publish-profile.xml"
az webapp deployment list-publishing-profiles -g "$RG" -n "$APP" --xml > "$PROFILE"
echo "Saved to $PROFILE (git-ignored). Paste it as the repository secret AZURE_WEBAPP_PUBLISH_PROFILE,"
echo "and add the repository variable AZURE_WEBAPP_NAME=$APP. Then delete the file."

az webapp restart -g "$RG" -n "$APP" -o none
echo "== Done: https://$APP.azurewebsites.net/health (first start pulls the image and runs migrations: about 2 minutes)"
