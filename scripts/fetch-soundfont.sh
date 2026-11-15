#!/bin/bash
# Télécharge la banque de sons GeneralUser GS (licence libre, voir LICENSES.md).
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=Resources/SoundFonts/GeneralUser-GS.sf2
EXPECTED=9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe
mkdir -p Resources/SoundFonts
if [ ! -f "$DEST" ]; then
  curl -fL --retry 4 -o "$DEST" https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/GeneralUser-GS.sf2
  curl -fL --retry 4 -o Resources/SoundFonts/LICENSE-GeneralUser-GS.txt https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/documentation/LICENSE.txt || true
fi
ACTUAL=$(shasum -a 256 "$DEST" | cut -d' ' -f1)
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "Attention : empreinte SoundFont différente ($ACTUAL), nouvelle version en amont ?"
fi
head -c 4 "$DEST" | grep -q RIFF || { echo "SoundFont invalide"; exit 1; }
echo "SoundFont prêt : $(du -h "$DEST" | cut -f1)"
