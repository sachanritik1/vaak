#!/usr/bin/env bash
# Ad-hoc sign a macOS .app bundle (CI builds without a Developer ID certificate).
set -euo pipefail

APP="${1:?Usage: sign-mac-adhoc.sh /path/to/Vaak.app}"

if [ ! -d "$APP" ]; then
  echo "App bundle not found: $APP" >&2
  exit 1
fi

echo "Ad-hoc signing: $APP"
xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
echo "Signature OK: $APP"
