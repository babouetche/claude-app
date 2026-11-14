import XCTest
@testable import PartiCore

final class ModelTests: XCTestCase {
    func testFraction() {
        XCTAssertEqual(Fraction(2, 4), Fraction(1, 2))
        XCTAssertEqual(Fraction(1, 4) + Fraction(1, 8), Fraction(3, 8))
        XCTAssertTrue(Fraction(1, 8) < Fraction(1, 4))
        XCTAssertTrue(Fraction(3, 8).isMultiple(of: Fraction(1, 8)))
        XCTAssertFalse(Fraction(3, 8).isMultiple(of: Fraction(1, 4)))
    }

    func testDurations() {
        XCTAssertEqual(Duration(.quarter).fraction, Fraction(1, 4))
        XCTAssertEqual(Duration(.quarter, dots: 1).fraction, Fraction(3, 8))
        XCTAssertEqual(Duration(.half, dots: 2).fraction, Fraction(7, 8))
        XCTAssertEqual(Duration(.breve).fraction, Fraction(2))
        XCTAssertEqual(Duration.exact(Fraction(3, 16)), Duration(.eighth, dots: 1))
        XCTAssertEqual(Duration.decompose(Fraction(5, 8)).map(\.fraction).reduce(.zero, +), Fraction(5, 8))
        // Silences alignés : depuis la 2e croche d'une mesure 4/4.
        XCTAssertEqual(Duration.alignedRests(from: Fraction(1, 8), length: Fraction(7, 8)),
                       [Duration(.eighth), Duration(.quarter), Duration(.half)])
    }

    func testPitch() {
        XCTAssertEqual(Pitch(step: 0, octave: 4).midi, 60)
        XCTAssertEqual(Pitch(step: 5, octave: 4).midi, 69)
        XCTAssertEqual(Pitch(step: 6, alter: -1, octave: 4).midi, 70)
        XCTAssertEqual(Pitch.fromMIDI(61), Pitch(step: 0, alter: 1, octave: 4))
        XCTAssertEqual(Pitch.fromMIDI(61, preferFlats: true), Pitch(step: 1, alter: -1, octave: 4))
        XCTAssertEqual(Pitch(diatonic: Pitch(step: 3, octave: 2).diatonic), Pitch(step: 3, octave: 2))
        XCTAssertEqual(Pitch(diatonic: -1).octave, -1)
        XCTAssertEqual(Pitch(step: 4, octave: 4).frenchName, "sol4")
    }

    func testKeySignature() {
        XCTAssertEqual(KeySignature(2).alter(forStep: 3), 1)     // fa♯ en ré majeur
        XCTAssertEqual(KeySignature(2).alter(forStep: 0), 1)     // do♯
        XCTAssertEqual(KeySignature(2).alter(forStep: 4), 0)
        XCTAssertEqual(KeySignature(-1).alter(forStep: 6), -1)   // si♭ en fa majeur
        XCTAssertEqual(KeySignature(-1).alter(forStep: 2), 0)
    }

    func testTemplates() {
        let acc = Score.make(template: .accordion, measures: 4)
        XCTAssertEqual(acc.parts.count, 1)
        XCTAssertEqual(acc.parts[0].staves.map(\.clef), [.treble, .bass])
        XCTAssertEqual(acc.parts[0].program, GM.accordion)
        XCTAssertEqual(acc.measures.last?.barline, .final)
        XCTAssertTrue(acc.staffRefs.allSatisfy { acc[$0].measures.count == 4 })
    }
}

final class EditingTests: XCTestCase {
    let rh = StaffRef(part: 0, staff: 0)
    func pos(_ m: Int, _ o: Fraction) -> TimePosition { TimePosition(staff: rh, measure: m, offset: o) }

    func testInsertSplitsMeasureRest() throws {
        var s = Score.make(template: .piano, measures: 2)
        try s.setEvent(at: pos(0, .zero), duration: Duration(.quarter), pitches: [Pitch(step: 0, octave: 5)])
        let evs = s.events(rh, measure: 0)
        XCTAssertEqual(evs.count, 3)        // noire + soupir + demi-pause
        XCTAssertFalse(evs[0].isRest)
        XCTAssertEqual(evs[1].duration, Duration(.quarter))
        XCTAssertEqual(evs[2].duration, Duration(.half))
        XCTAssertEqual(s.timedEvents(rh, measure: 0).last!.start, Fraction(1, 2))
    }

    func testMeasureAlwaysFull() throws {
        var s = Score.make(template: .piano, time: TimeSignature(3, 4), measures: 1)
        try s.setEvent(at: pos(0, Fraction(1, 4)), duration: Duration(.eighth), pitches: [Pitch(step: 2, octave: 5)])
        let total = s.timedEvents(rh, measure: 0).reduce(Fraction.zero) { $0 + $1.event.length(measureLength: Fraction(3, 4)) }
        XCTAssertEqual(total, Fraction(3, 4))
    }

    func testDoesNotFit() {
        var s = Score.make(template: .piano, time: TimeSignature(3, 4), measures: 1)
        XCTAssertThrowsError(try s.setEvent(at: pos(0, Fraction(1, 2)), duration: Duration(.half), pitches: [Pitch(step: 0, octave: 5)]))
    }

