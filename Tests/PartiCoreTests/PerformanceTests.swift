import XCTest
@testable import PartiCore

final class PerformanceTests: XCTestCase {
    func testNoRepeats() {
        let s = Score.make(template: .melodyTreble, measures: 3)
        XCTAssertEqual(s.performanceOrder(), [0, 1, 2])
    }

    func testSimpleRepeat() {
        var s = Score.make(template: .melodyTreble, measures: 4)
        s.toggleRepeatStart(1)
        s.measures[2].barline = .repeatEnd
        XCTAssertEqual(s.performanceOrder(), [0, 1, 2, 1, 2, 3])
        XCTAssertEqual(s.performanceLengthInBeats, 24)
        XCTAssertEqual(s.performanceBeat(measure: 3), 20)
        XCTAssertEqual(s.performedLocation(atBeat: 13)?.measure, 1)
    }

    func testVoltas() {
        var s = Score.make(template: .melodyTreble, measures: 5)
        s.measures[2].volta = 1          // 1re fois
        s.measures[2].barline = .repeatEnd
        s.measures[3].volta = 2          // 2e fois
        XCTAssertEqual(s.performanceOrder(), [0, 1, 2, 0, 1, 3, 4])
    }

    func testThreeVoltas() {
        var s = Score.make(template: .melodyTreble, measures: 4)
        s.measures[1].volta = 0b011      // 1re et 2e fois
        s.measures[1].barline = .repeatEnd
        s.measures[2].volta = 0b100      // 3e fois
        XCTAssertEqual(s.performanceOrder(), [0, 1, 0, 1, 0, 2, 3])
    }

    func testDaCapoAlFine() {
        var s = Score.make(template: .melodyTreble, measures: 4)
        s.addAnnotation(Annotation(staff: StaffRef(part: 0, staff: 0), measure: 1, offset: .zero, text: "Fine", above: true))
        s.addAnnotation(Annotation(staff: StaffRef(part: 0, staff: 0), measure: 3, offset: .zero, text: "D.C. al Fine", above: true))
        XCTAssertEqual(s.performanceOrder(), [0, 1, 2, 3, 0, 1])
    }
}

final class LyricsTests: XCTestCase {
    func testSetLyricAndVerses() throws {
        var s = Score.make(template: .melodyTreble, measures: 2)
        let ref = StaffRef(part: 0, staff: 0)
        try s.setEvent(at: TimePosition(staff: ref, measure: 0, offset: .zero), duration: Duration(.quarter), pitches: [Pitch(step: 0, octave: 5)])
        try s.setEvent(at: TimePosition(staff: ref, measure: 0, offset: Fraction(1, 4)), duration: Duration(.quarter), pitches: [Pitch(step: 1, octave: 5)])
        let evs = s.events(ref, measure: 0)
        let a = EventRef(staff: ref, measure: 0, eventID: evs[0].id)
        try s.setLyric(a, verse: 1, text: "lu-")
        XCTAssertEqual(s.locate(a)?.event.lyrics, ["", "lu-"])
        XCTAssertEqual(s.lyricVerses(ref), 2)
        // La note suivante saute les silences.
        let b = s.neighborNote(of: a, forward: true)
        XCTAssertEqual(b?.eventID, evs[1].id)
        XCTAssertNil(s.neighborNote(of: b!, forward: true))
        // Effacer la syllabe supprime les paroles.
        try s.setLyric(a, verse: 1, text: "")
        XCTAssertNil(s.locate(a)?.event.lyrics)
        // Les paroles agrandissent l'espace sous la portée.
        let plain = LayoutEngine().layout(Score.make(template: .melodyTreble, measures: 2))
        try s.setLyric(a, verse: 0, text: "Au")
        let withLyrics = LayoutEngine().layout(s)
        XCTAssertTrue(withLyrics.pages[0].items.contains { if case let .text(t, _, _, _, _, _) = $0 { return t == "Au" }; return false })
        _ = plain
    }
}
