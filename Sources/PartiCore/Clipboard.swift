import Foundation

// MARK: - Presse-papiers : notes et mesures

/// Notes copiées sur une portée (positions relatives au début de la copie).
public struct NoteClip: Codable, Hashable {
    public struct Item: Codable, Hashable {
        public var offset: Fraction
        public var length: Fraction
        public var event: Event
    }
    public var items: [Item]
    public var length: Fraction
    /// Textes et symboles attachés aux notes copiées (`offset` relatif, `measure` ignoré).
    public var annotations: [Annotation]
}

/// Mesures entières copiées, toutes portées.
public struct MeasureClip: Codable, Hashable {
    public var infos: [MeasureInfo]
    public var refs: [StaffRef]
    /// staves[i][k] : portée refs[i], k-ième mesure copiée.
    public var staves: [[StaffMeasure]]
    /// `measure` relatif au début de la copie.
    public var annotations: [Annotation]
    public var spanners: [Spanner]
    public var count: Int { infos.count }
}

extension Event {
    /// Copie avec de nouveaux identifiants (événement et notes).
    func renewed() -> Event {
        var e = self
        e.id = UUID()
        for i in e.notes.indices { e.notes[i].id = UUID() }
        return e
    }
}

extension Score {
    /// Début de la mesure `m` depuis le début de la partition (en rondes).
    public func measureStart(_ m: Int) -> Fraction {
        (0..<min(m, measureCount)).reduce(Fraction.zero) { $0 + measureLength($1) }
    }

    /// Mesure et position dans la mesure d'une position absolue.
    func locate(absolute t: Fraction) -> (measure: Int, offset: Fraction) {
        var start = Fraction.zero
        for m in 0..<measureCount {
            let ml = measureLength(m)
            if t < start + ml { return (m, t - start) }
            start += ml
        }
        return (measureCount, t - start)
    }

    // MARK: Notes

    public func copyNotes(_ refs: [EventRef]) -> NoteClip? {
        let located = refs.compactMap { r -> (Fraction, EventRef, Event)? in
            guard let t = absoluteOffset(r), let e = locate(r)?.event else { return nil }
            return (t, r, e)
        }.sorted { $0.0 < $1.0 }
        guard let base = located.first?.0 else { return nil }
        var items: [NoteClip.Item] = []
        var annos: [Annotation] = []
        var end = base
        for (t, r, e) in located {
            let len = e.length(measureLength: measureLength(r.measure))
            items.append(.init(offset: t - base, length: len, event: e))
            end = max(end, t + len)
            let local = t - measureStart(r.measure)
            for var a in annotations where a.staff == r.staff && a.measure == r.measure && a.offset == local {
                a.offset = t - base; a.measure = 0
                annos.append(a)
            }
        }
        return NoteClip(items: items, length: end - base, annotations: annos)
    }

