#!/usr/bin/env bash
#
# Builds, packages, and deploys code for the oby-bg-search Lambda function.
# The execution role, REST API, and S3 Vectors bucket/index are all created
# by infrastructure/infrastructure.yaml; this script only pushes new code to
# the already-existing function.
#
# Required environment variables:
#   AWS_REGION   e.g. us-east-1
#
# Usage:
#   AWS_REGION=us-east-1 ./deploy.sh
AWS_REGION=eu-south-1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$SCRIPT_DIR"

FUNCTION_NAME="oby-bg-search"
DEPLOY_BUCKET="oby-bg-lambda-zips"
DEPLOY_KEY="oby-bg-search.zip"

: "${AWS_REGION:?Set AWS_REGION (e.g. us-east-1)}"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }

# ---- 1. Verify tooling --------------------------------------------------

log "Checking required tools"
for cmd in aws node npm zip; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required tool: $cmd" >&2; exit 1; }
done

# ---- 2. Install production dependencies ---------------------------------

log "Installing production dependencies"
if [[ -f "$LAMBDA_DIR/package-lock.json" ]]; then
  npm ci --omit=dev --no-audit --no-fund --prefix "$LAMBDA_DIR"
else
  npm install --omit=dev --no-audit --no-fund --prefix "$LAMBDA_DIR"
fi

# ---- 3. Build the deployment package ------------------------------------

log "Building deployment package"
BUILD_DIR="$(mktemp -d)"
ZIP_PATH="$BUILD_DIR/${FUNCTION_NAME}.zip"
trap 'rm -rf "$BUILD_DIR"' EXIT

cp -R "$LAMBDA_DIR/src" "$BUILD_DIR/src"
cp "$LAMBDA_DIR/package.json" "$BUILD_DIR/package.json"
cp -R "$LAMBDA_DIR/node_modules" "$BUILD_DIR/node_modules"

(
  cd "$BUILD_DIR"
  zip -X -r "$ZIP_PATH" src package.json node_modules -x '*.DS_Store' >/dev/null
)
echo "Package built: $ZIP_PATH ($(du -h "$ZIP_PATH" | cut -f1))"

# ---- 4. Upload to S3 ------------------------------------------------------

log "Uploading package to s3://$DEPLOY_BUCKET/$DEPLOY_KEY"
aws s3 cp "$ZIP_PATH" "s3://$DEPLOY_BUCKET/$DEPLOY_KEY" --region "$AWS_REGION"

# ---- 5. Deploy the new code to the Lambda function -------------------------

log "Updating function code for $FUNCTION_NAME"
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --s3-bucket "$DEPLOY_BUCKET" \
  --s3-key "$DEPLOY_KEY" \
  --region "$AWS_REGION" >/dev/null
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$AWS_REGION"

log "Done"
echo "Deployment package: s3://$DEPLOY_BUCKET/$DEPLOY_KEY"