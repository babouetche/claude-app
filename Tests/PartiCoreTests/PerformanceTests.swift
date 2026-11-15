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
