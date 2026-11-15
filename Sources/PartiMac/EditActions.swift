import AppKit
import PartiCore

/// Édition rapide : mesures copiées, transposition, voix, petites notes.
extension ScoreWindowController {

    /// Mesures de la sélection (de la note choisie jusqu'au Maj+clic), sinon celle du curseur.
    private var selectedMeasures: Range<Int>? {
        if let a = state.selection {
            let b = state.rangeEnd?.measure ?? a.measure
            return min(a.measure, b)..<(max(a.measure, b) + 1)
        }
        if let c = state.cursor { return c.measure..<(c.measure + 1) }
        return nil
    }

    @objc func copyMeasures(_ sender: Any?) {
        guard let r = selectedMeasures else {
            showStatus("Choisissez une note dans la 1re mesure, puis Maj+clic dans la dernière.", isError: true); NSSound.beep(); return
        }
        AppClipboard.content = .measures(scoreDocument.score.copyMeasures(r))
        showStatus(r.count == 1 ? "Mesure \(r.lowerBound + 1) copiée. Choisissez où coller (⌘V remplace, ⌥⌘V insère)."
                                : "Mesures \(r.lowerBound + 1) à \(r.upperBound) copiées. ⌘V remplace, ⌥⌘V insère.", isError: false)
    }

    @objc func insertCopiedMeasures(_ sender: Any?) {
        guard case .measures(let clip)? = AppClipboard.content else {
            showStatus("Copiez d'abord des mesures (⌥⌘C).", isError: true); NSSound.beep(); return
        }
        let m = state.selection?.measure ?? state.cursor?.measure ?? scoreDocument.score.measureCount
        scoreDocument.apply("Insérer les mesures") { $0.pasteMeasures(clip, at: m, insert: true) }
        state.selection = nil; state.rangeEnd = nil; state.changed()
        scoreView.relayout()
        showStatus("\(clip.count) mesure\(clip.count > 1 ? "s" : "") insérée\(clip.count > 1 ? "s" : "") avant la mesure \(m + 1).", isError: false)
    }

    @objc func pasteCopied(_ sender: Any?) { scoreView.paste(sender) }
    @objc func copySelection(_ sender: Any?) { scoreView.copy(sender) }

    // MARK: Transposer

    @objc func transposeDialog(_ sender: Any?) {
        guard let window else { return }
        let alert = NSAlert()
        alert.messageText = "Transposer toute la partition"
        alert.informativeText = "Les notes et les armures changent ensemble (⌘Z pour revenir en arrière)."
        let popup = NSPopUpButton()
        let names = ["", "1 demi-ton", "1 ton", "1 ton ½ (tierce mineure)", "2 tons (tierce majeure)", "2 tons ½ (quarte)",
                     "3 tons (triton)", "3 tons ½ (quinte)", "4 tons", "4 tons ½ (sixte)", "5 tons", "5 tons ½", "1 octave"]
        for s in (1...12).reversed() { popup.addItem(withTitle: "Monter de \(names[s])"); popup.lastItem?.tag = s }
        for s in 1...12 { popup.addItem(withTitle: "Descendre de \(names[s])"); popup.lastItem?.tag = -s }
        popup.selectItem(withTag: 2)
        popup.frame = NSRect(x: 0, y: 0, width: 300, height: 26)
        alert.accessoryView = popup
        alert.addButton(withTitle: "Transposer"); alert.addButton(withTitle: "Annuler")
        alert.beginSheetModal(for: window) { [weak self] r in
            guard r == .alertFirstButtonReturn, let self else { return }
            let s = popup.selectedTag()
            self.scoreDocument.apply("Transposer") { $0.transposeAll(semitones: s) }
            self.scoreView.relayout()
            let k = self.scoreDocument.score.measures.first?.key.frenchName ?? ""
            self.showStatus("Partition transposée. Nouvelle tonalité : \(k).", isError: false)
            self.window?.makeFirstResponder(self.scoreView)
        }
    }

    // MARK: Voix

    @objc func voiceChosen(_ sender: NSButton) {
        state.voice = max(0, min(1, sender.tag))
        if let sel = state.selection, sel.voice != state.voice { state.selection = nil; state.rangeEnd = nil }
        state.cursor = state.cursor.map { TimePosition(staff: $0.staff, measure: $0.measure, voice: state.voice, offset: $0.offset) }
        state.tool = .note
        state.changed()
        showStatus(state.voice == 0 ? "Voix 1 : saisie normale (hampes en haut quand il y a deux voix)."
                                    : "Voix 2 : les notes s'ajoutent sous la voix 1, hampes en bas. Cliquez sur la portée pour les poser.", isError: false)
        window?.makeFirstResponder(scoreView)
    }

    // MARK: Petites notes

    @objc func graceChosen(_ sender: NSButton) {
        guard let sel = state.selection, let e = scoreDocument.score.locate(sel)?.event, !e.isRest else {
            showStatus("Choisissez d'abord une note avec la flèche.", isError: true); NSSound.beep(); return
        }
        scoreDocument.apply("Petite note") { try $0.addGraceNote(sel, above: sender.tag == 0) }
        scoreView.relayout()
        showStatus("Petite note ajoutée. Recliquez pour en ajouter une autre ; la gomme des signes les retire.", isError: false)
        window?.makeFirstResponder(scoreView)
    }
}
