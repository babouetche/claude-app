import AppKit

/// Mises à jour depuis l'app : télécharge la dernière version et la remplace.
/// Le fichier est téléchargé par l'app elle-même (pas par le navigateur) : macOS ne le marque pas
/// « téléchargé depuis Internet », donc pas de blocage Gatekeeper après la mise à jour.
enum Updater {
    static let base = "https://github.com/babouetche/claude-app/releases/download/titi-latest/"
    static var infoURL: URL { URL(string: base + "latest.json")! }
    static var dmgURL: URL { URL(string: base + "Partitions-de-Titi.dmg")! }

    struct Info: Decodable { let build: Int; let version: String; let date: String? }

    static var currentBuild: Int { Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "") ?? 0 }
    static var currentVersion: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?" }

    private static var session: URLSession {
        let c = URLSessionConfiguration.ephemeral
        c.timeoutIntervalForRequest = 20
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: c)
    }

    /// Vérification automatique (au plus une fois par jour, silencieuse si rien de neuf).
    static func checkAutomatically() {
        let key = "lastUpdateCheck"
        let last = UserDefaults.standard.double(forKey: key)
        guard Date().timeIntervalSince1970 - last > 20 * 3600 else { return }
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: key)
        check(userInitiated: false)
    }

    static func check(userInitiated: Bool) {
        session.dataTask(with: infoURL) { data, _, error in
            DispatchQueue.main.async {
                guard let data, let info = try? JSONDecoder().decode(Info.self, from: data) else {
                    LaunchLog.write("mise à jour : vérification impossible \(error.map { "\($0)" } ?? "")")
                    if userInitiated { alert("Impossible de vérifier les mises à jour.", "Vérifiez la connexion Internet, puis réessayez.") }
                    return
                }
                LaunchLog.write("mise à jour : installée \(currentBuild), disponible \(info.build)")
                if info.build > currentBuild {
                    offer(info)
                } else if userInitiated {
                    alert("Partitions de Titi est à jour.", "Vous avez la dernière version (\(currentVersion), n° \(currentBuild)).")
                }
            }
        }.resume()
    }

    static func offer(_ info: Info) {
        let a = NSAlert()
        a.messageText = "Une nouvelle version de Partitions de Titi est disponible."
        a.informativeText = "Version installée : n° \(currentBuild). Nouvelle version : n° \(info.build)\(info.date.map { " (\($0))" } ?? "").\n\nL'app va se fermer, se mettre à jour puis se rouvrir toute seule. Vos partitions sont enregistrées automatiquement."
        a.addButton(withTitle: "Mettre à jour maintenant")
        a.addButton(withTitle: "Plus tard")
        if a.runModal() == .alertFirstButtonReturn { download() }
    }

    static func download() {
        let progress = NSAlert()
        progress.messageText = "Téléchargement de la mise à jour…"
        progress.informativeText = "Cela prend quelques secondes."
        progress.addButton(withTitle: "Annuler")
        let task = session.downloadTask(with: dmgURL) { tmp, _, error in
            if (error as? URLError)?.code == .cancelled { return }
            var saved: URL?
            if let tmp {
                let dest = FileManager.default.temporaryDirectory.appendingPathComponent("Partitions-de-Titi-\(UUID().uuidString).dmg")
                try? FileManager.default.moveItem(at: tmp, to: dest)
                saved = dest
            }
            DispatchQueue.main.async {
                NSApp.abortModal()
                guard let dmg = saved else {
                    alert("Le téléchargement a échoué.", error?.localizedDescription ?? "Réessayez plus tard.")
                    return
                }
                install(dmg)
            }
        }
        task.resume()
        if progress.runModal() == .alertFirstButtonReturn { task.cancel() }
    }

    /// Monte l'image, copie la nouvelle app à la place de l'actuelle après fermeture, puis la relance.
    static func install(_ dmg: URL) {
        let appPath = Bundle.main.bundlePath
        let pid = ProcessInfo.processInfo.processIdentifier
        let script = """
        #!/bin/sh
        DMG="$1"; APP="$2"; PID="$3"
        while kill -0 "$PID" 2>/dev/null; do sleep 0.3; done
        MNT=$(mktemp -d /tmp/titi-maj.XXXXXX)
        hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$MNT" >/dev/null 2>&1 || { open "$DMG"; exit 1; }
        NEW=$(ls -d "$MNT"/*.app | head -n 1)
        if [ -n "$NEW" ] && rm -rf "$APP" && ditto "$NEW" "$APP"; then
          xattr -dr com.apple.quarantine "$APP" 2>/dev/null
          hdiutil detach "$MNT" -quiet
          rm -f "$DMG"
          open "$APP"
        else
          # Repli : on ouvre l'image disque pour glisser l'app à la main.
          open "$MNT"
          osascript -e 'display dialog "La mise à jour automatique n’a pas pu remplacer l’app. Glissez « Partitions de Titi » sur le dossier Applications (et choisissez Remplacer)." buttons {"OK"} default button 1 with title "Partitions de Titi"'
        fi
        """
        let scriptURL = FileManager.default.temporaryDirectory.appendingPathComponent("titi-maj.sh")
        do {
            try script.write(to: scriptURL, atomically: true, encoding: .utf8)
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/bin/sh")
            p.arguments = [scriptURL.path, dmg.path, appPath, String(pid)]
            try p.run()
            LaunchLog.write("mise à jour : installation lancée vers \(appPath)")
            NSApp.terminate(nil)
        } catch {
            alert("La mise à jour n'a pas pu être installée.", error.localizedDescription)
            NSWorkspace.shared.open(dmg)
        }
    }

    static func alert(_ title: String, _ text: String) {
        let a = NSAlert()
        a.messageText = title
        a.informativeText = text
        a.runModal()
    }
}
