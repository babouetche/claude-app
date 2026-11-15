import Foundation

/// Points de code SMuFL (police Bravura, licence SIL OFL) et largeurs approximatives en interlignes.
public enum SMuFL {
    public static let brace: UInt32 = 0xE000
    public static let gClef: UInt32 = 0xE050
    public static let gClef8vb: UInt32 = 0xE052
    public static let cClef: UInt32 = 0xE05C
    public static let fClef: UInt32 = 0xE062
    public static func timeSigDigit(_ d: Int) -> UInt32 { 0xE080 + UInt32(d) }

    public static let noteheadDoubleWhole: UInt32 = 0xE0A0
    public static let noteheadWhole: UInt32 = 0xE0A2
    public static let noteheadHalf: UInt32 = 0xE0A3
    public static let noteheadBlack: UInt32 = 0xE0A4
    public static let augmentationDot: UInt32 = 0xE1E7

    public static let flat: UInt32 = 0xE260
    public static let natural: UInt32 = 0xE261
    public static let sharp: UInt32 = 0xE262
    public static let doubleSharp: UInt32 = 0xE263
    public static let doubleFlat: UInt32 = 0xE264

    /// Silences : carrée, ronde, blanche, noire, croche … quintuple croche.
    public static func rest(_ base: DurationBase) -> UInt32 { 0xE4E2 + UInt32(base.rawValue) }

    /// Crochets : croche … quintuple croche (hampe en haut / en bas).
    public static func flag(_ base: DurationBase, up: Bool) -> UInt32 {
        0xE240 + UInt32((base.rawValue - 4) * 2) + (up ? 0 : 1)
    }

    /// Notes « métronome » avec hampe (pour la palette).
    public static func metronomeNote(_ base: DurationBase) -> UInt32 {
        switch base {
        case .breve: return 0xECA0
        case .whole: return 0xECA2
        case .half: return 0xECA3
        default: return 0xECA5 + UInt32((base.rawValue - 3) * 2)
        }
    }

    public static func notehead(_ base: DurationBase) -> UInt32 {
        switch base {
        case .breve: return noteheadDoubleWhole
        case .whole: return noteheadWhole
        case .half: return noteheadHalf
        default: return noteheadBlack
        }
    }

    public static func noteheadWidth(_ base: DurationBase) -> Double {
        switch base {
        case .breve: return 2.5
        case .whole: return 1.69
        default: return 1.18
        }
    }

    public static func accidental(_ alter: Int) -> UInt32 {
        switch alter {
        case -2: return doubleFlat
        case -1: return flat
        case 1: return sharp
        case 2: return doubleSharp
        default: return natural
        }
    }

    public static func accidentalWidth(_ alter: Int) -> Double {
        switch alter {
        case -2: return 1.65
        case -1: return 0.9
        case 1: return 1.0
        case 2: return 1.0
        default: return 0.68
        }
    }

    public static func restWidth(_ base: DurationBase) -> Double {
        switch base {
        case .breve: return 0.6
        case .whole, .half: return 1.13
        case .quarter: return 1.08
        case .eighth: return 0.99
        default: return 1.3
        }
    }

    public static func clef(_ c: Clef) -> UInt32 {
        switch c {
        case .treble: return gClef
        case .treble8vb: return gClef8vb
        case .bass: return fClef
        case .alto, .tenor: return cClef
        }
    }

    // Épaisseurs (en interlignes).
    public static let staffLine = 0.13
    public static let stem = 0.12
    public static let ledger = 0.16
    public static let thinBarline = 0.16
    public static let thickBarline = 0.5
    public static let beam = 0.5
}
