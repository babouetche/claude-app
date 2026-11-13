import Foundation

/// Note jouée (temps en ticks).
public struct PlayedNote: Hashable {
    public var start: Int
    public var end: Int
    public var key: Int
    public var velocity: Int
}

public enum MIDIError: LocalizedError {
    case notMIDI, truncated, noNotes
    public var errorDescription: String? {
        switch self {
        case .notMIDI: return "Ce fichier n'est pas un fichier MIDI standard (.mid)."
        case .truncated: return "Le fichier MIDI est incomplet ou endommagé."
        case .noNotes: return "Ce fichier MIDI ne contient aucune note."
        }
    }
}

// MARK: - Export

public enum MIDIExporter {
    public static let ticksPerQuarter = 480

    static func ticks(_ f: Fraction) -> Int { Int((f.doubleValue * Double(ticksPerQuarter * 4)).rounded()) }

    /// Canal MIDI d'une partie (le canal 10 est réservé aux percussions).
    public static func channel(forPart p: Int) -> Int { let c = p % 15; return c >= 9 ? c + 1 : c }

    /// Notes jouées d'une portée (liaisons de prolongation fusionnées).
    public static func playedNotes(_ score: Score, staff ref: StaffRef) -> [PlayedNote] {
        var out: [PlayedNote] = []
        var pending: [Int: PlayedNote] = [:]   // notes liées en attente, par touche
        var measureStart = Fraction.zero
        for m in 0..<score.measureCount {
            let ml = score.measureLength(m)
            for (s, e) in score.timedEvents(ref, measure: m) {
                let start = ticks(measureStart + s)
                let end = ticks(measureStart + s + e.length(measureLength: ml))
                let keys = Set(e.notes.map(\.pitch.midi))
                for (k, p) in pending where !keys.contains(k) { out.append(p); pending[k] = nil }
                for n in e.notes {
                    let k = n.pitch.midi
                    var pn = pending[k] ?? PlayedNote(start: start, end: end, key: k, velocity: n.velocity)
                    pn.end = end
                    if n.tie { pending[k] = pn } else { out.append(pn); pending[k] = nil }
                }
            }
            measureStart += ml
        }
        out += pending.values
        return out.sorted { ($0.start, $0.key) < ($1.start, $1.key) }
    }

    public static func data(for score: Score) -> Data {
        var tracks: [[UInt8]] = []

        // Piste 0 : titre, tempo, métriques, armures.
        var conductor: [(Int, [UInt8])] = []
        if !score.metadata.title.isEmpty { conductor.append((0, meta(0x03, Array(score.metadata.title.utf8)))) }
        var t = Fraction.zero
        var lastTime: TimeSignature?
        var lastKey: KeySignature?
        for (i, info) in score.measures.enumerated() {
            let tick = ticks(t)
            if let bpm = info.tempo ?? (i == 0 ? 100.0 : nil) {
                let us = Int(60_000_000 / bpm)
                conductor.append((tick, meta(0x51, [UInt8((us >> 16) & 0xFF), UInt8((us >> 8) & 0xFF), UInt8(us & 0xFF)])))
            }
            if info.time != lastTime {
                let dd = UInt8(Int(log2(Double(info.time.beatType))))
                conductor.append((tick, meta(0x58, [UInt8(info.time.beats), dd, 24, 8])))
                lastTime = info.time
            }
            if info.key != lastKey {
                conductor.append((tick, meta(0x59, [UInt8(bitPattern: Int8(info.key.fifths)), 0])))
                lastKey = info.key
            }
            t += info.time.measureLength
        }
        tracks.append(encodeTrack(conductor))

        // Une piste par portée.
        for ref in score.staffRefs {
            let part = score.parts[ref.part]
            let ch = UInt8(channel(forPart: ref.part))
            var evs: [(Int, [UInt8])] = []
            let name = part.staves.count > 1 ? "\(part.name) \(ref.staff + 1)" : part.name
            evs.append((0, meta(0x03, Array(name.utf8))))
            evs.append((0, [0xC0 | ch, UInt8(max(0, min(127, part.program)))]))
            evs.append((0, [0xB0 | ch, 7, UInt8(max(0, min(127, Int(part.volume * 127))))]))
            evs.append((0, [0xB0 | ch, 10, UInt8(max(0, min(127, Int((part.pan + 1) * 63.5))))]))
            var noteEvents: [(Int, Int, [UInt8])] = []   // (tick, ordre : off avant on, octets)
            for n in playedNotes(score, staff: ref) {
                noteEvents.append((n.start, 1, [0x90 | ch, UInt8(n.key & 0x7F), UInt8(max(1, min(127, n.velocity)))]))
                noteEvents.append((n.end, 0, [0x80 | ch, UInt8(n.key & 0x7F), 0]))
            }
            noteEvents.sort { ($0.0, $0.1) < ($1.0, $1.1) }
            evs += noteEvents.map { ($0.0, $0.2) }
            tracks.append(encodeTrack(evs))
        }

        var out: [UInt8] = Array("MThd".utf8) + be32(6) + be16(1) + be16(tracks.count) + be16(ticksPerQuarter)
        for tr in tracks { out += Array("MTrk".utf8) + be32(tr.count) + tr }
        return Data(out)
    }

