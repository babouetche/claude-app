import Foundation

/// Erreurs d'édition, avec messages en français clair.
public enum EditError: LocalizedError, Equatable {
    case doesNotFit(remaining: Fraction)
    case nothingSelected
    case cannotDeleteLastMeasure
    case invalidPosition

    public var errorDescription: String? {
        switch self {
        case .doesNotFit:
            return "Cette durée dépasse la fin de la mesure. Choisissez une valeur plus courte."
        case .nothingSelected:
            return "Sélectionnez d'abord une note."
        case .cannotDeleteLastMeasure:
            return "La partition doit garder au moins une mesure."
        case .invalidPosition:
            return "Position introuvable dans la partition."
        }
    }
}

/// Position temporelle dans une voix d'une portée.
public struct TimePosition: Hashable {
    public var staff: StaffRef
    public var measure: Int
    public var voice: Int
    public var offset: Fraction
    public init(staff: StaffRef, measure: Int, voice: Int = 0, offset: Fraction) {
        self.staff = staff; self.measure = measure; self.voice = voice; self.offset = offset
    }
}

/// Repère stable d'un événement (par identifiant).
public struct EventRef: Hashable {
    public var staff: StaffRef
    public var measure: Int
    public var voice: Int
    public var eventID: UUID
    public init(staff: StaffRef, measure: Int, voice: Int = 0, eventID: UUID) {
        self.staff = staff; self.measure = measure; self.voice = voice; self.eventID = eventID
    }
}

extension Score {
    // MARK: Lecture

    public func events(_ staff: StaffRef, measure: Int, voice: Int = 0) -> [Event] {
        let sm = self[staff].measures[measure]
        return voice < sm.voices.count ? sm.voices[voice].events : []
    }

    /// Événements avec leur position de départ.
    public func timedEvents(_ staff: StaffRef, measure: Int, voice: Int = 0) -> [(start: Fraction, event: Event)] {
        let ml = measureLength(measure)
        var t = Fraction.zero
        return events(staff, measure: measure, voice: voice).map { e in
            defer { t += e.length(measureLength: ml) }
            return (t, e)
        }
    }

    public func locate(_ ref: EventRef) -> (index: Int, start: Fraction, event: Event)? {
        guard ref.measure >= 0, ref.measure < measureCount else { return nil }
        for (i, te) in timedEvents(ref.staff, measure: ref.measure, voice: ref.voice).enumerated() where te.event.id == ref.eventID {
            return (i, te.start, te.event)
        }
        return nil
    }

    /// Événement suivant / précédent (en traversant les mesures).
    public func neighbor(of ref: EventRef, forward: Bool) -> EventRef? {
        guard let loc = locate(ref) else { return nil }
        let evs = events(ref.staff, measure: ref.measure, voice: ref.voice)
        let i = loc.index + (forward ? 1 : -1)
        if i >= 0 && i < evs.count { return EventRef(staff: ref.staff, measure: ref.measure, voice: ref.voice, eventID: evs[i].id) }
        let m = ref.measure + (forward ? 1 : -1)
        guard m >= 0 && m < measureCount else { return nil }
        let other = events(ref.staff, measure: m, voice: ref.voice)
        guard let e = forward ? other.first : other.last else { return nil }
        return EventRef(staff: ref.staff, measure: m, voice: ref.voice, eventID: e.id)
    }

    /// Événement qui couvre la position donnée.
    public func event(at pos: TimePosition) -> EventRef? {
        let ml = measureLength(pos.measure)
        for te in timedEvents(pos.staff, measure: pos.measure, voice: pos.voice) {
            if pos.offset >= te.start && pos.offset < te.start + te.event.length(measureLength: ml) {
                return EventRef(staff: pos.staff, measure: pos.measure, voice: pos.voice, eventID: te.event.id)
            }
        }
        return nil
    }

    // MARK: Saisie

