#!/usr/bin/env bash
#
# Assumes the AWS role configured for a profile in ~/.aws/config and exports
# the resolved credentials into the current shell, so subsequent AWS CLI (and
# other AWS SDK) calls use that role without passing --profile every time.
#
# This must be SOURCED, not executed: a script's exported variables only
# live in its own subshell and disappear once it exits, so running it
# directly (./assume-role.sh) has no effect on your shell.
#
# Usage:
#   source scripts/assume-role.sh <profile-name>
#   . scripts/assume-role.sh <profile-name>

assume_aws_role() {
  local profile="$1"

  if [[ -z "$profile" ]]; then
    echo "Usage: source ${BASH_SOURCE[0]} <profile-name>" >&2
    return 1
  fi

  if ! command -v aws >/dev/null 2>&1; then
    echo "Missing required tool: aws" >&2
    return 1
  fi

  if ! aws configure list-profiles 2>/dev/null | grep -qx "$profile"; then
    echo "Profile '$profile' was not found in ~/.aws/config" >&2
    return 1
  fi

  local creds
  if ! creds="$(aws configure export-credentials --profile "$profile" --format env 2>&1)"; then
    echo "Failed to assume the role for profile '$profile':" >&2
    echo "$creds" >&2
    return 1
  fi
  eval "$creds"
  export AWS_PROFILE="$profile"

  local identity
  if ! identity="$(aws sts get-caller-identity --output text --query '[Account,Arn]' 2>&1)"; then
    echo "Assumed credentials for '$profile' but could not verify them:" >&2
    echo "$identity" >&2
    return 1
  fi

  echo "Assumed role for profile '$profile'"
  echo "Account / ARN: $identity"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This script must be sourced, not executed:" >&2
  echo "  source ${0} <profile-name>" >&2
  exit 1
fi

assume_aws_role "$1"
_assume_aws_role_rc=$?
unset -f assume_aws_role
return $_assume_aws_role_rc