    /// Colle des notes à partir de `pos` (en remplaçant ce qui s'y trouve). Renvoie le premier événement collé.
    @discardableResult
    public mutating func pasteNotes(_ clip: NoteClip, at pos: TimePosition) throws -> EventRef? {
        guard pos.measure < measureCount else { throw EditError.invalidPosition }
        let p0 = measureStart(pos.measure) + pos.offset
        let end = p0 + clip.length
        while measureStart(measureCount) < end { appendMeasures(1) }

        // Morceaux à poser, par mesure (les notes qui dépassent la barre sont coupées et liées).
        var newSlots: [Int: [(Fraction, Event)]] = [:]
        var firstRef: EventRef?
        for item in clip.items where !item.event.isMeasureRest {
            var t = p0 + item.offset
            var remaining = item.length
            var first = true
            while remaining > .zero {
                let (m, local) = locate(absolute: t)
                guard m < measureCount else { break }
                let avail = measureLength(m) - local
                if first && remaining <= avail {
                    let e = item.event.renewed()
                    newSlots[m, default: []].append((local, e))
                    if firstRef == nil { firstRef = EventRef(staff: pos.staff, measure: m, voice: pos.voice, eventID: e.id) }
                    break
                }
                let piece = min(remaining, avail)
                let durations = Duration.decompose(piece)
                var at = local
                for (k, d) in durations.enumerated() {
                    var e = item.event.renewed()
                    e.duration = d; e.tuplet = nil; e.isMeasureRest = false
                    if !(first && k == 0) { e.lyrics = nil; e.articulations = nil; e.graceNotes = nil }
                    let lastPiece = remaining - piece <= .zero && k == durations.count - 1
                    if !lastPiece { for i in e.notes.indices { e.notes[i].tie = true } }
                    newSlots[m, default: []].append((at, e))
                    if firstRef == nil { firstRef = EventRef(staff: pos.staff, measure: m, voice: pos.voice, eventID: e.id) }
                    at += d.fraction
                }
                remaining -= piece
                t += piece
                first = false
            }
        }

        // Réécriture des mesures touchées.
        let (mFirst, _) = locate(absolute: p0)
        let (mLastRaw, lastLocal) = locate(absolute: end)
        let mLast = lastLocal == .zero ? mLastRaw - 1 : mLastRaw
        for m in mFirst...max(mFirst, min(mLast, measureCount - 1)) {
            let ms = measureStart(m), ml = measureLength(m)
            let rs = max(.zero, p0 - ms), re = min(ml, end - ms)
            var slots: [(Fraction, Event)] = []
            for (s, e) in timedEvents(pos.staff, measure: m, voice: pos.voice) where !e.isMeasureRest {
                let eEnd = s + e.length(measureLength: ml)
                if eEnd <= rs || s >= re { slots.append((s, e)) }
                else if s < rs, e.tuplet == nil, let shorter = Duration.exact(rs - s) {
                    var kept = e; kept.duration = shorter
                    slots.append((s, kept))
                }
            }
            slots += newSlots[m] ?? []
            writeVoice(slots, staff: pos.staff, measure: m, voice: pos.voice)
        }
        for var a in clip.annotations {
            let (m, local) = locate(absolute: p0 + a.offset)
            guard m < measureCount else { continue }
            a.id = UUID(); a.staff = pos.staff; a.measure = m; a.offset = local
            annotations.append(a)
        }
        return firstRef
    }

    // MARK: Mesures

    public func copyMeasures(_ range: Range<Int>) -> MeasureClip {
        let r = range.clamped(to: 0..<measureCount)
        let refs = staffRefs
        var infos = Array(measures[r])
        for i in infos.indices { infos[i].systemBreak = false }
        let staves = refs.map { Array(self[$0].measures[r]) }
        let annos = annotations.filter { r.contains($0.measure) }.map { a -> Annotation in
            var a = a; a.measure -= r.lowerBound; return a
        }
        let sp = spanners.filter { r.contains($0.startMeasure) && r.contains($0.endMeasure) }.map { s -> Spanner in
            var s = s; s.startMeasure -= r.lowerBound; s.endMeasure -= r.lowerBound; return s
        }
        return MeasureClip(infos: infos, refs: refs, staves: staves, annotations: annos, spanners: sp)
    }

