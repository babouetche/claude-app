import AppKit
import PartiCore

/// Auto-test sans interface : `PartiMac --selftest <dossier>`.
/// Rejoue le scénario du jalon 1 : partition piano, saisie, PDF, MIDI, enregistrement, réouverture.
enum SelfTest {
    static func run(outputDir: String) -> Int32 {
        var failures = 0
        func check(_ ok: Bool, _ label: String) {
            print(ok ? "✅ \(label)" : "❌ \(label)")
            if !ok { failures += 1 }
        }
        let out = URL(fileURLWithPath: outputDir)
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        Fonts.register()
        check(NSFont(name: "Bravura", size: 20) != nil, "Police Bravura chargée")
        check(Player.soundBankURL != nil, "Banque de sons trouvée : \(Player.soundBankURL?.lastPathComponent ?? "aucune")")

        for template in [ScoreTemplate.piano, .accordion] {
            var score = Score.make(template: template, title: template == .piano ? "Au clair de la lune" : "Petite valse",
                                   composer: "Auto-test", time: template == .piano ? TimeSignature(4, 4) : TimeSignature(3, 4),
                                   key: KeySignature(template == .piano ? 0 : -1), tempo: 110, measures: 8)
            let rh = StaffRef(part: 0, staff: 0), lh = StaffRef(part: 0, staff: 1)
            func put(_ staff: StaffRef, _ m: Int, _ off: Fraction, _ d: Duration, _ p: [Pitch], tie: Bool = false) {
                do { try score.setEvent(at: TimePosition(staff: staff, measure: m, offset: off), duration: d, pitches: p, tie: tie) }
                catch { print("  saisie impossible : \(error.localizedDescription)"); failures += 1 }
            }
            let c5 = Pitch(step: 0, octave: 5), d5 = Pitch(step: 1, octave: 5), e5 = Pitch(step: 2, octave: 5)
            let q = Duration(.quarter), h = Duration(.half), e8 = Duration(.eighth)
            put(rh, 0, .zero, q, [c5]); put(rh, 0, Fraction(1, 4), q, [c5]); put(rh, 0, Fraction(1, 2), e8, [d5]); put(rh, 0, Fraction(5, 8), e8, [Pitch(step: 3, alter: 1, octave: 5)])
            put(rh, 1, .zero, h, [e5]); put(rh, 1, Fraction(1, 2), e8, [d5])
            put(rh, 2, .zero, Duration(.sixteenth), [c5]); put(rh, 2, Fraction(1, 16), Duration(.sixteenth), [d5]); put(rh, 2, Fraction(1, 8), e8, [e5])
            put(rh, 2, Fraction(1, 4), q, [Pitch(step: 6, alter: -1, octave: 4)], tie: true); put(rh, 3, .zero, q, [Pitch(step: 6, alter: -1, octave: 4)])
            put(lh, 0, .zero, h, [Pitch(step: 0, octave: 3), Pitch(step: 2, octave: 3), Pitch(step: 4, octave: 3)])
            put(lh, 1, .zero, q, [Pitch(step: 4, octave: 2)]); put(lh, 1, Fraction(1, 4), q, [Pitch(step: 0, octave: 2)])
            score.appendMeasures(2)
            if template == .accordion {
                // Symboles du jalon 2 : articulations, liaison de phrasé, soufflet, nuance, triolets, case de fin.
                let refs = score.events(rh, measure: 0).filter { !$0.isRest }.map { EventRef(staff: rh, measure: 0, eventID: $0.id) }
                if refs.count >= 3 {
                    try? score.toggleArticulation(.staccato, on: refs[0])
                    try? score.toggleArticulation(.accent, on: refs[1])
                    try? score.addSpanner(.slur, from: refs[0], to: refs[2])
                    score.addAnnotation(Annotation(staff: rh, measure: 0, offset: .zero, text: "mf", above: false, staffPosition: -5, glyph: 0xE52D))
                }
                let m1 = score.events(rh, measure: 1).filter { !$0.isRest }.map { EventRef(staff: rh, measure: 1, eventID: $0.id) }
                if m1.count >= 2 { try? score.addSpanner(.crescendo, from: m1[0], to: m1[1]) }
                let t = Tuplet(actual: 3, normal: 2)
                for k in 0..<3 {
                    _ = try? score.setEvent(at: TimePosition(staff: rh, measure: 4, offset: Fraction(k, 12)), duration: Duration(.eighth), pitches: [Pitch(step: k, octave: 5)], tuplet: t)
                }
                score.measures[3].volta = 1
                score.measures[3].barline = .repeatEnd
                score.measures[4].volta = 2
            }

            let name = template.rawValue
            let layout = LayoutEngine().layout(score)
            check(!layout.pages.isEmpty && layout.pages[0].items.count > 50, "[\(name)] mise en page : \(layout.pages.count) page(s), \(layout.pages[0].items.count) éléments")

            let pdf = Exporter.pdfData(layout)
            check(pdf.starts(with: Array("%PDF".utf8)), "[\(name)] export PDF (\(pdf.count) octets)")
            try? pdf.write(to: out.appendingPathComponent("\(name).pdf"))

            let midi = MIDIExporter.data(for: score)
            try? midi.write(to: out.appendingPathComponent("\(name).mid"))
            let expected = score.staffRefs.reduce(0) { $0 + MIDIExporter.playedNotes(score, staff: $1).count }
            if let read = try? MIDIReader.read(midi) {
                let n = read.tracks.reduce(0) { $0 + $1.notes.count }
                check(n == expected && n > 0, "[\(name)] export MIDI relu : \(n) notes (attendu \(expected))")
            } else { check(false, "[\(name)] export MIDI relisible") }
            check((try? MIDIImporter.score(from: midi)) != nil, "[\(name)] import MIDI")

            do {
                let data = try ScoreCodec.encode(score)
                let url = out.appendingPathComponent("\(name).partimac")
                try data.write(to: url)
                let back = try ScoreCodec.decode(Data(contentsOf: url))
                check(back == score, "[\(name)] enregistrement puis réouverture identiques")
            } catch { check(false, "[\(name)] enregistrement : \(error.localizedDescription)") }

            if let png = Exporter.png(layout.pages[0], scale: 1) {
                try? png.write(to: out.appendingPathComponent("\(name)-page1.png"))
            }

            // Capture de la fenêtre réelle.
            if template == .accordion {
                _ = NSApplication.shared
                let doc = ScoreDocument()
                doc.importedContent = true
                doc.score = score
                let wc = ScoreWindowController(document: doc)
                if let view = wc.window?.contentView {
                    wc.window?.setContentSize(NSSize(width: 1180, height: 860))
                    view.layoutSubtreeIfNeeded()
                    wc.scoreView.updateSize()
                    if let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
                        view.cacheDisplay(in: view.bounds, to: rep)
                        if let png = rep.representation(using: .png, properties: [:]) {
                            try? png.write(to: out.appendingPathComponent("window.png"))
                            check(true, "Fenêtre construite et capturée")
                            for (pi, panel) in wc.palettes.enumerated() {
                                guard let pv = panel.contentView, let prep = pv.bitmapImageRepForCachingDisplay(in: pv.bounds) else { continue }
                                pv.cacheDisplay(in: pv.bounds, to: prep)
                                try? prep.representation(using: .png, properties: [:])?.write(to: out.appendingPathComponent("palette-\(pi + 1)-\(panel.title).png"))
                            }
                            check(wc.palettes.count == 3, "Palettes Notes, Symboles et Graphismes construites")
                        }
                    }
                }
            }

            do {
                try Player.shared.play(score, fromBeat: 0)
                RunLoop.main.run(until: Date().addingTimeInterval(0.6))
                Player.shared.stop()
                print("✅ [\(name)] lecture audio démarrée")
            } catch {
                print("⚠️ [\(name)] lecture audio indisponible sur cette machine : \(error.localizedDescription)")
            }
        }
        print(failures == 0 ? "AUTO-TEST RÉUSSI" : "AUTO-TEST : \(failures) échec(s)")
        return failures == 0 ? 0 : 1
    }
}
