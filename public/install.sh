#!/bin/bash
#
# Meloday desktop installer (macOS).
#   curl -fsSL https://melo.day/install.sh | bash
#
# Downloads the latest signed-by-you-or-not .dmg from GitHub Releases, copies
# Meloday.app into /Applications, and clears the quarantine flag so the app
# opens without a Gatekeeper prompt (you running this script == you trust it).
#
set -euo pipefail

REPO="kanda-mashiro/meloday"
APP="Meloday"

if [ "$(uname)" != "Darwin" ]; then
  echo "Meloday 桌面版目前仅支持 macOS。" >&2
  exit 1
fi

echo "→ 获取最新版本…"
DMG_URL="$(
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep -o '"browser_download_url":[[:space:]]*"[^"]*\.dmg"' \
    | head -n1 \
    | sed 's/.*"\(https[^"]*\)"/\1/'
)"

if [ -z "${DMG_URL:-}" ]; then
  echo "未找到安装包(最新 Release 里没有 .dmg)。" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ 下载中…"
curl -fsSL "$DMG_URL" -o "$TMP/meloday.dmg"

echo "→ 安装到 /Applications…"
MOUNT="$(hdiutil attach "$TMP/meloday.dmg" -nobrowse -readonly | tail -n1 | cut -f3)"
rm -rf "/Applications/${APP}.app"
cp -R "${MOUNT}/${APP}.app" "/Applications/"
hdiutil detach "$MOUNT" -quiet >/dev/null

# Unsigned build: clear quarantine so it launches without the "unidentified
# developer" prompt.
xattr -dr com.apple.quarantine "/Applications/${APP}.app" 2>/dev/null || true

echo "✓ 已安装 Meloday,正在打开…"
open "/Applications/${APP}.app"
