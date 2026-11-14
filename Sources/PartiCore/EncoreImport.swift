// Import des fichiers Encore (.enc).
//
// La connaissance du format Encore provient du projet libre Enc2MusicXML
// (Copyright (C) 2018 Leon Vinken, https://github.com/lvinken/Enc2MusicXML),
// distribué sous licence GNU GPL version 3 ou ultérieure. Ce fichier en est
// une adaptation en Swift et est distribué sous la même licence (voir LICENSE).

import Foundation

public enum EncoreImportError: LocalizedError {
    case notEncore, noMeasures
    public var errorDescription: String? {
        switch self {
        case .notEncore: return "Ce fichier n'est pas une partition Encore (.enc) reconnue."
        case .noMeasures: return "Cette partition Encore ne contient aucune mesure lisible."
        }
    }
}

/// Résumé de ce qui a été importé (affiché à l'utilisateur).
public struct EncoreImportReport {
    public var measures = 0
    public var notes = 0
    public var texts = 0
    public var skippedGraceNotes = 0
    public var hiddenVoiceNotes = 0
}

public enum EncoreImporter {

    // MARK: Lecture binaire

    struct Reader {
        let b: [UInt8]
        let big: Bool
        func u8(_ o: Int) -> Int { o >= 0 && o < b.count ? Int(b[o]) : 0 }
        func i8(_ o: Int) -> Int { Int(Int8(bitPattern: UInt8(u8(o)))) }
        func u16(_ o: Int) -> Int { big ? (u8(o) << 8 | u8(o + 1)) : (u8(o + 1) << 8 | u8(o)) }
        func i16(_ o: Int) -> Int { Int(Int16(bitPattern: UInt16(u16(o)))) }
        func u32(_ o: Int) -> Int { big ? (u16(o) << 16 | u16(o + 2)) : (u16(o + 2) << 16 | u16(o)) }
        func tag(_ o: Int) -> String {
            guard o + 4 <= b.count else { return "" }
            return String(bytes: b[o..<o + 4], encoding: .isoLatin1) ?? ""
        }
        /// Chaîne d'un octet par caractère (Mac Roman), arrêtée au premier 0.
        func cString(_ o: Int, max: Int, stopAt4: Bool = false) -> String {
            var bytes: [UInt8] = []
            var i = o
            while i < min(o + max, b.count) {
                let c = b[i]
                if c == 0 || (stopAt4 && c == 4) { break }
                bytes.append(c); i += 1
            }
            return String(bytes: bytes, encoding: .macOSRoman) ?? String(decoding: bytes, as: UTF8.self)
        }
        /// Chaîne UTF-16 petit-boutiste, arrêtée au premier 0.
        func utf16String(_ o: Int, maxBytes: Int) -> String {
            var units: [UInt16] = []
            var i = o
            while i + 1 < min(o + maxBytes, b.count) {
                let u = UInt16(b[i]) | UInt16(b[i + 1]) << 8
                if u == 0 { break }
                units.append(u); i += 2
            }
            return String(decoding: units, as: UTF16.self)
        }
    }

    struct LineStaff { var clef: Int; var key: Int; var instrument: Int }

    struct Elem {
        var tick: Int, type: Int, voice: Int, staff: Int, size: Int
        /// Position horizontale dans la mesure (unités Encore).
        var x = 0
        var face = 0, grace1 = 0, grace2 = 0, tuplet = 0, dots = 0, pitch = 0, accidental = 0
        var ornament = 0, textIndex = -1, yPos = 0
        var tieStart = false
        var keyCode = 0
        var chordText = ""
    }

    struct Meas {
        var num = 4, den = 4, durTicks = 960, bpm = 0, barStart = 0, barEnd = 0, alt = 0
        var elems: [Elem] = []
    }

    static let fifthsTable = [0, -1, -2, -3, -4, -5, -6, -7, 1, 2, 3, 4, 5, 6, 7]
    static let ticksPerWhole = 960

    // MARK: Analyse du fichier

    struct Parsed {
        var staffPerSystem = 1
        var instrumentCount = 1
        var veryOld = false
        var lineStaves: [LineStaff] = []
        var lineStarts: [Int] = []
        var measures: [Meas] = []
        var texts: [String] = []
        var title = ""
        var authors: [String] = []
        var instrumentNames: [String] = []
        var programs: [Int] = []
    }