    /// Place une note / un accord / un silence à la position donnée, en remplaçant ce qui s'y trouve.
    @discardableResult
    public mutating func setEvent(at pos: TimePosition, duration: Duration, pitches: [Pitch], tie: Bool = false) throws -> EventRef {
        guard pos.measure >= 0, pos.measure < measureCount else { throw EditError.invalidPosition }
        let ml = measureLength(pos.measure)
        let len = duration.fraction
        guard pos.offset >= .zero, pos.offset + len <= ml else { throw EditError.doesNotFit(remaining: ml - pos.offset) }
        let new = Event(duration: duration, notes: pitches.map { Note(pitch: $0, tie: tie) })
        let end = pos.offset + len
        var slots: [(Fraction, Event)] = []
        for (s, e) in timedEvents(pos.staff, measure: pos.measure, voice: pos.voice) {
            let eEnd = s + e.length(measureLength: ml)
            if eEnd <= pos.offset || s >= end {
                slots.append((s, e))
            } else if s < pos.offset, !e.isRest, !e.isMeasureRest, e.tuplet == nil,
                      let shorter = Duration.exact(pos.offset - s) {
                // La note précédente est raccourcie plutôt qu'effacée.
                var kept = e
                kept.duration = shorter
                slots.append((s, kept))
            }
        }
        slots.append((pos.offset, new))
        writeVoice(slots, staff: pos.staff, measure: pos.measure, voice: pos.voice)
        return EventRef(staff: pos.staff, measure: pos.measure, voice: pos.voice, eventID: new.id)
    }

    /// Ajoute une hauteur à un accord existant (ou transforme un silence en note).
    public mutating func addPitch(_ pitch: Pitch, to ref: EventRef) throws {
        let fullMeasure = Duration.exact(measureLength(ref.measure)) ?? Duration(.whole)
        try modifyEvent(ref) { e in
            if e.isMeasureRest {
                e.isMeasureRest = false
                e.duration = fullMeasure
            }
            guard !e.notes.contains(where: { $0.pitch.diatonic == pitch.diatonic }) else { return }
            e.notes.append(Note(pitch: pitch))
            e.notes.sort { $0.pitch.diatonic < $1.pitch.diatonic }
        }
    }

    /// Remplace un événement par un silence.
    public mutating func makeRest(_ ref: EventRef) throws {
        guard let loc = locate(ref) else { throw EditError.invalidPosition }
        var slots = timedEvents(ref.staff, measure: ref.measure, voice: ref.voice).map { ($0.start, $0.event) }
        var e = loc.event
        e.notes = []
        slots[loc.index] = (loc.start, e)
        writeVoice(slots, staff: ref.staff, measure: ref.measure, voice: ref.voice)
    }

    /// Change la durée d'un événement en conservant ses hauteurs.
    @discardableResult
    public mutating func changeDuration(_ ref: EventRef, to duration: Duration) throws -> EventRef {
        guard let loc = locate(ref) else { throw EditError.invalidPosition }
        let pos = TimePosition(staff: ref.staff, measure: ref.measure, voice: ref.voice, offset: loc.start)
        return try setEvent(at: pos, duration: duration, pitches: loc.event.notes.map(\.pitch),
                            tie: loc.event.notes.first?.tie ?? false)
    }

    public mutating func modifyEvent(_ ref: EventRef, _ change: (inout Event) throws -> Void) throws {
        guard let loc = locate(ref) else { throw EditError.invalidPosition }
        var sm = self[ref.staff].measures[ref.measure]
        try change(&sm.voices[ref.voice].events[loc.index])
        self[ref.staff].measures[ref.measure] = sm
    }

    /// Modifie une note (ou toutes les notes de l'accord si `noteIndex` est nil).
    public mutating func modifyNotes(_ ref: EventRef, noteIndex: Int? = nil, _ change: (inout Note) -> Void) throws {
        try modifyEvent(ref) { e in
            guard !e.notes.isEmpty else { throw EditError.nothingSelected }
            if let i = noteIndex, i < e.notes.count { change(&e.notes[i]) } else {
                for i in e.notes.indices { change(&e.notes[i]) }
            }
        }
    }

    /// Transpose d'un nombre de demi-tons (orthographe selon l'armure).
    public mutating func transposeChromatic(_ ref: EventRef, noteIndex: Int? = nil, semitones: Int) throws {
        let flats = measures[ref.measure].key.fifths < 0 || semitones < 0 && measures[ref.measure].key.fifths == 0
        try modifyNotes(ref, noteIndex: noteIndex) { n in
            n.pitch = Pitch.fromMIDI(n.pitch.midi + semitones, preferFlats: flats)
        }
    }

