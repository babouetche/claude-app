# Signature et notarisation

## Par défaut : sans compte Apple (choix retenu)
`scripts/build-app.sh` signe l'app **ad hoc** (`codesign --sign -`) avec le *hardened runtime* et
`Resources/PartiMac.entitlements`. L'app tourne sur tout Mac (Apple Silicon et Intel, macOS 13+).
Au premier lancement d'une copie téléchargée, macOS demande une autorisation unique :
voir `docs/PREMIER-LANCEMENT.md` (copié dans le .dmg).

## Plus tard, si un compte Apple Developer (99 €/an) est pris
1. Dans Xcode > Réglages > Comptes, créer un certificat **Developer ID Application**.
2. Enregistrer les identifiants de notarisation (une fois) :
   `xcrun notarytool store-credentials partimac --apple-id <e-mail> --team-id <ÉQUIPE> --password <mot de passe d'app>`
3. Lancer : `SIGN_IDENTITY="Developer ID Application: Nom (ÉQUIPE)" scripts/notarize.sh`
   → construit, signe avec horodatage, envoie à Apple, agrafe le ticket et vérifie avec `spctl`.
Le .dmg obtenu s'ouvre alors d'un double-clic, sans aucun avertissement.