    static func parse(_ data: Data) throws -> Parsed {
        let bytes = [UInt8](data)
        guard bytes.count > 0xC2 else { throw EncoreImportError.notEncore }
        let magic = String(bytes: bytes[0..<4], encoding: .isoLatin1) ?? ""
        guard magic == "SCO5" || magic == "SCOW" else { throw EncoreImportError.notEncore }
        let r = Reader(b: bytes, big: magic == "SCO5")
        var p = Parsed()
        let chuMagio = r.u8(4)
        p.veryOld = chuMagio == 0xA6
        let isOld = chuMagio == 0xC2 || p.veryOld
        p.instrumentCount = max(1, r.i8(0x32))
        p.staffPerSystem = max(1, r.i8(0x33))

        var pos = 0xC2
        while pos + 8 < bytes.count {
            let t = r.tag(pos)
            let isInstrument = t.hasPrefix("TK") && t.dropFirst(2).allSatisfy(\.isNumber) && t.count == 4
            guard ["LINE", "MEAS", "TITL", "TEXT"].contains(t) || isInstrument else { pos += 1; continue }
            let size = r.u32(pos + 4)
            let body = pos + 8
            switch t {
            case "LINE":
                p.lineStarts.append(r.u16(body + 10))
                if p.lineStaves.isEmpty {
                    for i in 0..<p.staffPerSystem {
                        let o = body + 13 + 30 * i
                        p.lineStaves.append(LineStaff(clef: r.i8(o + 14), key: r.u8(o + 15), instrument: r.u8(o + 21) & 0x3F))
                    }
                }
                pos = body + size
            case "MEAS":
                p.measures.append(parseMeasure(r, body: body, size: size, veryOld: p.veryOld))
                pos = body + size
            case "TEXT":
                let n = r.u16(body + 2)
                var q = body + 8
                for _ in 0..<n where q + 2 < bytes.count {
                    let sz = r.u16(q)
                    p.texts.append(sz > 14 ? r.cString(q + 16, max: sz - 14, stopAt4: true) : "")
                    q += 2 + sz
                }
                pos = body + size
            case "TITL":
                let twoBytes = size >= 10000
                let itemSize = twoBytes ? 30 + 1026 : 30 + 66
                func item(_ i: Int) -> String {
                    let o = body + 2 + i * itemSize + 30
                    return (twoBytes ? r.utf16String(o, maxBytes: 1026) : r.cString(o, max: 66))
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                }
                p.title = item(0)
                p.authors = (6..<10).map(item).filter { !$0.isEmpty }
                pos = body + size
            default: // instrument
                p.instrumentNames.append(r.cString(body, max: 60).trimmingCharacters(in: .whitespaces))
                pos = body + (size & 0xFFFF)
            }
            if pos <= body { pos = body }
        }
        if !isOld {
            for n in 0..<p.instrumentCount {
                let off = 2278 + n * 2158
                let prg = r.u8(off)
                p.programs.append((1...128).contains(prg) ? prg - 1 : -1)
            }
        }
        return p
    }

    static func parseMeasure(_ r: Reader, body s: Int, size: Int, veryOld: Bool) -> Meas {
        var m = Meas()
        m.bpm = r.u16(s)
        m.durTicks = r.u16(s + 6)
        m.num = r.u8(s + 8)
        m.den = r.u8(s + 9)
        m.barStart = r.u8(s + 12)
        m.barEnd = r.u8(s + 13)
        m.alt = r.u8(s + 15)
        let off = veryOld ? 0x3E : 0x36
        var p = s + off
        let end = s + size + off
        var guardCount = 0
        while p < end - 2 && guardCount < 10_000 {
            guardCount += 1
            let tick = r.u16(p)
            let tv = r.u8(p + 2)
            if tick == 0xFFFF || tv == 0xFF { break }
            let size = r.u8(p + 3)
            var e = Elem(tick: tick, type: tv >> 4, voice: tv & 0x0F, staff: r.u8(p + 4) & 0x3F, size: size)
            e.x = r.u8(p + 11)
            let q = p + 5
            switch e.type {
            case 9: // note
                e.face = r.u8(q); e.grace1 = r.u8(q + 1); e.grace2 = r.u8(q + 2)
                e.tuplet = r.u8(q + 8); e.dots = r.u8(q + 9) & 3; e.pitch = r.u8(q + 10)
                e.accidental = r.u8(q + 16)
                if size == 22 { e.pitch = e.tuplet; e.tuplet = 0 }
            case 8: // silence
                e.face = r.u8(q); e.tuplet = r.u8(q + 8); e.dots = r.u8(q + 9) & 3
            case 7: // symbole d'accord
                if r.u8(q + 1) & 1 == 1 { e.chordText = r.utf16String(q + 9, maxBytes: 36) }
            case 5: // ornement / texte
                e.ornament = r.u8(q)
                if e.ornament == 0x1E && size > 34 { e.textIndex = r.u16(p + 32) }
                e.yPos = r.i16(p + 12)
            case 3: // liaison de prolongation
                e.tieStart = size > 5 && r.u8(q) == 0xFE
            case 2: // changement d'armure
                e.keyCode = r.u8(q)
            default: break
            }
            m.elems.append(e)
            p += size > 0 ? (veryOld ? size * 2 : size) : 6
        }
        return m
    }

