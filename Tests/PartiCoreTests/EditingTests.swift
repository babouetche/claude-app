import XCTest
@testable import PartiCore

final class ClipboardEditingTests: XCTestCase {
    let rh = StaffRef(part: 0, staff: 0)

    func melody() throws -> Score {
        var s = Score.make(template: .melodyTreble, measures: 4)
        let q = Duration(.quarter)
        for (k, step) in [0, 1, 2, 3].enumerated() {
            try s.setEvent(at: TimePosition(staff: rh, measure: 0, offset: Fraction(k, 4)), duration: q, pitches: [Pitch(step: step, octave: 5)])
        }
        return s
    }

    func pitches(_ s: Score, _ m: Int, voice: Int = 0) -> [Int] {
        s.events(rh, measure: m, voice: voice).flatMap { $0.notes.map(\.pitch.midi) }
    }

    func testCopyPasteNotes() throws {
        var s = try melody()
        let refs = s.events(rh, measure: 0).prefix(2).map { EventRef(staff: rh, measure: 0, eventID: $0.id) }
        let clip = try XCTUnwrap(s.copyNotes(Array(refs)))
        XCTAssertEqual(clip.length, Fraction(1, 2))
        let first = try s.pasteNotes(clip, at: TimePosition(staff: rh, measure: 1, offset: Fraction(1, 4)))
        XCTAssertNotNil(first)
        XCTAssertEqual(pitches(s, 1), [72, 74])
        XCTAssertEqual(s.timedEvents(rh, measure: 1).filter { !$0.event.isRest }.map(\.start), [Fraction(1, 4), Fraction(1, 2)])
        // Les identifiants sont neufs.
        XCTAssertNotEqual(s.events(rh, measure: 1).first { !$0.isRest }?.id, refs[0].eventID)
    }

    func testPasteAcrossBarlineTies() throws {
        var s = try melody()
        let refs = s.events(rh, measure: 0).map { EventRef(staff: rh, measure: 0, eventID: $0.id) }
        let clip = try XCTUnwrap(s.copyNotes(refs))
        // Collé au 3e temps : la moitié déborde sur la mesure suivante.
        try s.pasteNotes(clip, at: TimePosition(staff: rh, measure: 1, offset: Fraction(1, 2)))
        XCTAssertEqual(pitches(s, 1), [72, 74])
        XCTAssertEqual(pitches(s, 2), [76, 77])
        // Coller à la fin ajoute des mesures.
        try s.pasteNotes(clip, at: TimePosition(staff: rh, measure: 3, offset: Fraction(1, 2)))
        XCTAssertEqual(s.measureCount, 5)
    }

    func testCopyPasteMeasures() throws {
        var s = try melody()
        s.addAnnotation(Annotation(staff: rh, measure: 0, offset: .zero, text: "DO", above: false))
        let clip = s.copyMeasures(0..<1)
        s.pasteMeasures(clip, at: 2, insert: false)
        XCTAssertEqual(pitches(s, 2), [72, 74, 76, 77])
        XCTAssertEqual(s.annotations.filter { $0.measure == 2 }.count, 1)
        XCTAssertEqual(s.measureCount, 4)
        s.pasteMeasures(clip, at: 0, insert: true)
        XCTAssertEqual(s.measureCount, 5)
        XCTAssertEqual(pitches(s, 0), pitches(s, 1))
        XCTAssertEqual(s.measures.last?.barline, .final)
    }

    func testTransposeAll() throws {
        var s = try melody()   // do ré mi fa, do majeur
        s.transposeAll(semitones: 2)
        XCTAssertEqual(s.measures[0].key.fifths, 2)                // ré majeur
        XCTAssertEqual(pitches(s, 0), [74, 76, 78, 79])
        let names = s.events(rh, measure: 0).flatMap { $0.notes.map(\.pitch) }
        XCTAssertEqual(names.map(\.step), [1, 2, 3, 4])            // ré mi fa♯ sol
        XCTAssertEqual(names[2].alter, 1)
        s.transposeAll(semitones: -4)                               // si♭ majeur
        XCTAssertEqual(s.measures[0].key.fifths, -2)
        XCTAssertEqual(s.events(rh, measure: 0)[0].notes[0].pitch, Pitch(step: 6, alter: -1, octave: 4))
        XCTAssertEqual(Score.transposedKey(0, semitones: 1), -5)    // ré♭
    }

    func testSecondVoiceAndGraceNotes() throws {
        var s = try melody()
        try s.setEvent(at: TimePosition(staff: rh, measure: 0, voice: 1, offset: .zero), duration: Duration(.half), pitches: [Pitch(step: 0, octave: 4)])
        XCTAssertEqual(pitches(s, 0, voice: 1), [60])
        let ref = EventRef(staff: rh, measure: 0, eventID: s.events(rh, measure: 0)[1].id)
        try s.addGraceNote(ref, above: true)
        XCTAssertEqual(s.locate(ref)?.event.graceNotes, [Pitch(step: 2, octave: 5)])
        // Les deux voix et la petite note sont jouées.
        let played = MIDIExporter.playedNotes(s, staff: rh).map(\.key)
        XCTAssertTrue(played.contains(60))
        XCTAssertEqual(played.filter { $0 == 76 }.count, 2)
        // Mise en page : les notes de la voix 2 sont placées.
        let l = LayoutEngine().layout(s)
        XCTAssertTrue(l.systems[0].events.keys.contains { $0.voice == 1 })
    }
}
