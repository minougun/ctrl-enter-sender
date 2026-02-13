#!/bin/bash
set -euo pipefail

# ── 設定 ──
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$REPO_DIR"
DOCS_DIR="$REPO_DIR/docs"
RELEASES_DIR="$DOCS_DIR/releases"
ADDON_ID="ctrl-enter-sender@minougun"
AMO_ISSUER="user:16109514:760"
AMO_SECRET="078473989b5f1d547c2dd6e49502fb06116c37834b9410d547cd1b98b4032baa"

# ── バージョン取得 ──
VERSION=$(python3 -c "import json; print(json.load(open('$SRC_DIR/manifest.json'))['version'])")
XPI_NAME="ctrl-enter-sender-${VERSION}.xpi"
echo "=== Release v${VERSION} ==="

# ── 署名済みxpiが既にあるかチェック ──
if [ -f "$RELEASES_DIR/$XPI_NAME" ]; then
  echo "ERROR: $RELEASES_DIR/$XPI_NAME は既に存在します。manifest.json の version を上げてください。"
  exit 1
fi

# ── AMO署名 ──
echo ">>> web-ext sign (AMOに提出して署名取得)..."
SIGN_OUT=$(mktemp -d)
web-ext sign \
  --source-dir "$SRC_DIR" \
  --artifacts-dir "$SIGN_OUT" \
  --api-key "$AMO_ISSUER" \
  --api-secret "$AMO_SECRET" \
  --channel unlisted \
  --ignore-files "docs/**" "release.sh" ".git/**" ".gitignore" "README.md" \
  2>&1 | tee /dev/stderr

# ── 署名済みxpiを探す ──
SIGNED_XPI=$(find "$SIGN_OUT" -name "*.xpi" | head -1)
if [ -z "$SIGNED_XPI" ]; then
  echo "ERROR: 署名済みxpiが見つかりません。AMOの出力を確認してください。"
  rm -rf "$SIGN_OUT"
  exit 1
fi
echo ">>> 署名済みxpi: $SIGNED_XPI"

# ── docs/releases/ に配置 ──
mkdir -p "$RELEASES_DIR"
cp "$SIGNED_XPI" "$RELEASES_DIR/$XPI_NAME"
echo ">>> 配置完了: $RELEASES_DIR/$XPI_NAME"

# ── updates.json 更新 ──
python3 -c "
import json

path = '$DOCS_DIR/updates.json'
with open(path) as f:
    data = json.load(f)

updates = data['addons']['$ADDON_ID']['updates']
# 同じバージョンがあれば上書き、なければ追加
existing = [u for u in updates if u['version'] == '$VERSION']
entry = {
    'version': '$VERSION',
    'update_link': 'https://minougun.github.io/ctrl-enter-sender/releases/$XPI_NAME'
}
if existing:
    existing[0].update(entry)
else:
    updates.append(entry)

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')

print('>>> updates.json 更新完了')
"

# ── git commit & push ──
cd "$REPO_DIR"
git add -A
git commit -m "Release v${VERSION}"
git push

echo ""
echo "=== v${VERSION} リリース完了 ==="
echo "  xpi: https://minougun.github.io/ctrl-enter-sender/releases/$XPI_NAME"
echo "  updates.json: https://minougun.github.io/ctrl-enter-sender/updates.json"

# ── 後片付け ──
rm -rf "$SIGN_OUT"
