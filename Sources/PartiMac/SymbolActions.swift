import AppKit
import PartiCore

/// Actions des palettes Symboles et Graphismes, et des boutons ajoutés à la palette Notes.
extension ScoreWindowController {

    private var doc: ScoreDocument { scoreDocument }

    /// Note sélectionnée, sinon message d'aide.
    private func requireSelection(_ hint: String = "Choisissez d'abord une note avec la flèche (outil Sélection).") -> EventRef? {
        if let s = state.selection { return s }
        showStatus(hint, isError: true)
        NSSound.beep()
        return nil
    }

    private func refocus() { window?.makeFirstResponder(scoreView) }

    /// Hauteurs (demi-interlignes depuis la ligne du bas) de la note sélectionnée.
    private func positions(of ref: EventRef) -> [Int] {
        let clef = doc.score[ref.staff].clef
        let ps = doc.score.locate(ref)?.event.notes.map { $0.pitch.diatonic - clef.bottomLineDiatonic } ?? []
        return ps.isEmpty ? [4] : ps
    }

    private func annotation(at ref: EventRef, text: String, above: Bool, position: Int?, glyph: UInt32? = nil) -> Annotation? {
        guard let loc = doc.score.locate(ref) else { return nil }
        return Annotation(staff: ref.staff, measure: ref.measure, offset: loc.start, text: text, above: above,
                          staffPosition: position, glyph: glyph)
    }

    // MARK: Palette Notes (compléments)

    @objc func tupletToggled(_ sender: NSButton) {
        state.tuplet = state.tuplet == nil ? Tuplet(actual: 3, normal: 2) : nil
        state.changed()
        showStatus(state.tuplet != nil ? "Triolets : les prochaines notes saisies seront des triolets (3 dans le temps de 2)." : "Triolets désactivés.", isError: false)
        refocus()
    }

    @objc func enharmonicChosen(_ sender: NSButton) {
        guard let sel = requireSelection() else { return }
        doc.apply("Enharmonie") { s in
            try s.modifyNotes(sel, noteIndex: state.selectedNote) { n in
                let sharp = Pitch.fromMIDI(n.pitch.midi, preferFlats: false)
                let flat = Pitch.fromMIDI(n.pitch.midi, preferFlats: true)
                n.pitch = n.pitch == sharp ? flat : sharp
            }
        }
        refocus()
    }

    // MARK: Palette Symboles

    @objc func spannerChosen(_ sender: NSButton) {
        guard let start = requireSelection("Choisissez la 1re note avec la flèche, puis Maj+clic sur la dernière.") else { return }
        let kinds: [SpannerKind] = [.slur, .crescendo, .diminuendo]
        let kind = kinds[max(0, min(2, sender.tag))]
        let end = state.rangeEnd ?? doc.score.neighbor(of: start, forward: true)
        guard let end, end.eventID != start.eventID else { showStatus("Il faut au moins deux notes.", isError: true); return }
        doc.apply(kind == .slur ? "Liaison de phrasé" : "Soufflet") { try $0.addSpanner(kind, from: start, to: end) }
        refocus()
    }

    @objc func eraseSymbols(_ sender: NSButton) {
        guard let sel = requireSelection() else { return }
        let refs = scoreView.selectedRange()
        doc.apply("Effacer les signes") { s in
            for r in refs {
                s.removeSpanners(touching: r)
                if let loc = s.locate(r) {
                    try? s.modifyEvent(r) { $0.articulations = nil }
                    s.annotations.removeAll { $0.staff == r.staff && $0.measure == r.measure && $0.offset == loc.start && $0.glyph != nil }
                }
            }
        }
        _ = sel
        refocus()
    }

    @objc func dynamicChosen(_ sender: NSButton) {
        guard let sel = requireSelection() else { return }
        let d = Dynamics.all[max(0, min(Dynamics.all.count - 1, sender.tag))]
        let low = positions(of: sel).min() ?? 0
        guard let loc = doc.score.locate(sel) else { return }
        doc.apply("Nuance \(d.name)") { s in
            // Une seule nuance par note.
            s.annotations.removeAll { a in a.staff == sel.staff && a.measure == sel.measure && a.offset == loc.start && Dynamics.velocity(a.text) != nil }
            s.addAnnotation(Annotation(staff: sel.staff, measure: sel.measure, offset: loc.start, text: d.name, above: false,
                                       staffPosition: min(-4, low - 4), glyph: d.glyph))
        }
        refocus()
    }

    @objc func articulationChosen(_ sender: NSButton) {
        guard requireSelection() != nil else { return }
        let a = Articulation.allCases[max(0, min(Articulation.allCases.count - 1, sender.tag))]
        let refs = scoreView.selectedRange()
        doc.apply(a.frenchName) { s in for r in refs { try? s.toggleArticulation(a, on: r) } }
        refocus()
    }

    private var currentMeasure: Int? { state.selection?.measure ?? state.cursor?.measure }

