import Foundation

public enum DocumentError: LocalizedError {
    case unreadable, tooNew(Int)
    public var errorDescription: String? {
        switch self {
        case .unreadable:
            return "Ce fichier n'est pas une partition PartiMac valide, ou il est endommagé."
        case .tooNew(let v):
            return "Cette partition a été créée avec une version plus récente de PartiMac (format \(v)). Mettez PartiMac à jour pour l'ouvrir."
        }
    }
}

/// Format natif .partimac : JSON lisible et versionné.
public enum ScoreCodec {
    public static let currentVersion = 1

    public static func encode(_ score: Score) throws -> Data {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try enc.encode(score)
    }

    public static func decode(_ data: Data) throws -> Score {
        struct Header: Decodable { var formatVersion: Int }
        guard let header = try? JSONDecoder().decode(Header.self, from: data) else { throw DocumentError.unreadable }
        guard header.formatVersion <= currentVersion else { throw DocumentError.tooNew(header.formatVersion) }
        do {
            let score = try JSONDecoder().decode(Score.self, from: data)
            guard !score.measures.isEmpty, score.staffRefs.allSatisfy({ score[$0].measures.count == score.measures.count }) else {
                throw DocumentError.unreadable
            }
            return score
        } catch {
            throw DocumentError.unreadable
        }
    }
}
