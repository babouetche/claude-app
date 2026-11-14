import AppKit
import PartiCore

/// Les 11 palettes d'Encore, en fenêtres flottantes : Outils, Notes, Clés, Graphismes, Nuances,
/// Marques 1, Marques 2, Symboles, Guitare, Expressions, Couleur.
extension ScoreWindowController {

    static let paletteNames = ["Outils", "Notes", "Clés", "Graphismes", "Nuances", "Marques 1",
                               "Marques 2", "Symboles", "Guitare", "Expressions", "Couleur"]

    static let defaultExpressions = ["rit.", "accel.", "a tempo", "cresc.", "dim.", "Musette", "Bandonéon",
                                     "Reprise", "Fin", "D.C. al Fine", "Tempo di valse", "Rubato"]

    static var expressions: [String] {
        get { UserDefaults.standard.stringArray(forKey: "expressions") ?? defaultExpressions }
        set { UserDefaults.standard.set(newValue, forKey: "expressions") }
    }

    static let colorChoices: [(name: String, rgb: UInt32?)] = [
        ("Noir", nil), ("Rouge", 0xD32F2F), ("Bleu", 0x1F66D6), ("Vert", 0x2E7D32),
        ("Orange", 0xEF6C00), ("Violet", 0x7B1FA2), ("Marron", 0x6D4C41), ("Gris", 0x8A8F98),
    ]

