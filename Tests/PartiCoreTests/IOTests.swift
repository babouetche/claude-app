import XCTest
@testable import PartiCore

final class IOTests: XCTestCase {
    func melody() throws -> Score {
        var s = Score.make(template: .accordion, title: "Valse", time: TimeSignature(3, 4), key: KeySignature(-1), tempo: 132, measures: 4)
        let rh = StaffRef(part: 0, staff: 0), lh = StaffRef(part: 0, staff: 1)
        try s.setEvent(at: TimePosition(staff: rh, measure: 0, offset: .zero), duration: Duration(.half), pitches: [Pitch(step: 5, octave: 4)], tie: false)
        try s.setEvent(at: TimePosition(staff: rh, measure: 0, offset: Fraction(1, 2)), duration: Duration(.quarter), pitches: [Pitch(step: 6, alter: -1, octave: 4)], tie: true)
        try s.setEvent(at: TimePosition(staff: rh, measure: 1, offset: .zero), duration: Duration(.quarter), pitches: [Pitch(step: 6, alter: -1, octave: 4)])
        try s.setEvent(at: TimePosition(staff: rh, measure: 1, offset: Fraction(1, 4)), duration: Duration(.eighth), pitches: [Pitch(step: 0, octave: 5)])
        try s.setEvent(at: TimePosition(staff: lh, measure: 0, offset: .zero), duration: Duration(.quarter), pitches: [Pitch(step: 3, octave: 2)])
        try s.setEvent(at: TimePosition(staff: lh, measure: 0, offset: Fraction(1, 4)), duration: Duration(.quarter),
                       pitches: [Pitch(step: 3, octave: 3), Pitch(step: 5, octave: 3), Pitch(step: 0, octave: 4)])
        return s
    }

    func testDocumentRoundTrip() throws {
        let s = try melody()
        let back = try ScoreCodec.decode(ScoreCodec.encode(s))
        XCTAssertEqual(back, s)
    }

    func testCorruptDocument() {
        XCTAssertThrowsError(try ScoreCodec.decode(Data("pas une partition".utf8))) { e in
            XCTAssertTrue((e as? DocumentError)?.errorDescription?.contains("PartiMac") ?? false)
        }
        XCTAssertThrowsError(try ScoreCodec.decode(Data(#"{"formatVersion": 99}"#.utf8)))
    }

    func testTiesMergedInPlayback() throws {
        let s = try melody()
        let notes = MIDIExporter.playedNotes(s, staff: StaffRef(part: 0, staff: 0))
        XCTAssertEqual(notes.count, 3)                                   // la, si♭ (lié), do
        XCTAssertEqual(notes[1].key, 70)
        XCTAssertEqual(notes[1].end - notes[1].start, 480 * 2)           // noire + noire liées
    }

    func testMIDIRoundTrip() throws {
        let s = try melody()
        let data = MIDIExporter.data(for: s)
        XCTAssertEqual(Array(data.prefix(4)), Array("MThd".utf8))
        let file = try MIDIReader.read(data)
        XCTAssertEqual(file.tracks.count, 3)                             // conducteur + 2 portées
        XCTAssertEqual(file.tempoBPM.map { $0.rounded() }, 132)
        XCTAssertEqual(file.timeSignature, TimeSignature(3, 4))
        XCTAssertEqual(file.keyFifths, -1)
        XCTAssertEqual(file.tracks[1].program, GM.accordion)
        XCTAssertEqual(file.tracks[1].notes.count + file.tracks[2].notes.count, 3 + 4)

        let imported = try MIDIImporter.score(from: data)
        XCTAssertEqual(imported.measures[0].time, TimeSignature(3, 4))
        XCTAssertEqual(imported.measures[0].key.fifths, -1)
        let rhNotes = MIDIExporter.playedNotes(imported, staff: StaffRef(part: 0, staff: 0)).map(\.key)
        XCTAssertEqual(rhNotes, [69, 70, 72])
    }

    func testMIDIRejectsGarbage() {
        XCTAssertThrowsError(try MIDIReader.read(Data([1, 2, 3])))
    }

    func testLayoutProducesPages() throws {
        var s = try melody()
        s.appendMeasures(60)
        let l = LayoutEngine().layout(s)
        XCTAssertGreaterThan(l.pages.count, 1)
        XCTAssertEqual(Set(l.systems.flatMap { $0.measures.map(\.index) }).count, s.measureCount)
        // Chaque système tient dans la largeur de la page.
        for sys in l.systems { XCTAssertLessThanOrEqual(sys.x1, s.page.width - s.page.marginRight + 0.5) }
        // Un clic sur la première note la retrouve.
        let rh = StaffRef(part: 0, staff: 0)
        let first = s.events(rh, measure: 0)[0]
        let key = EventKey(staff: rh, measure: 0, voice: 0, eventID: first.id)
        let placed = try XCTUnwrap(l.placedEvent(key))
        let staff = try XCTUnwrap(placed.system.staff(rh))
        let y = staff.top + 4 * l.staffSpace - Double(placed.event.positions[0]) * l.staffSpace / 2
        let hit = try XCTUnwrap(l.hitTest(page: 0, point: LPoint(placed.event.x + 2, y)))
        XCTAssertEqual(hit.event, key)
        XCTAssertEqual(hit.offset, .zero)
    }

    func testLargeScorePerformance() throws {
        var s = Score.make(template: .piano, measures: 300)
        let rh = StaffRef(part: 0, staff: 0)
        for m in 0..<300 { for b in 0..<8 {
            try s.setEvent(at: TimePosition(staff: rh, measure: m, offset: Fraction(b, 8)), duration: Duration(.eighth), pitches: [Pitch(step: b % 7, octave: 5)])
        } }
        let start = Date()
        let l = LayoutEngine().layout(s)
        XCTAssertGreaterThan(l.pages.count, 10)
        XCTAssertLessThan(Date().timeIntervalSince(start), 3.0)
    }
}