    @objc func repeatChosen(_ sender: NSButton) {
        guard let m = currentMeasure else { showStatus("Choisissez d'abord une note dans la mesure.", isError: true); return }
        switch sender.tag {
        case 0: doc.apply("Reprise (début)") { $0.toggleRepeatStart(m) }
        case 1: doc.apply("Reprise (fin)") { $0.toggleRepeatEnd(m) }
        default:
            doc.apply("Case de fin") { $0.cycleVolta(m) }
            let v = doc.score.measures[m].volta
            showStatus(v == 0 ? "Case de fin retirée." : "Case de fin : " + (0..<8).filter { v & (1 << $0) != 0 }.map { "\($0 + 1)" }.joined(separator: " et ") + "e fois. Cliquez encore pour changer.", isError: false)
        }
        refocus()
    }

    @objc func markChosen(_ sender: NSButton) {
        guard let sel = requireSelection() else { return }
        let high = positions(of: sel).max() ?? 8, low = positions(of: sel).min() ?? 0
        let above = max(12, high + 4)
        let item: Annotation?
        switch sender.tag {
        case 0: item = annotation(at: sel, text: "Segno", above: true, position: above, glyph: 0xE047)
        case 1: item = annotation(at: sel, text: "Coda", above: true, position: above, glyph: 0xE048)
        case 2: item = annotation(at: sel, text: "D.C.", above: true, position: above)
        case 3: item = annotation(at: sel, text: "D.S.", above: true, position: above)
        case 4: item = annotation(at: sel, text: "Fine", above: true, position: above)
        case 5: item = annotation(at: sel, text: "⊗", above: false, position: min(-3, low - 3), glyph: 0xE0B3)
        case 6: item = annotation(at: sel, text: "Pousser", above: true, position: above, glyph: 0xE8CB)
        case 7: item = annotation(at: sel, text: "Tirer", above: true, position: above, glyph: 0xE8CC)
        case 9: item = annotation(at: sel, text: "Césure", above: true, position: max(10, high + 2), glyph: 0xE4D1)
        default: item = annotation(at: sel, text: "Respiration", above: true, position: max(10, high + 2), glyph: 0xE4CE)
        }
        if let a = item { doc.apply("Ajouter « \(a.text) »") { $0.addAnnotation(a) } }
        refocus()
    }

    // MARK: Palette Graphismes

    @objc func textChosen(_ sender: NSButton) {
        guard let sel = requireSelection() else { return }
        let titles = ["Texte libre", "Accord", "Basse", "Doigté"]
        let examples = ["ex. : Reprise, rall., Musette", "ex. : SOL7, DO, REmin, Am7", "ex. : Do, Sol, Fa", "ex. : 1, 2, 3, 4, 5"]
        let kind = max(0, min(3, sender.tag))
        askText(titles[kind], placeholder: examples[kind], initial: "") { [weak self] text in
            guard let self, !text.isEmpty else { return }
            let high = self.positions(of: sel).max() ?? 8, low = self.positions(of: sel).min() ?? 0
            let a: Annotation?
            switch kind {
            case 0: a = self.annotation(at: sel, text: text, above: true, position: max(13, high + 5))
            case 1: a = self.annotation(at: sel, text: text, above: false, position: min(-5, low - 5))
            case 2: a = self.annotation(at: sel, text: text, above: false, position: min(-1, low - 2))
            default: a = self.annotation(at: sel, text: text, above: true, position: max(11, high + 3))
            }
            if let a { self.doc.apply("Ajouter « \(text) »") { $0.addAnnotation(a) } }
            self.refocus()
        }
    }

    @objc func deleteAnnotation(_ sender: Any?) {
        guard let id = state.selectedAnnotation else {
            showStatus("Cliquez d'abord sur le texte ou le signe à supprimer, avec la flèche.", isError: true)
            return
        }
        doc.apply("Supprimer le texte") { $0.removeAnnotation(id) }
        state.selectedAnnotation = nil
        state.changed()
        refocus()
    }

    /// Double-clic sur un texte : le modifier.
    func editAnnotation(_ id: UUID) {
        guard let a = doc.score.annotations.first(where: { $0.id == id }), a.glyph == nil else { return }
        askText("Modifier le texte", placeholder: "", initial: a.text) { [weak self] text in
            guard let self else { return }
            if text.isEmpty { self.doc.apply("Supprimer le texte") { $0.removeAnnotation(id) } }
            else { self.doc.apply("Modifier le texte") { $0.setAnnotationText(id, text) } }
            self.refocus()
        }
    }

    func askText(_ title: String, placeholder: String, initial: String, completion: @escaping (String) -> Void) {
        guard let window else { return }
        let alert = NSAlert()
        alert.messageText = title
        let field = NSTextField(string: initial)
        field.placeholderString = placeholder
        field.frame = NSRect(x: 0, y: 0, width: 260, height: 24)
        alert.accessoryView = field
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Annuler")
        alert.window.initialFirstResponder = field
        alert.beginSheetModal(for: window) { r in
            if r == .alertFirstButtonReturn { completion(field.stringValue.trimmingCharacters(in: .whitespaces)) }
        }
    }
}
