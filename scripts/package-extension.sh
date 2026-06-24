#!/usr/bin/env bash
# Gera o ZIP da extensão para upload na Chrome Web Store.
# Uso: ./scripts/package-extension.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT_DIR/manifest.json"
DIST_DIR="$ROOT_DIR/dist"
BUILD_DIR="$DIST_DIR/build"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Erro: manifest.json não encontrado em $ROOT_DIR" >&2
  exit 1
fi

VERSION=$(grep -E '"version"' "$MANIFEST" | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
ZIP_NAME="youtube-check-v${VERSION}.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

echo "→ Empacotando YouTube Check v${VERSION}..."

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cp "$MANIFEST" "$BUILD_DIR/"
cp -R "$ROOT_DIR/icons" "$BUILD_DIR/"
cp -R "$ROOT_DIR/src" "$BUILD_DIR/"
cp -R "$ROOT_DIR/_locales" "$BUILD_DIR/"

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

(cd "$BUILD_DIR" && zip -r -q "$ZIP_PATH" .)

rm -rf "$BUILD_DIR"

echo "✓ Criado: dist/$ZIP_NAME"
echo ""
echo "Conteúdo do pacote:"
unzip -l "$ZIP_PATH" | grep -E '\.(js|json|html|css|png)$' | head -20
FILE_COUNT=$(unzip -l "$ZIP_PATH" | tail -1 | awk '{print $2}')
echo "... ($FILE_COUNT arquivos no total)"
echo ""
echo "Próximo passo: faça upload em https://chrome.google.com/webstore/devconsole"
