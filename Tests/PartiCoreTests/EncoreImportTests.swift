import XCTest
@testable import PartiCore

/// Fichier Encore synthétique minimal (format « SCO5 », gros-boutiste).
final class EncoreImportTests: XCTestCase {
    func be16(_ v: Int) -> [UInt8] { [UInt8((v >> 8) & 0xFF), UInt8(v & 0xFF)] }
    func be32(_ v: Int) -> [UInt8] { be16(v >> 16) + be16(v & 0xFFFF) }
    func chunk(_ tag: String, _ body: [UInt8]) -> [UInt8] { Array(tag.utf8) + be32(body.count) + body }

    func makeFile() -> Data {
        var header = [UInt8](repeating: 0, count: 0xC2)
        header[0...3] = ArraySlice(Array("SCO5".utf8))
        header[0x32] = 1   // 1 instrument
        header[0x33] = 1   // 1 portée par système
        // LINE : clé de sol, armure code 10 (la majeur, 3 dièses).
        var line = [UInt8](repeating: 0, count: 13 + 30)
        line[13 + 14] = 0
        line[13 + 15] = 10
        // MEAS : 4/4, tempo 120, barre finale ; une noire la4 sur le 1er temps, un texte « Am » au-dessus.
        var meas = [UInt8](repeating: 0, count: 0x36)
        meas[0...1] = ArraySlice(be16(120))
        meas[6...7] = ArraySlice(be16(960))
        meas[8] = 4; meas[9] = 4; meas[13] = 5
        var note = [UInt8](repeating: 0, count: 28)
        note[0...1] = ArraySlice(be16(0)); note[2] = 0x90; note[3] = 28; note[4] = 0
        note[5] = 3        // noire
        note[15] = 69      // la4
        var text = [UInt8](repeating: 0, count: 78)
        text[0...1] = ArraySlice(be16(0)); text[2] = 0x50; text[3] = 78; text[5] = 0x1E
        text[12...13] = ArraySlice(be16(10))   // au-dessus de la portée
        text[32...33] = ArraySlice(be16(0))    // texte n° 0
        let elems = note + text + [0xFF, 0xFF]
        let measBody = meas + elems
        // TEXT : un texte « Am ».
        let t = Array("Am".utf8) + [0]
        let textBody: [UInt8] = [0, 0] + be16(1) + [0, 0, 0, 0] + be16(14 + t.count) + [UInt8](repeating: 0, count: 14) + t
        // La taille déclarée d'une mesure exclut l'en-tête de 0x36 octets.
        let measChunk = Array("MEAS".utf8) + be32(elems.count) + measBody
        return Data(header + chunk("LINE", line) + measChunk + chunk("TEXT", textBody))
    }

    func testImportSyntheticFile() throws {
        let (score, report) = try EncoreImporter.importScore(from: makeFile(), fileName: "essai")
        XCTAssertEqual(score.measureCount, 1)
        XCTAssertEqual(score.measures[0].time, TimeSignature(4, 4))
        XCTAssertEqual(score.measures[0].key.fifths, 3)
        XCTAssertEqual(score.measures[0].tempo, 120)
        XCTAssertEqual(score.measures[0].barline, .final)
        let rh = StaffRef(part: 0, staff: 0)
        let evs = score.events(rh, measure: 0)
        XCTAssertEqual(evs.first?.notes.first?.pitch, Pitch(step: 5, octave: 4))
        XCTAssertEqual(evs.first?.duration, Duration(.quarter))
        // Une seule noire dans la 1re mesure : c'est une levée (mesure incomplète).
        XCTAssertEqual(score.measureLength(0), Fraction(1, 4))
        XCTAssertEqual(score.timedEvents(rh, measure: 0).reduce(Fraction.zero) { $0 + $1.event.length(measureLength: score.measureLength(0)) }, Fraction(1, 4))
        XCTAssertEqual(score.annotations.first?.text, "Am")
        XCTAssertEqual(score.annotations.first?.above, true)
        XCTAssertEqual(report.notes, 1)
        XCTAssertEqual(score.parts[0].program, GM.accordion)
        // La partition importée se met en page et s'exporte en MIDI.
        XCTAssertFalse(LayoutEngine().layout(score).pages.isEmpty)
        XCTAssertEqual(MIDIExporter.playedNotes(score, staff: rh).map(\.key), [69])
    }

    func testSpelling() {
        let aMajor = KeySignature(3), fMajor = KeySignature(-1)
        XCTAssertEqual(EncoreImporter.spell(61, accidental: 0, key: aMajor), Pitch(step: 0, alter: 1, octave: 4))   // do♯
        XCTAssertEqual(EncoreImporter.spell(70, accidental: 0, key: fMajor), Pitch(step: 6, alter: -1, octave: 4))  // si♭
        XCTAssertEqual(EncoreImporter.spell(63, accidental: 2, key: aMajor), Pitch(step: 2, alter: -1, octave: 4))  // mi♭ explicite
    }

    func testRejectsNonEncore() {
        XCTAssertThrowsError(try EncoreImporter.score(from: Data("bonjour".utf8)))
    }

    func testOldDocumentStillDecodes() throws {
        // Un document enregistré avant l'ajout des annotations/reprises doit toujours s'ouvrir.
        var json = try JSONSerialization.jsonObject(with: ScoreCodec.encode(Score.make(template: .accordion, measures: 2))) as! [String: Any]
        json.removeValue(forKey: "annotations")
        var measures = json["measures"] as! [[String: Any]]
        for i in measures.indices { measures[i].removeValue(forKey: "repeatStart") }
        json["measures"] = measures
        let data = try JSONSerialization.data(withJSONObject: json)
        XCTAssertEqual(try ScoreCodec.decode(data).measureCount, 2)
    }
}