    // MARK: Conversion en partition

    static func duration(face: Int) -> DurationBase {
        DurationBase(rawValue: max(1, min(8, face & 0x0F))) ?? .quarter
    }

    /// Orthographe d'une hauteur MIDI selon l'altération notée et l'armure.
    static func spell(_ midi: Int, accidental: Int, key: KeySignature) -> Pitch {
        let sharp = Pitch.fromMIDI(midi, preferFlats: false)
        let flat = Pitch.fromMIDI(midi, preferFlats: true)
        switch accidental {
        case 1: return sharp
        case 2: return flat
        case 3: return sharp.alter == 0 ? sharp : flat.alter == 0 ? flat : sharp
        default:
            if key.alter(forStep: sharp.step) == sharp.alter { return sharp }
            if key.alter(forStep: flat.step) == flat.alter { return flat }
            return key.fifths < 0 ? flat : sharp
        }
    }

    static func clef(_ code: Int) -> Clef {
        switch code {
        case 1, 6: return .bass
        case 2: return .alto
        case 3: return .tenor
        case 5: return .treble8vb
        default: return .treble
        }
    }

    public static func score(from data: Data, fileName: String = "") throws -> Score {
        try importScore(from: data, fileName: fileName).score
    }

    public static func importScore(from data: Data, fileName: String = "") throws -> (score: Score, report: EncoreImportReport) {
        let p = try parse(data)
        guard !p.measures.isEmpty else { throw EncoreImportError.noMeasures }
        var report = EncoreImportReport()

        // Portées et parties.
        let staves = p.lineStaves.isEmpty ? [LineStaff(clef: 0, key: 0, instrument: 0)] : p.lineStaves
        var staffRef: [Int: StaffRef] = [:]
        var parts: [Part] = []
        var partOfInstrument: [Int: Int] = [:]
        for (i, st) in staves.enumerated() {
            if partOfInstrument[st.instrument] == nil {
                partOfInstrument[st.instrument] = parts.count
                var name = st.instrument < p.instrumentNames.count ? p.instrumentNames[st.instrument] : ""
                if name.isEmpty { name = "Accordéon" }
                let program = st.instrument < p.programs.count && p.programs[st.instrument] >= 0 ? p.programs[st.instrument] : GM.accordion
                parts.append(Part(name: name, program: program, staves: []))
            }
            let pi = partOfInstrument[st.instrument]!
            staffRef[i] = StaffRef(part: pi, staff: parts[pi].staves.count)
            parts[pi].staves.append(Staff(clef: clef(st.clef), measures: Array(repeating: StaffMeasure(), count: p.measures.count)))
        }

        // Mesures : métrique, armure, tempo, barres.
        var key = KeySignature(fifthsTable[min(14, staves[0].key)])
        var infos: [MeasureInfo] = []
        var lastBpm = 0
        for (i, m) in p.measures.enumerated() {
            let validDen = [1, 2, 4, 8, 16, 32].contains(m.den)
            let time = (m.num > 0 && validDen) ? TimeSignature(m.num, m.den) : (infos.last?.time ?? TimeSignature(4, 4))
            if let kc = m.elems.first(where: { $0.type == 2 }), kc.keyCode < fifthsTable.count {
                key = KeySignature(fifthsTable[kc.keyCode])
            }
            var info = MeasureInfo(time: time, key: key)
            if m.bpm > 0 && m.bpm != lastBpm { info.tempo = Double(m.bpm); lastBpm = m.bpm }
            if i == 0 && info.tempo == nil { info.tempo = 100 }
            switch m.barEnd {
            case 4: info.barline = .repeatEnd
            case 5: info.barline = .final
            case 3, 6: info.barline = .double
            default: break
            }
            info.repeatStart = m.barStart == 2
            info.volta = m.alt
            // Double barre « à gauche » : on la place en fin de mesure précédente.
            if m.barStart == 3, i > 0, infos[i - 1].barline == .regular { infos[i - 1].barline = .double }
            // Barre double juste avant une reprise : la barre de reprise suffit.
            if m.barStart == 2, i > 0, infos[i - 1].barline == .double { infos[i - 1].barline = .regular }
            infos.append(info)
        }
        if let last = infos.indices.last, infos[last].barline == .regular { infos[last].barline = .final }
        // Retours à la ligne identiques à ceux d'Encore.
        for start in p.lineStarts where start > 0 && start < infos.count { infos[start].systemBreak = true }

        var score = Score(metadata: ScoreMetadata(title: p.title.isEmpty ? fileName : p.title.capitalizedTitle),
                          measures: infos, parts: parts)
        if !p.authors.isEmpty { score.metadata.composer = p.authors.joined(separator: ", ") }

        // Notes et silences.
        for (mi, m) in p.measures.enumerated() {
            let fullLength = score.measureLength(mi)
            let measureKey = score.measures[mi].key
            var groups: [Int: [Elem]] = [:]   // portée*16+voix
            for e in m.elems where e.type == 8 || e.type == 9 {
                if e.type == 9 && (e.grace1 & 0x30) >= 0x20 { report.skippedGraceNotes += 1; continue }
                guard staffRef[e.staff] != nil else { continue }
                groups[e.staff * 16 + e.voice, default: []].append(e)
            }
            // Mesure de levée : première mesure incomplète.
            if mi == 0, let total = groups.values.map(writtenTotal).max(), total > .zero, total < fullLength {
                score.measures[0].lengthOverride = total
            }
            let ml = score.measureLength(mi)
            for (key, elems) in groups {
                let ref = staffRef[key / 16]!
                let voice = key % 16
                if voice > 0 { report.hiddenVoiceNotes += elems.filter { $0.type == 9 }.count }
                let ticks = Array(Set(elems.map(\.tick))).sorted()
                var onsets: [[Elem]] = []
                for t in ticks {
                    if let last = onsets.last, let lt = last.first?.tick, t - lt < 4 { onsets[onsets.count - 1] += elems.filter { $0.tick == t } }
                    else { onsets.append(elems.filter { $0.tick == t }) }
                }
                var slots: [(Fraction, Event)] = []
                for (k, group) in onsets.enumerated() {
                    let first = group[0]
                    let start = Fraction(first.tick, ticksPerWhole)
                    guard start < ml else { continue }
                    let nextStart = k + 1 < onsets.count ? Fraction(onsets[k + 1][0].tick, ticksPerWhole) : ml
                    var dur = Duration(duration(face: first.face), dots: first.dots)
                    var tuplet: Tuplet?
                    if first.tuplet != 0, first.tuplet >> 4 > 0, first.tuplet & 0x0F > 0 {
                        tuplet = Tuplet(actual: first.tuplet >> 4, normal: first.tuplet & 0x0F)
                    }
                    var len = dur.fraction
                    if let t = tuplet { len = len * Fraction(t.normal, t.actual) }
                    let limit = min(nextStart, ml)
                    if start + len > limit {
                        let room = limit - start
                        guard room > .zero else { continue }
                        tuplet = nil
                        dur = Duration.exact(room) ?? Duration.decompose(room).first ?? dur
                    }
                    let notes = group.filter { $0.type == 9 }
                    var ev = Event(duration: dur, tuplet: tuplet)
                    if notes.isEmpty {
                        if onsets.count == 1, dur.fraction >= ml { ev = .measureRest() }
                    } else {
                        var seen = Set<Int>()
                        for n in notes where seen.insert(n.pitch).inserted {
                            ev.notes.append(Note(pitch: spell(n.pitch, accidental: n.accidental, key: measureKey)))
                        }
                        ev.notes.sort { $0.pitch.diatonic < $1.pitch.diatonic }
                        if voice == 0 { report.notes += ev.notes.count }
                    }
                    // Liaison de prolongation partant de cette note.
                    if m.elems.contains(where: { $0.type == 3 && $0.tieStart && $0.tick == first.tick && $0.staff == first.staff && $0.voice == first.voice }) {
                        for i in ev.notes.indices { ev.notes[i].tie = true }
                    }
                    slots.append((start, ev))
                }
                score.writeVoice(slots, staff: ref, measure: mi, voice: voice)
            }

            // Textes (accords, basses, doigtés, indications) et symboles :
            // Encore les place par position horizontale ; on les rattache à la note la plus proche.
            let anchors = m.elems.filter { $0.type == 8 || ($0.type == 9 && ($0.grace1 & 0x30) < 0x20) }
            func anchoredOffset(_ e: Elem) -> Fraction {
                let sameStaff = anchors.filter { $0.staff == e.staff }
                let pool = sameStaff.isEmpty ? anchors : sameStaff
                let tick = pool.min(by: { abs($0.x - e.x) < abs($1.x - e.x) })?.tick ?? e.tick
                return max(.zero, min(Fraction(tick, ticksPerWhole), ml - Fraction(1, 64)))
            }
            for e in m.elems {
                // 0xF7 : petit cercle barré (⊗), utilisé en accordéon.
                if e.type == 5 && e.ornament == 0xF7, let ref = staffRef[e.staff] {
                    score.annotations.append(Annotation(staff: ref, measure: mi, offset: anchoredOffset(e), text: "⊗",
                                                        above: e.yPos > 4, staffPosition: e.yPos, glyph: 0xE0B3))
                    continue
                }
                var text = ""
                if e.type == 5 && e.textIndex >= 0 && e.textIndex < p.texts.count { text = p.texts[e.textIndex] }
                if e.type == 7 { text = e.chordText }
                text = text.replacingOccurrences(of: "\t", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty, let ref = staffRef[e.staff] else { continue }
                let lower = text.lowercased()
                if lower.contains("musique") || lower.contains("paroles") || lower.contains("arrang") {
                    if score.metadata.composer.isEmpty { score.metadata.composer = text }
                    continue
                }
                if lower.contains("©") || lower.contains("droits") || lower.contains("copyright") {
                    score.metadata.copyright = score.metadata.copyright.isEmpty ? text : score.metadata.copyright + " — " + text
                    continue
                }
                score.annotations.append(Annotation(staff: ref, measure: mi, offset: anchoredOffset(e), text: text,
                                                    above: e.type == 5 ? e.yPos > 4 : false,
                                                    staffPosition: e.type == 5 ? e.yPos : nil))
                report.texts += 1
            }
        }

        // Ne garder une liaison que si la note suivante a la même hauteur.
        for ref in score.staffRefs {
            for mi in 0..<score.measureCount {
                for e in score.events(ref, measure: mi) where e.notes.contains(where: \.tie) {
                    let r = EventRef(staff: ref, measure: mi, eventID: e.id)
                    let next = score.neighbor(of: r, forward: true).flatMap { score.locate($0)?.event }
                    let nextKeys = Set(next?.notes.map(\.pitch.midi) ?? [])
                    try? score.modifyNotes(r) { $0.tie = nextKeys.contains($0.pitch.midi) }
                }
            }
        }
        report.measures = score.measureCount
        return (score, report)
    }

    /// Durée écrite totale d'une voix (pour détecter une levée).
    static func writtenTotal(_ elems: [Elem]) -> Fraction {
        var byTick: [Int: Elem] = [:]
        for e in elems where byTick[e.tick] == nil { byTick[e.tick] = e }
        guard let lastTick = byTick.keys.max(), let last = byTick[lastTick] else { return .zero }
        var len = Duration(duration(face: last.face), dots: last.dots).fraction
        if last.tuplet >> 4 > 0, last.tuplet & 0x0F > 0 { len = len * Fraction(last.tuplet & 0x0F, last.tuplet >> 4) }
        return Fraction(lastTick, ticksPerWhole) + len
    }
}

private extension String {
    /// « HAURTXO TTIPIA » → « Haurtxo Ttipia » (les titres Encore sont souvent en capitales).
    var capitalizedTitle: String {
        self == uppercased() ? capitalized : self
    }
}