    static func meta(_ type: UInt8, _ bytes: [UInt8]) -> [UInt8] { [0xFF, type] + vlq(bytes.count) + bytes }

    static func encodeTrack(_ events: [(Int, [UInt8])]) -> [UInt8] {
        var out: [UInt8] = []
        var last = 0
        // Tri stable : l'ordre d'insertion est conservé à tick égal.
        let ordered = events.enumerated().sorted { ($0.element.0, $0.offset) < ($1.element.0, $1.offset) }.map { $0.element }
        for (tick, bytes) in ordered {
            out += vlq(tick - last) + bytes
            last = tick
        }
        out += vlq(0) + [0xFF, 0x2F, 0x00]
        return out
    }

    static func vlq(_ value: Int) -> [UInt8] {
        var v = max(0, value)
        var bytes = [UInt8(v & 0x7F)]
        v >>= 7
        while v > 0 { bytes.insert(UInt8((v & 0x7F) | 0x80), at: 0); v >>= 7 }
        return bytes
    }

    static func be32(_ v: Int) -> [UInt8] { [UInt8((v >> 24) & 0xFF), UInt8((v >> 16) & 0xFF), UInt8((v >> 8) & 0xFF), UInt8(v & 0xFF)] }
    static func be16(_ v: Int) -> [UInt8] { [UInt8((v >> 8) & 0xFF), UInt8(v & 0xFF)] }
}

// MARK: - Lecture d'un fichier MIDI

public struct MIDIFileContents {
    public struct Track {
        public var name: String = ""
        public var notes: [(note: PlayedNote, channel: Int)] = []
        public var program: Int?
    }
    public var division: Int
    public var tracks: [Track]
    public var tempoBPM: Double?
    public var timeSignature: TimeSignature?
    public var keyFifths: Int?
    public var title: String?
}