    /// Transpose d'un nombre de degrés (7 = une octave), altération conservée.
    public mutating func transposeDiatonic(_ ref: EventRef, noteIndex: Int? = nil, steps: Int) throws {
        let key = measures[ref.measure].key
        try modifyNotes(ref, noteIndex: noteIndex) { n in
            let alter = steps % 7 == 0 ? n.pitch.alter : key.alter(forStep: Pitch(diatonic: n.pitch.diatonic + steps).step)
            n.pitch = Pitch(diatonic: n.pitch.diatonic + steps, alter: alter)
        }
    }

    public mutating func setAlter(_ ref: EventRef, noteIndex: Int? = nil, alter: Int) throws {
        try modifyNotes(ref, noteIndex: noteIndex) { $0.pitch.alter = alter }
    }

    public mutating func toggleTie(_ ref: EventRef) throws {
        guard let e = locate(ref)?.event, !e.isRest else { throw EditError.nothingSelected }
        let value = !e.notes.allSatisfy(\.tie)
        try modifyNotes(ref) { $0.tie = value }
    }

    public mutating func toggleDot(_ ref: EventRef) throws -> EventRef {
        guard let e = locate(ref)?.event, !e.isMeasureRest else { throw EditError.nothingSelected }
        var d = e.duration
        d.dots = d.dots == 0 ? 1 : 0
        return try changeDuration(ref, to: d)
    }

    // MARK: Mesures

    public mutating func insertMeasures(at index: Int, count: Int = 1) {
        let i = max(0, min(index, measureCount))
        let template = measures[max(0, min(i, measureCount - 1))]
        var info = MeasureInfo(time: template.time, key: template.key)
        if i == measureCount, measureCount > 0 {
            // Ajout en fin : la barre finale passe à la nouvelle dernière mesure.
            info.barline = measures[measureCount - 1].barline
            measures[measureCount - 1].barline = .regular
        }
        for _ in 0..<count { measures.insert(info, at: i) }
        if i < measureCount - count { measures[i].barline = .regular }
        for ref in staffRefs {
            for _ in 0..<count { self[ref].measures.insert(StaffMeasure(), at: i) }
        }
    }

    public mutating func appendMeasures(_ count: Int = 1) { insertMeasures(at: measureCount, count: count) }

    public mutating func deleteMeasures(_ range: Range<Int>) throws {
        let r = range.clamped(to: 0..<measureCount)
        guard r.count < measureCount else { throw EditError.cannotDeleteLastMeasure }
        let wasFinal = r.contains(measureCount - 1) && measures[measureCount - 1].barline == .final
        let firstInfo = measures[r.lowerBound]
        measures.removeSubrange(r)
        for ref in staffRefs { self[ref].measures.removeSubrange(r) }
        if wasFinal { measures[measureCount - 1].barline = .final }
        if r.lowerBound == 0 && measures[0].tempo == nil { measures[0].tempo = firstInfo.tempo }
    }

    public mutating func setTempo(_ bpm: Double, at measure: Int = 0) {
        measures[measure].tempo = max(20, min(400, bpm))
    }

    // MARK: Interne

    /// Réécrit une voix à partir d'événements positionnés : trous comblés par des silences, mesure vide compactée.
    mutating func writeVoice(_ slots: [(Fraction, Event)], staff: StaffRef, measure: Int, voice: Int) {
        let ml = measureLength(measure)
        let sorted = slots.sorted { $0.0 < $1.0 }
        var out: [Event] = []
        var t = Fraction.zero
        for (s, e) in sorted {
            if s > t { out += Duration.alignedRests(from: t, length: s - t).map { Event(duration: $0) } }
            out.append(e)
            t = s + e.length(measureLength: ml)
        }
        if t < ml { out += Duration.alignedRests(from: t, length: ml - t).map { Event(duration: $0) } }
        if out.allSatisfy(\.isRest) { out = [.measureRest()] }
        var sm = self[staff].measures[measure]
        while sm.voices.count <= voice { sm.voices.append(Voice(events: [.measureRest()])) }
        sm.voices[voice].events = out
        self[staff].measures[measure] = sm
    }
}

extension Score {
    /// Hauteur la plus proche de `reference` pour une lettre donnée (A–G), avec l'altération de l'armure.
    public func pitch(letter step: Int, near reference: Int, measure: Int) -> Pitch {
        var best = Pitch(step: step, octave: 4)
        var bestDist = Int.max
        for octave in 0...8 {
            let p = Pitch(step: step, octave: octave)
            let d = abs(p.diatonic - reference)
            if d < bestDist { bestDist = d; best = p }
        }
        best.alter = measures[measure].key.alter(forStep: step)
        return best
    }
}