    func buildPalettes() -> [NSPanel] {
        // Outils
        let selectBtn = paletteButton(symbol: "cursorarrow", glyph: nil, tip: "Sélection : cliquer une note (Maj+clic pour une plage), la glisser pour changer sa hauteur (Échap)", tag: 0, action: #selector(toolChosen(_:)))
        let pencilBtn = paletteButton(symbol: "pencil", glyph: nil, tip: "Crayon : cliquer sur la portée pour poser une note (Échap)", tag: 1, action: #selector(toolChosen(_:)))
        toolButtons = [.select: selectBtn, .note: pencilBtn]
        let outils = paletteView([
            ("Outils", [
                selectBtn, pencilBtn,
                paletteButton(symbol: "eraser", glyph: nil, tip: "Gomme : effacer la sélection (notes, texte ou signe) — touche Suppr", tag: 0, action: #selector(eraseSelection(_:)), momentary: true),
                paletteButton(symbol: "magnifyingglass", glyph: nil, tip: "Loupe : agrandir (⌘ +)", tag: 0, action: #selector(zoomIn(_:)), momentary: true),
                paletteButton(symbol: "play.fill", glyph: nil, tip: "Écouter / arrêter (Espace)", tag: 0, action: #selector(togglePlayback(_:)), momentary: true),
                paletteButton(symbol: "backward.end.fill", glyph: nil, tip: "Écouter depuis le début", tag: 0, action: #selector(playFromStart(_:)), momentary: true),
            ]),
        ])

        // Notes
        var durations: [NSButton] = []
        for base in [DurationBase.whole, .half, .quarter, .eighth, .sixteenth, .thirtySecond] {
            let b = paletteButton(symbol: nil, glyph: SMuFL.metronomeNote(base), tip: "\(base.frenchName) — touche \(base.rawValue)", tag: base.rawValue, action: #selector(durationChosen(_:)))
            durationButtons[base] = b
            durations.append(b)
        }
        restButton = paletteButton(symbol: nil, glyph: SMuFL.rest(.quarter), tip: "Silences au lieu de notes — touche R (Entrée pose un silence)", tag: 0, action: #selector(restToggled(_:)))
        dotButton = paletteButton(symbol: nil, glyph: SMuFL.augmentationDot, tip: "Note pointée — touche .", tag: 0, action: #selector(dotToggled(_:)))
        tupletButton = labelButton("3", tip: "Triolet : les prochaines notes saisies sont des triolets", tag: 0, action: #selector(tupletToggled(_:)))
        let tie = paletteButton(symbol: "link", glyph: nil, tip: "Liaison de prolongation : lier la note sélectionnée à la suivante — touche T", tag: 0, action: #selector(tieChosen(_:)))
        let dflat = paletteButton(symbol: nil, glyph: SMuFL.doubleFlat, tip: "Double bémol", tag: -2, action: #selector(accidentalChosen(_:)))
        let flat = paletteButton(symbol: nil, glyph: SMuFL.flat, tip: "Bémol — touche -", tag: -1, action: #selector(accidentalChosen(_:)))
        let natural = paletteButton(symbol: nil, glyph: SMuFL.natural, tip: "Bécarre — touche =", tag: 0, action: #selector(accidentalChosen(_:)))
        let sharp = paletteButton(symbol: nil, glyph: SMuFL.sharp, tip: "Dièse — touche +", tag: 1, action: #selector(accidentalChosen(_:)))
        let dsharp = paletteButton(symbol: nil, glyph: SMuFL.doubleSharp, tip: "Double dièse", tag: 2, action: #selector(accidentalChosen(_:)))
        let enharm = labelButton("♯♭", tip: "Enharmonie : écrire la note sélectionnée autrement (do♯ ↔ ré♭)", tag: 0, action: #selector(enharmonicChosen(_:)), momentary: true)
        accidentalButtons = [-2: dflat, -1: flat, 0: natural, 1: sharp, 2: dsharp]
        let notes = paletteView([
            ("Durées", durations + [restButton, dotButton, tupletButton, tie]),
            ("Altérations", [dflat, flat, natural, sharp, dsharp, enharm]),
            ("Mesures", [
                paletteButton(symbol: "plus", glyph: nil, tip: "Ajouter une mesure à la fin (⌥⌘ M)", tag: 0, action: #selector(appendMeasure(_:)), momentary: true),
                paletteButton(symbol: "minus", glyph: nil, tip: "Supprimer la mesure sélectionnée", tag: 0, action: #selector(deleteMeasure(_:)), momentary: true),
            ]),
        ])

        // Clés
        let clefs: [(Clef, UInt32, String)] = [(.treble, 0xE050, "Clé de sol"), (.bass, 0xE062, "Clé de fa"), (.alto, 0xE05C, "Clé d'ut 3e ligne"),
                                               (.tenor, 0xE05C, "Clé d'ut 4e ligne"), (.treble8vb, 0xE052, "Clé de sol octaviée")]
        let cles = paletteView([
            ("Clés", clefs.enumerated().map { i, c in
                paletteButton(symbol: nil, glyph: c.1, tip: "\(c.2) pour la portée de la note sélectionnée", tag: i, action: #selector(clefChosen(_:)), momentary: true)
            } + [labelButton("♩=", tip: "Tempo de la mesure sélectionnée", tag: 0, action: #selector(tempoDialog(_:)), momentary: true)]),
            ("Armure, mesure", [
                labelButton("♯ ♭", tip: "Armure (tonalité) à partir de la mesure sélectionnée", tag: 0, action: #selector(keyDialog(_:)), momentary: true),
                labelButton("3/4", tip: "Chiffrage de mesure à partir de la mesure sélectionnée", tag: 0, action: #selector(timeDialog(_:)), momentary: true),
            ]),
        ])

        // Graphismes
        let graphismes = paletteView([
            ("Textes", [
                paletteButton(symbol: "textformat", glyph: nil, tip: "Texte libre au-dessus de la note sélectionnée", tag: 0, action: #selector(textChosen(_:)), momentary: true),
                labelButton("SOL7", tip: "Accord (en dessous, en gras) sous la note sélectionnée", tag: 1, action: #selector(textChosen(_:)), momentary: true),
                labelButton("Do", tip: "Basse (sous la portée) sous la note sélectionnée", tag: 2, action: #selector(textChosen(_:)), momentary: true),
                labelButton("1‑5", tip: "Doigté au-dessus de la note sélectionnée", tag: 3, action: #selector(textChosen(_:)), momentary: true),
                paletteButton(symbol: "info.circle", glyph: nil, tip: "Titre et compositeur", tag: 0, action: #selector(editScoreInfo(_:)), momentary: true),
                paletteButton(symbol: "trash", glyph: nil, tip: "Supprimer le texte ou le signe sélectionné", tag: 0, action: #selector(deleteAnnotation(_:)), momentary: true),
            ]),
        ])

        // Nuances
        let nuances = paletteView([
            ("Nuances", Dynamics.all.enumerated().map { i, d in
                paletteButton(symbol: nil, glyph: d.glyph, tip: "Nuance \(d.name) (jouée plus ou moins fort)", tag: i, action: #selector(dynamicChosen(_:)), momentary: true)
            } + [
                labelButton("<", tip: "Crescendo (soufflet) : 1re note, puis Maj+clic sur la dernière", tag: 1, action: #selector(spannerChosen(_:)), momentary: true),
                labelButton(">", tip: "Decrescendo (soufflet) : 1re note, puis Maj+clic sur la dernière", tag: 2, action: #selector(spannerChosen(_:)), momentary: true),
            ]),
        ])

        // Marques 1 : articulations
        let artGlyphs: [Articulation: UInt32] = [.staccato: 0xE4A2, .accent: 0xE4A0, .tenuto: 0xE4A4, .marcato: 0xE4AC, .fermata: 0xE4C0, .staccatissimo: 0xE4A6]
        let marques1 = paletteView([
            ("Articulations", Articulation.allCases.enumerated().map { i, a in
                paletteButton(symbol: nil, glyph: artGlyphs[a], tip: a.frenchName + " (sur la note ou la plage sélectionnée)", tag: i, action: #selector(articulationChosen(_:)), momentary: true)
            }),
        ])

        // Marques 2 : ornements, pédale
        let marques2 = paletteView([
            ("Ornements", ScoreWindowController.ornaments.enumerated().map { i, o in
                paletteButton(symbol: nil, glyph: o.glyph, tip: o.name, tag: i, action: #selector(ornamentChosen(_:)), momentary: true)
            }),
        ])

        // Symboles
        let symboles = paletteView([
            ("Liaisons", [
                labelButton("⌒", tip: "Liaison de phrasé : 1re note, puis Maj+clic sur la dernière", tag: 0, action: #selector(spannerChosen(_:)), momentary: true),
                paletteButton(symbol: "eraser", glyph: nil, tip: "Effacer liaisons, articulations et signes de la note sélectionnée", tag: 0, action: #selector(eraseSymbols(_:)), momentary: true),
            ]),
            ("Reprises", [
                paletteButton(symbol: nil, glyph: 0xE040, tip: "Barre de reprise au début de la mesure sélectionnée", tag: 0, action: #selector(repeatChosen(_:)), momentary: true),
                paletteButton(symbol: nil, glyph: 0xE041, tip: "Barre de reprise à la fin de la mesure sélectionnée", tag: 1, action: #selector(repeatChosen(_:)), momentary: true),
                labelButton("1. 2.", tip: "Case de 1re / 2e fois (cliquer plusieurs fois pour changer)", tag: 2, action: #selector(repeatChosen(_:)), momentary: true),
                paletteButton(symbol: nil, glyph: 0xE047, tip: "Segno", tag: 0, action: #selector(markChosen(_:)), momentary: true),
                paletteButton(symbol: nil, glyph: 0xE048, tip: "Coda", tag: 1, action: #selector(markChosen(_:)), momentary: true),
                labelButton("D.C.", tip: "Da capo", tag: 2, action: #selector(markChosen(_:)), momentary: true),
                labelButton("D.S.", tip: "Dal segno", tag: 3, action: #selector(markChosen(_:)), momentary: true),
                labelButton("Fine", tip: "Fine", tag: 4, action: #selector(markChosen(_:)), momentary: true),
                paletteButton(symbol: nil, glyph: 0xE4CE, tip: "Respiration", tag: 8, action: #selector(markChosen(_:)), momentary: true),
                paletteButton(symbol: nil, glyph: 0xE4D1, tip: "Césure", tag: 9, action: #selector(markChosen(_:)), momentary: true),
            ]),
            ("Accordéon", [
                paletteButton(symbol: nil, glyph: 0xE0B3, tip: "⊗ sous la note sélectionnée", tag: 5, action: #selector(markChosen(_:)), momentary: true),
                paletteButton(symbol: nil, glyph: 0xE8CB, tip: "Pousser le soufflet", tag: 6, action: #selector(markChosen(_:)), momentary: true),
                paletteButton(symbol: nil, glyph: 0xE8CC, tip: "Tirer le soufflet", tag: 7, action: #selector(markChosen(_:)), momentary: true),
                labelButton("Reg.", tip: "Registre (Musette, Bandonéon…) au-dessus de la note sélectionnée", tag: 0, action: #selector(registerChosen(_:)), momentary: true),
            ]),
        ])

        // Guitare : accords prêts à poser
        let guitare = paletteView([
            ("Accords", ScoreWindowController.chordPresets.map { name in
                labelButton(name, tip: "Accord \(name) sous la note sélectionnée", tag: 0, action: #selector(chordPresetChosen(_:)), momentary: true)
            } + [labelButton("Autre…", tip: "Autre accord (à taper)", tag: 1, action: #selector(textChosen(_:)), momentary: true)]),
        ])

        // Expressions et Couleur
        let expressions = expressionsView()
        let couleur = colorView()

        let views = [outils, notes, cles, graphismes, nuances, marques1, marques2, symboles, guitare, expressions, couleur]
        return zip(ScoreWindowController.paletteNames, views).map { name, view in
            makePanel(name, view, autosave: "Palette-" + name)
        }
    }

    static let ornaments: [(name: String, glyph: UInt32, playable: Bool)] = [
        ("Trille", 0xE566, false), ("Mordant", 0xE56D, false), ("Gruppetto", 0xE567, false), ("Trémolo", 0xE222, false),
        ("Arpège", 0xE63C, false), ("8va (une octave au-dessus)", 0xE511, false), ("Pédale (Ped.)", 0xE650, false), ("Lever la pédale (*)", 0xE655, false),
    ]

    static let chordPresets = ["DO", "DO7", "REmin", "RE7", "MImin", "MI7", "FA", "SOL", "SOL7", "LAmin", "SImin"]

    /// Palette Expressions : liste de textes réutilisables (modifiable).
    func expressionsView() -> NSView {
        var buttons: [NSButton] = ScoreWindowController.expressions.enumerated().map { i, text in
            labelButton(text, tip: "Poser « \(text) » au-dessus de la note sélectionnée (clic droit pour le retirer de la liste)", tag: i, action: #selector(expressionChosen(_:)), momentary: true)
        }
        buttons.append(labelButton("+ Nouvelle…", tip: "Ajouter une expression à la liste", tag: -1, action: #selector(expressionChosen(_:)), momentary: true))
        return listView(title: "Expressions", buttons: buttons)
    }

    func colorView() -> NSView {
        let buttons: [NSButton] = ScoreWindowController.colorChoices.enumerated().map { i, c in
            let b = NSButton(title: "", target: self, action: #selector(colorChosen(_:)))
            b.isBordered = false
            b.wantsLayer = true
            b.layer?.cornerRadius = 10
            b.layer?.borderWidth = 1
            b.layer?.borderColor = Theme.buttonBorder.cgColor
            let rgb = c.rgb ?? 0x111111
            b.layer?.backgroundColor = NSColor(srgbRed: CGFloat((rgb >> 16) & 0xFF) / 255, green: CGFloat((rgb >> 8) & 0xFF) / 255,
                                               blue: CGFloat(rgb & 0xFF) / 255, alpha: 1).cgColor
            b.tag = i
            b.toolTip = "Colorier la sélection en \(c.name.lowercased())"
            b.refusesFirstResponder = true
            return b
        }
        return paletteView([("Couleur", buttons)])
    }

    /// Palette à une colonne de boutons larges (textes).
    func listView(title: String, buttons: [NSButton]) -> NSView {
        let v = FlippedView()
        let l = sectionLabel(title)
        l.frame = NSRect(x: 8, y: 8, width: 140, height: 14)
        v.addSubview(l)
        var y: CGFloat = 25
        for b in buttons {
            b.frame = NSRect(x: 8, y: y, width: 140, height: 30)
            v.addSubview(b)
            y += 34
        }
        v.frame = NSRect(x: 0, y: 0, width: 156, height: y + 6)
        v.wantsLayer = true
        v.layer?.backgroundColor = Theme.palette.cgColor
        return v
    }

    // MARK: Actions des nouvelles palettes

    private var editDoc: ScoreDocument { scoreDocument }

    private var targetMeasure: Int { state.selection?.measure ?? state.cursor?.measure ?? 0 }
    private var targetStaff: StaffRef { state.selection?.staff ?? state.cursor?.staff ?? StaffRef(part: 0, staff: 0) }

    @objc func eraseSelection(_ sender: Any?) {
        if let id = state.selectedAnnotation {
            editDoc.apply("Supprimer le texte") { $0.removeAnnotation(id) }
            state.selectedAnnotation = nil
        } else {
            let refs = scoreView.selectedRange()
            guard !refs.isEmpty else { showStatus("Choisissez d'abord ce qu'il faut effacer, avec la flèche.", isError: true); return }
            editDoc.apply("Effacer") { s in for r in refs { s.removeSpanners(touching: r); try? s.makeRest(r) } }
            state.rangeEnd = nil
        }
        state.changed()
        window?.makeFirstResponder(scoreView)
    }

    @objc func clefChosen(_ sender: NSButton) {
        let clefs: [Clef] = [.treble, .bass, .alto, .tenor, .treble8vb]
        let c = clefs[max(0, min(clefs.count - 1, sender.tag))]
        let staff = targetStaff
        editDoc.apply(c.frenchName) { $0.setClef(c, staff: staff) }
        showStatus("\(c.frenchName) pour toute la portée.", isError: false)
        window?.makeFirstResponder(scoreView)
    }

    @objc func keyDialog(_ sender: Any?) {
        guard let window else { return }
        let m = targetMeasure
        let alert = NSAlert()
        alert.messageText = "Armure à partir de la mesure \(m + 1)"
        let popup = NSPopUpButton()
        for f in (-7...7).reversed() { popup.addItem(withTitle: KeySignature(f).frenchName); popup.lastItem?.tag = f }
        popup.selectItem(withTag: editDoc.score.measures[m].key.fifths)
        popup.frame = NSRect(x: 0, y: 0, width: 340, height: 26)
        alert.accessoryView = popup
        alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Annuler")
        alert.beginSheetModal(for: window) { [weak self] r in
            guard r == .alertFirstButtonReturn, let self else { return }
            self.editDoc.apply("Armure") { $0.setKey(KeySignature(popup.selectedTag()), from: m) }
            self.window?.makeFirstResponder(self.scoreView)
        }
    }

    @objc func timeDialog(_ sender: Any?) {
        guard let window else { return }
        let m = targetMeasure
        let alert = NSAlert()
        alert.messageText = "Chiffrage de mesure à partir de la mesure \(m + 1)"
        alert.informativeText = "Les notes qui ne tiennent plus dans les mesures raccourcies sont retirées (⌘Z pour annuler)."
        let popup = NSPopUpButton()
        for t in NewScoreAssistant.times { popup.addItem(withTitle: t.description) }
        if let i = NewScoreAssistant.times.firstIndex(of: editDoc.score.measures[m].time) { popup.selectItem(at: i) }
        popup.frame = NSRect(x: 0, y: 0, width: 120, height: 26)
        alert.accessoryView = popup
        alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Annuler")
        alert.beginSheetModal(for: window) { [weak self] r in
            guard r == .alertFirstButtonReturn, let self else { return }
            let t = NewScoreAssistant.times[max(0, popup.indexOfSelectedItem)]
            self.editDoc.apply("Chiffrage de mesure") { $0.setTime(t, from: m) }
            self.window?.makeFirstResponder(self.scoreView)
        }
    }

    @objc func tempoDialog(_ sender: Any?) {
        let m = targetMeasure
        askText("Tempo à partir de la mesure \(m + 1) (noires par minute)", placeholder: "ex. : 120",
                initial: String(Int(editDoc.score.tempo(at: m)))) { [weak self] text in
            guard let self, let bpm = Double(text.replacingOccurrences(of: ",", with: ".")), bpm >= 20 else { return }
            self.editDoc.apply("Tempo") { $0.setTempo(bpm, at: m) }
        }
    }

    @objc func ornamentChosen(_ sender: NSButton) {
        guard let sel = state.selection, let loc = editDoc.score.locate(sel) else {
            showStatus("Choisissez d'abord une note avec la flèche.", isError: true); return
        }
        let o = ScoreWindowController.ornaments[max(0, min(ScoreWindowController.ornaments.count - 1, sender.tag))]
        let clef = editDoc.score[sel.staff].clef
        let high = loc.event.notes.map { $0.pitch.diatonic - clef.bottomLineDiatonic }.max() ?? 8
        let low = loc.event.notes.map { $0.pitch.diatonic - clef.bottomLineDiatonic }.min() ?? 0
        let isPedal = o.glyph == 0xE650 || o.glyph == 0xE655
        let a = Annotation(staff: sel.staff, measure: sel.measure, offset: loc.start, text: o.name, above: !isPedal,
                           staffPosition: isPedal ? min(-6, low - 6) : max(11, high + 4), glyph: o.glyph)
        editDoc.apply(o.name) { $0.addAnnotation(a) }
        window?.makeFirstResponder(scoreView)
    }

    @objc func registerChosen(_ sender: NSButton) {
        guard let sel = state.selection, let loc = editDoc.score.locate(sel) else {
            showStatus("Choisissez d'abord une note avec la flèche.", isError: true); return
        }
        askText("Registre", placeholder: "ex. : Musette, Bandonéon, Clarinette", initial: "Musette") { [weak self] text in
            guard let self, !text.isEmpty else { return }
            self.editDoc.apply("Registre") { $0.addAnnotation(Annotation(staff: sel.staff, measure: sel.measure, offset: loc.start, text: text, above: true, staffPosition: 14)) }
        }
    }

    @objc func chordPresetChosen(_ sender: NSButton) {
        guard let sel = state.selection, let loc = editDoc.score.locate(sel) else {
            showStatus("Choisissez d'abord une note avec la flèche.", isError: true); return
        }
        let text = labels[ObjectIdentifier(sender)] ?? "DO"
        let clef = editDoc.score[sel.staff].clef
        let low = loc.event.notes.map { $0.pitch.diatonic - clef.bottomLineDiatonic }.min() ?? 0
        editDoc.apply("Accord \(text)") {
            $0.addAnnotation(Annotation(staff: sel.staff, measure: sel.measure, offset: loc.start, text: text, above: false, staffPosition: min(-5, low - 5)))
        }
        window?.makeFirstResponder(scoreView)
    }

    @objc func expressionChosen(_ sender: NSButton) {
        if sender.tag < 0 {
            askText("Nouvelle expression", placeholder: "ex. : Lento, Swing, Bandonéon", initial: "") { [weak self] text in
                guard let self, !text.isEmpty else { return }
                ScoreWindowController.expressions.append(text)
                self.rebuildExpressions()
            }
            return
        }
        // Clic avec ⌥ (Option) : retirer de la liste.
        if NSEvent.modifierFlags.contains(.option) {
            var list = ScoreWindowController.expressions
            if sender.tag < list.count { list.remove(at: sender.tag) }
            ScoreWindowController.expressions = list
            rebuildExpressions()
            return
        }
        guard let sel = state.selection, let loc = editDoc.score.locate(sel) else {
            showStatus("Choisissez d'abord une note avec la flèche.", isError: true); return
        }
        let list = ScoreWindowController.expressions
        guard sender.tag < list.count else { return }
        let text = list[sender.tag]
        editDoc.apply("« \(text) »") {
            $0.addAnnotation(Annotation(staff: sel.staff, measure: sel.measure, offset: loc.start, text: text, above: true, staffPosition: 14))
        }
        window?.makeFirstResponder(scoreView)
    }

    func rebuildExpressions() {
        guard let i = ScoreWindowController.paletteNames.firstIndex(of: "Expressions"), i < palettes.count else { return }
        let view = expressionsView()
        let panel = palettes[i]
        let top = panel.frame.maxY
        panel.contentView = view
        panel.setContentSize(view.frame.size)
        panel.setFrameTopLeftPoint(NSPoint(x: panel.frame.minX, y: top))
        refreshControls()
    }

    @objc func colorChosen(_ sender: NSButton) {
        let refs = scoreView.selectedRange()
        guard !refs.isEmpty else { showStatus("Choisissez d'abord des notes avec la flèche (Maj+clic pour une plage).", isError: true); return }
        let c = ScoreWindowController.colorChoices[max(0, min(ScoreWindowController.colorChoices.count - 1, sender.tag))]
        editDoc.apply("Couleur") { s in for r in refs { try? s.setColor(c.rgb, on: r) } }
        window?.makeFirstResponder(scoreView)
    }
}