public enum MIDIReader {
    public static func read(_ data: Data) throws -> MIDIFileContents {
        let b = [UInt8](data)
        var i = 0
        func need(_ n: Int) throws { if i + n > b.count { throw MIDIError.truncated } }
        func u32() throws -> Int { try need(4); defer { i += 4 }; return Int(b[i]) << 24 | Int(b[i+1]) << 16 | Int(b[i+2]) << 8 | Int(b[i+3]) }
        func u16() throws -> Int { try need(2); defer { i += 2 }; return Int(b[i]) << 8 | Int(b[i+1]) }
        func tag() throws -> String { try need(4); defer { i += 4 }; return String(bytes: b[i..<i+4], encoding: .ascii) ?? "" }

        guard b.count >= 14, try tag() == "MThd" else { throw MIDIError.notMIDI }
        let hlen = try u32()
        _ = try u16()
        let ntracks = try u16()
        let division = try u16()
        i = 8 + hlen
        guard division & 0x8000 == 0 else { throw MIDIError.notMIDI }   // SMPTE non géré

        var result = MIDIFileContents(division: division, tracks: [])
        for _ in 0..<ntracks {
            guard i + 8 <= b.count else { break }
            let t = try tag()
            let len = try u32()
            let end = min(b.count, i + len)
            if t != "MTrk" { i = end; continue }
            var track = MIDIFileContents.Track()
            var tick = 0
            var running: UInt8 = 0
            var open: [Int: (Int, Int)] = [:]   // (canal<<8 | touche) -> (début, vélocité)
            func readVLQ() throws -> Int {
                var v = 0
                while true { try need(1); let c = b[i]; i += 1; v = (v << 7) | Int(c & 0x7F); if c & 0x80 == 0 { return v } }
            }
            while i < end {
                tick += try readVLQ()
                try need(1)
                var status = b[i]
                if status & 0x80 != 0 { i += 1; if status < 0xF0 { running = status } } else { status = running }
                switch status {
                case 0xFF:
                    try need(1); let type = b[i]; i += 1
                    let l = try readVLQ(); try need(l)
                    let payload = Array(b[i..<i+l]); i += l
                    switch type {
                    case 0x03: track.name = String(decoding: payload, as: UTF8.self)
                    case 0x51 where l == 3 && result.tempoBPM == nil:
                        let us = Int(payload[0]) << 16 | Int(payload[1]) << 8 | Int(payload[2])
                        if us > 0 { result.tempoBPM = 60_000_000 / Double(us) }
                    case 0x58 where l >= 2 && result.timeSignature == nil:
                        result.timeSignature = TimeSignature(Int(payload[0]), 1 << Int(payload[1]))
                    case 0x59 where l >= 1 && result.keyFifths == nil:
                        result.keyFifths = Int(Int8(bitPattern: payload[0]))
                    default: break
                    }
                case 0xF0, 0xF7:
                    let l = try readVLQ(); try need(l); i += l
                default:
                    let kind = status & 0xF0
                    let ch = Int(status & 0x0F)
                    let dataLen = (kind == 0xC0 || kind == 0xD0) ? 1 : 2
                    try need(dataLen)
                    let d1 = Int(b[i]), d2 = dataLen > 1 ? Int(b[i+1]) : 0
                    i += dataLen
                    let k = ch << 8 | d1
                    if kind == 0x90 && d2 > 0 {
                        if let o = open[k] { track.notes.append((PlayedNote(start: o.0, end: tick, key: d1, velocity: o.1), ch)) }
                        open[k] = (tick, d2)
                    } else if kind == 0x80 || (kind == 0x90 && d2 == 0) {
                        if let o = open[k] { track.notes.append((PlayedNote(start: o.0, end: tick, key: d1, velocity: o.1), ch)); open[k] = nil }
                    } else if kind == 0xC0 && track.program == nil {
                        track.program = d1
                    }
                }
            }
            for (k, o) in open { track.notes.append((PlayedNote(start: o.0, end: tick, key: k & 0xFF, velocity: o.1), k >> 8)) }
            i = end
            result.tracks.append(track)
        }
        return result
    }
}

// MARK: - Import MIDI → partition