    /// Colle des mesures à partir de la mesure `m` : remplace (ou insère avant si `insert`).
    public mutating func pasteMeasures(_ clip: MeasureClip, at m: Int, insert: Bool) {
        guard clip.count > 0 else { return }
        let at = max(0, min(m, measureCount))
        if insert { insertMeasures(at: at, count: clip.count) }
        while measureCount < at + clip.count { appendMeasures(1) }
        let target = at..<(at + clip.count)
        if !insert {
            annotations.removeAll { target.contains($0.measure) }
            spanners.removeAll { target.contains($0.startMeasure) || target.contains($0.endMeasure) }
        }
        let refs = staffRefs
        var idMap: [UUID: UUID] = [:]
        for (k, info) in clip.infos.enumerated() {
            let t = at + k
            var newInfo = info
            newInfo.systemBreak = measures[t].systemBreak
            if t == measureCount - 1 && measures[t].barline == .final && newInfo.barline == .regular { newInfo.barline = .final }
            if t < measureCount - 1 && newInfo.barline == .final { newInfo.barline = .regular }
            measures[t] = newInfo
        }
        for (i, ref) in refs.enumerated() where i < clip.staves.count {
            for (k, sm) in clip.staves[i].enumerated() {
                var copy = sm
                for v in copy.voices.indices {
                    for j in copy.voices[v].events.indices {
                        let old = copy.voices[v].events[j].id
                        copy.voices[v].events[j] = copy.voices[v].events[j].renewed()
                        idMap[old] = copy.voices[v].events[j].id
                    }
                }
                self[ref].measures[at + k] = copy
            }
        }
        func mapRef(_ r: StaffRef) -> StaffRef? {
            guard let i = clip.refs.firstIndex(of: r), i < refs.count else { return nil }
            return refs[i]
        }
        for var a in clip.annotations {
            guard let r = mapRef(a.staff) else { continue }
            a.id = UUID(); a.staff = r; a.measure += at
            annotations.append(a)
        }
        for var s in clip.spanners {
            guard let r = mapRef(s.staff), let a = idMap[s.startEvent], let b = idMap[s.endEvent] else { continue }
            s.id = UUID(); s.staff = r; s.startMeasure += at; s.endMeasure += at; s.startEvent = a; s.endEvent = b
            spanners.append(s)
        }
    }

    // MARK: Transposition de toute la partition

    /// Armure transposée de `semitones` demi-tons (entre 6 bémols et 5 dièses).
    public static func transposedKey(_ fifths: Int, semitones: Int) -> Int {
        var f = (fifths + 7 * semitones) % 12
        if f < -6 { f += 12 }
        if f > 5 { f -= 12 }
        return f
    }

    static func transpose(_ p: Pitch, semitones s: Int, fromKey f: Int, toKey g: Int) -> Pitch {
        // Écart en degrés d'après les toniques des deux tonalités.
        let d0 = ((4 * (g - f)) % 7 + 7) % 7
        let octaves = Int(((Double(s) - Double(d0) * 12.0 / 7.0) / 12.0).rounded())
        let d = d0 + 7 * octaves
        let target = p.midi + s
        var q = Pitch(diatonic: p.diatonic + d)
        q.alter = target - q.midi
        if abs(q.alter) > 2 { return Pitch.fromMIDI(target, preferFlats: g < 0) }
        return q
    }

    /// Transpose toute la partition (notes, petites notes et armures).
    public mutating func transposeAll(semitones s: Int) {
        guard s != 0 else { return }
        let oldKeys = measures.map(\.key.fifths)
        for m in measures.indices {
            measures[m].key = KeySignature(Score.transposedKey(oldKeys[m], semitones: s))
        }
        for ref in staffRefs {
            for m in 0..<measureCount {
                let f = oldKeys[m], g = measures[m].key.fifths
                var sm = self[ref].measures[m]
                for v in sm.voices.indices {
                    for j in sm.voices[v].events.indices {
                        var e = sm.voices[v].events[j]
                        for n in e.notes.indices { e.notes[n].pitch = Score.transpose(e.notes[n].pitch, semitones: s, fromKey: f, toKey: g) }
                        e.graceNotes = e.graceNotes?.map { Score.transpose($0, semitones: s, fromKey: f, toKey: g) }
                        sm.voices[v].events[j] = e
                    }
                }
                self[ref].measures[m] = sm
            }
        }
    }

    // MARK: Petites notes

    /// Ajoute une petite note un degré au-dessus (ou au-dessous) de la note.
    public mutating func addGraceNote(_ ref: EventRef, above: Bool) throws {
        let key = measures[ref.measure].key
        try modifyEvent(ref) { e in
            guard let main = above ? e.notes.map(\.pitch).max(by: { $0.diatonic < $1.diatonic }) : e.notes.map(\.pitch).min(by: { $0.diatonic < $1.diatonic }) else { return }
            let first = e.graceNotes?.first ?? main
            var g = Pitch(diatonic: first.diatonic + (above ? 1 : -1))
            g.alter = key.alter(forStep: g.step)
            e.graceNotes = [g] + (e.graceNotes ?? [])
        }
    }
}