    func testOverwriteShortensPreviousNote() throws {
        var s = Score.make(template: .piano, measures: 1)
        try s.setEvent(at: pos(0, .zero), duration: Duration(.whole), pitches: [Pitch(step: 0, octave: 5)])
        try s.setEvent(at: pos(0, Fraction(1, 2)), duration: Duration(.quarter), pitches: [Pitch(step: 1, octave: 5)])
        let evs = s.events(rh, measure: 0)
        XCTAssertEqual(evs.map(\.duration.base), [.half, .quarter, .quarter])
        XCTAssertEqual(evs[0].notes.first?.pitch, Pitch(step: 0, octave: 5))
        XCTAssertTrue(evs[2].isRest)
    }

    func testMakeRestCompactsToMeasureRest() throws {
        var s = Score.make(template: .piano, measures: 1)
        let r = try s.setEvent(at: pos(0, .zero), duration: Duration(.quarter), pitches: [Pitch(step: 0, octave: 5)])
        try s.makeRest(r)
        XCTAssertEqual(s.events(rh, measure: 0).count, 1)
        XCTAssertTrue(s.events(rh, measure: 0)[0].isMeasureRest)
    }

    func testChordAndTranspose() throws {
        var s = Score.make(template: .piano, measures: 1)
        let r = try s.setEvent(at: pos(0, .zero), duration: Duration(.half), pitches: [Pitch(step: 0, octave: 5)])
        try s.addPitch(Pitch(step: 2, octave: 5), to: r)
        XCTAssertEqual(s.locate(r)?.event.notes.count, 2)
        try s.transposeChromatic(r, semitones: 1)
        XCTAssertEqual(s.locate(r)?.event.notes.map(\.pitch.midi), [73, 77])
        try s.transposeDiatonic(r, steps: 7)
        XCTAssertEqual(s.locate(r)?.event.notes.map(\.pitch.midi), [85, 89])
    }

    func testTripletFillsGroupWithTripletRests() throws {
        var s = Score.make(template: .piano, time: TimeSignature(3, 4), measures: 1)
        let t = Tuplet(actual: 3, normal: 2)
        try s.setEvent(at: pos(0, .zero), duration: Duration(.eighth), pitches: [Pitch(step: 0, octave: 5)], tuplet: t)
        let evs = s.timedEvents(rh, measure: 0)
        XCTAssertEqual(evs.prefix(3).map { $0.event.tuplet }, [t, t, t])
        // 3/4 : triolet sur le 1er temps, puis deux soupirs (2e et 3e temps).
        XCTAssertEqual(evs.map(\.start), [.zero, Fraction(1, 12), Fraction(2, 12), Fraction(1, 4), Fraction(1, 2)])
        XCTAssertEqual(evs.last?.event.duration, Duration(.quarter))
        XCTAssertNil(evs.last?.event.tuplet)
        try s.setEvent(at: pos(0, Fraction(1, 12)), duration: Duration(.eighth), pitches: [Pitch(step: 1, octave: 5)], tuplet: t)
        XCTAssertEqual(s.events(rh, measure: 0).filter { !$0.isRest }.count, 2)
    }

    func testDotAndDuration() throws {
        var s = Score.make(template: .piano, measures: 1)
        var r = try s.setEvent(at: pos(0, .zero), duration: Duration(.quarter), pitches: [Pitch(step: 0, octave: 5)])
        r = try s.toggleDot(r)
        XCTAssertEqual(s.locate(r)?.event.duration, Duration(.quarter, dots: 1))
        r = try s.changeDuration(r, to: Duration(.half))
        XCTAssertEqual(s.locate(r)?.event.length(measureLength: Fraction(1)), Fraction(1, 2))
    }

    func testInsertAndDeleteMeasures() throws {
        var s = Score.make(template: .accordion, measures: 3)
        s.appendMeasures(2)
        XCTAssertEqual(s.measureCount, 5)
        XCTAssertEqual(s.measures.last?.barline, .final)
        XCTAssertEqual(s.measures.filter { $0.barline == .final }.count, 1)
        XCTAssertEqual(s.measures[2].barline, .regular)
        s.insertMeasures(at: 0)
        XCTAssertEqual(s.measureCount, 6)
        XCTAssertTrue(s.staffRefs.allSatisfy { s[$0].measures.count == 6 })
        try s.deleteMeasures(5..<6)
        XCTAssertEqual(s.measures.last?.barline, .final)
        XCTAssertThrowsError(try s.deleteMeasures(0..<5))
    }

    func testNeighborAcrossMeasures() throws {
        var s = Score.make(template: .piano, measures: 2)
        let r = try s.setEvent(at: pos(0, Fraction(3, 4)), duration: Duration(.quarter), pitches: [Pitch(step: 0, octave: 5)])
        let n = s.neighbor(of: r, forward: true)
        XCTAssertEqual(n?.measure, 1)
    }

    func testLetterPitchNearest() {
        let s = Score.make(template: .piano, key: KeySignature(1), measures: 1)
        let ref = Pitch(step: 0, octave: 5).diatonic
        XCTAssertEqual(s.pitch(letter: 6, near: ref, measure: 0), Pitch(step: 6, octave: 4))  // si sous le do
        XCTAssertEqual(s.pitch(letter: 3, near: ref, measure: 0), Pitch(step: 3, alter: 1, octave: 5)) // fa♯ (armure)
    }
}
