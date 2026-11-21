#!/usr/bin/env bash
# Audit de l'environnement macOS pour ScoreConverter (lecture seule, n'installe rien)
v(){ command -v "$1" >/dev/null 2>&1 && "$@" 2>&1 | head -1 || echo "ABSENT"; }
echo "== Système";      sw_vers 2>/dev/null; echo "Arch: $(uname -m)"
echo "== Xcode";        xcode-select -p 2>/dev/null || echo "CLT ABSENT"; v xcodebuild -version; v swift --version
echo "== Homebrew";     v brew --version
echo "== Python";       v python3 --version; python3 -c "import music21;print('music21',music21.__version__)" 2>/dev/null || echo "music21 ABSENT"
echo "== Java";         /usr/libexec/java_home -V 2>&1 | head -5
echo "== Outils";       for t in pdftoppm git cmake make gradle; do printf "%-9s " "$t"; command -v $t || echo ABSENT; done
echo "== Audiveris";    ls -d /Applications/Audiveris*.app 2>/dev/null || echo "ABSENT"
echo "== MuseScore";    for p in "/Applications/MuseScore 4.app/Contents/MacOS/mscore" "$HOME/Applications/MuseScore 4.app/Contents/MacOS/mscore"; do [ -x "$p" ] && { echo "$p"; "$p" --long-version 2>/dev/null | head -1; }; done
mdfind "kMDItemCFBundleIdentifier == 'org.musescore.MuseScore4'" 2>/dev/null | head -3
echo "== Disque libre"; df -h ~ | tail -1
