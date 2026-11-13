#!/bin/bash
# Notarisation Apple (uniquement avec un compte Apple Developer payant). Voir docs/SIGNATURE.md.
# Prérequis : xcrun notarytool store-credentials partimac --apple-id … --team-id … --password <mot de passe d'app>
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SIGN_IDENTITY:?Définir SIGN_IDENTITY (Developer ID Application: …)}"
SIGN_IDENTITY="$SIGN_IDENTITY" scripts/build-app.sh
codesign --force --timestamp --sign "$SIGN_IDENTITY" build/PartiMac.dmg
xcrun notarytool submit build/PartiMac.dmg --keychain-profile "${NOTARY_PROFILE:-partimac}" --wait
xcrun stapler staple build/PartiMac.dmg
spctl --assess --type open --context context:primary-signature -v build/PartiMac.dmg
