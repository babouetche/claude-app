import Foundation

/// Journal de démarrage : ~/Library/Logs/Partitions de Titi.log (aide au diagnostic si l'app ne s'ouvre pas).
enum LaunchLog {
    static let url = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Logs/Partitions de Titi.log")

    static func write(_ message: String) {
        let line = "\(ISO8601DateFormatter().string(from: Date())) \(message)\n"
        guard let data = line.data(using: .utf8) else { return }
        if let h = try? FileHandle(forWritingTo: url) {
            h.seekToEndOfFile(); h.write(data); try? h.close()
        } else {
            try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? data.write(to: url)
        }
    }

    static func start() {
        // On repart d'un journal neuf s'il devient gros.
        if let size = (try? FileManager.default.attributesOfItem(atPath: url.path))?[.size] as? Int, size > 200_000 {
            try? FileManager.default.removeItem(at: url)
        }
        let info = ProcessInfo.processInfo
        write("— Démarrage — macOS \(info.operatingSystemVersionString), app \(Bundle.main.bundlePath)")
        NSSetUncaughtExceptionHandler { e in
            LaunchLog.write("EXCEPTION \(e.name.rawValue) : \(e.reason ?? "") \(e.callStackSymbols.prefix(15).joined(separator: " | "))")
        }
    }
}