public enum MIDIImporter {
    /// Convertit un fichier MIDI en partition (quantification à la double croche).
    public static func score(from data: Data, title: String = "") throws -> Score {
        let file = try MIDIReader.read(data)
        let unit = max(1, file.division / 4)              // ticks par double croche
        let time = file.timeSignature ?? TimeSignature(4, 4)
        let key = KeySignature(file.keyFifths ?? 0)

        // Regroupe par piste (ou par canal pour un fichier de type 0), sans les percussions.
        var groups: [(name: String, program: Int, notes: [PlayedNote])] = []
        for tr in file.tracks {
            let channels = Set(tr.notes.map { $0.channel }).subtracting([9]).sorted()
            for ch in channels {
                let notes = tr.notes.filter { $0.channel == ch }.map { $0.note }
                guard !notes.isEmpty else { continue }
                let name = tr.name.isEmpty ? "Piste \(groups.count + 1)" : tr.name
                groups.append((name, tr.program ?? 0, notes))
            }
        }
        guard !groups.isEmpty else { throw MIDIError.noNotes }

        // Quantification.
        func q(_ t: Int) -> Int { Int((Double(t) / Double(unit)).rounded()) }
        let mlUnits = time.measureLength.num * 16 / time.measureLength.den
        let totalUnits = groups.flatMap { $0.notes }.map { max(q($0.end), q($0.start) + 1) }.max() ?? 1
        let measureCount = max(1, (totalUnits + max(1, mlUnits) - 1) / max(1, mlUnits))

        var score = Score.make(template: .melodyTreble, title: title, time: time, key: key,
                               tempo: (file.tempoBPM ?? 100).rounded(), measures: measureCount)
        score.parts = []

        for g in groups {
            let keys = g.notes.map(\.key)
            let low = keys.min()!, high = keys.max()!
            var staves: [(Clef, [PlayedNote])] = []
            if low < 55 && high > 65 {
                staves = [(Clef.treble, g.notes.filter { $0.key >= 60 }), (Clef.bass, g.notes.filter { $0.key < 60 })]
            } else {
                let avg = Double(keys.reduce(0, +)) / Double(keys.count)
                staves = [(avg < 57 ? Clef.bass : Clef.treble, g.notes)]
            }
            var part = Part(name: g.name, program: g.program, staves: [])
            for (clef, _) in staves {
                part.staves.append(Staff(clef: clef, measures: Array(repeating: StaffMeasure(), count: measureCount)))
            }
            score.parts.append(part)
            let p = score.parts.count - 1
            for (s, st) in staves.enumerated() {
                fill(&score, staff: StaffRef(part: p, staff: s), notes: st.1.map {
                    (q($0.start), max(q($0.end), q($0.start) + 1), $0.key, $0.velocity)
                }, mlUnits: mlUnits, preferFlats: key.fifths < 0)
            }
        }
        return score
    }

    /// Place des notes quantifiées (en doubles croches) dans une portée, voix 1.
    static func fill(_ score: inout Score, staff: StaffRef, notes: [(Int, Int, Int, Int)], mlUnits: Int, preferFlats: Bool) {
        let onsets = Array(Set(notes.map { $0.0 })).sorted()
        // Segments monophoniques : (début, fin, touches, vélocité).
        var segments: [(Int, Int, [Int], Int)] = []
        for (idx, s) in onsets.enumerated() {
            let chord = notes.filter { $0.0 == s }
            let next = idx + 1 < onsets.count ? onsets[idx + 1] : Int.max
            let end = min(next, chord.map { $0.1 }.max()!)
            segments.append((s, max(end, s + 1), Array(Set(chord.map { $0.2 })).sorted(), chord[0].3))
        }
        var perMeasure: [Int: [(Fraction, Event)]] = [:]
        for seg in segments {
            var pos = seg.0
            while pos < seg.1 {
                let m = pos / mlUnits
                let measureEnd = (m + 1) * mlUnits
                let pieceEnd = min(seg.1, measureEnd)
                let durations = Duration.decompose(Fraction(pieceEnd - pos, 16))
                var offset = Fraction(pos - m * mlUnits, 16)
                for (di, d) in durations.enumerated() {
                    let lastPiece = pieceEnd == seg.1 && di == durations.count - 1
                    let ev = Event(duration: d, notes: seg.2.map {
                        Note(pitch: Pitch.fromMIDI($0, preferFlats: preferFlats), tie: !lastPiece, velocity: seg.3)
                    })
                    if m < score.measureCount { perMeasure[m, default: []].append((offset, ev)) }
                    offset += d.fraction
                }
                pos = pieceEnd
            }
        }
        for (m, slots) in perMeasure {
            score.writeVoice(slots, staff: staff, measure: m, voice: 0)
        }
    }
}
