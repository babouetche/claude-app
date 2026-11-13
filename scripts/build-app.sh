#!/bin/bash
# Construit « Partitions de Titi.app » (universel arm64 + x86_64) puis Partitions-de-Titi.dmg.
# Usage : scripts/build-app.sh            (signature ad hoc, sans compte Apple)
#         SIGN_IDENTITY="Developer ID Application: …" scripts/build-app.sh
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=${VERSION:-0.1.0}
BUILD=${BUILD:-$(git rev-list --count HEAD 2>/dev/null || echo 1)}
APP="build/Partitions de Titi.app"

swift build -c release --arch arm64 --arch x86_64
BIN_DIR=$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)

rm -rf build && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Fonts" "$APP/Contents/Resources/SoundFonts"
cp "$BIN_DIR/PartiMac" "$APP/Contents/MacOS/PartiMac"
sed -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD/" Resources/Info.plist > "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"
cp Resources/Fonts/Bravura.otf Resources/Fonts/OFL.txt "$APP/Contents/Resources/Fonts/"
if [ -f Resources/SoundFonts/GeneralUser-GS.sf2 ]; then
  cp Resources/SoundFonts/* "$APP/Contents/Resources/SoundFonts/"
else
  echo "Attention : pas de SoundFont embarqué, la banque de sons de macOS sera utilisée."
fi
cp LICENSES.md "$APP/Contents/Resources/"

# Icône originale générée par script.
swift scripts/make-icon.swift build/AppIcon.iconset
iconutil -c icns build/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"

# Signature : hardened runtime + entitlements. « - » = ad hoc (aucun compte requis).
IDENTITY=${SIGN_IDENTITY:--}
if [ "$IDENTITY" = "-" ]; then
  codesign --force --deep --options runtime --entitlements Resources/PartiMac.entitlements --sign - "$APP"
else
  codesign --force --deep --options runtime --timestamp --entitlements Resources/PartiMac.entitlements --sign "$IDENTITY" "$APP"
fi
codesign --verify --deep --strict "$APP"
lipo -info "$APP/Contents/MacOS/PartiMac"

# Image disque glisser-déposer.
mkdir -p build/dmg
cp -R "$APP" build/dmg/
ln -s /Applications build/dmg/Applications
cp docs/PREMIER-LANCEMENT.md "build/dmg/Lisez-moi - premier lancement.txt"
hdiutil create -volname "Partitions de Titi" -srcfolder build/dmg -ov -format UDZO build/Partitions-de-Titi.dmg
rm -rf build/dmg
echo "Terminé : build/Partitions-de-Titi.dmg"
