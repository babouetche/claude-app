import AppKit
import UniformTypeIdentifiers
import PartiCore

/// Fenêtre d'une partition : barre du haut, palette à gauche, partition au centre, barre d'état en bas.
final class ScoreWindowController: NSWindowController, NSWindowDelegate {
    let state = EditorState()
    private(set) var scoreView: ScoreView!
    private var scrollView: NSScrollView!
    private var statusLabel = NSTextField(labelWithString: "")
    private var playButton: NSButton!
    private var tempoField = NSTextField()
    private var tempoStepper = NSStepper()
    private var paletteButtons: [NSButton] = []
    private var durationButtons: [DurationBase: NSButton] = [:]
    private var toolButtons: [Tool: NSButton] = [:]
    private var restButton: NSButton!
    private var dotButton: NSButton!
    private var accidentalButtons: [Int: NSButton] = [:]
    private var transientStatus: String?

    var scoreDocument: ScoreDocument { document as! ScoreDocument }

    init(document: ScoreDocument) {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 860),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable],
                              backing: .buffered, defer: false)
        window.minSize = NSSize(width: 760, height: 700)
        window.tabbingMode = .preferred
        super.init(window: window)
        self.document = document
        window.delegate = self
        buildUI(document)
        window.center()
        window.setFrameAutosaveName("PartiMacPartition")
        state.cursor = TimePosition(staff: StaffRef(part: 0, staff: 0), measure: 0, offset: .zero)
        state.onChange = { [weak self] in self?.refreshControls() }
        document.onChange = { [weak self] in
            self?.scoreView.relayout()
            self?.refreshControls()
        }
        refreshControls()
    }
    required init?(coder: NSCoder) { fatalError() }

    override func windowDidLoad() { super.windowDidLoad() }

    override func showWindow(_ sender: Any?) {
        super.showWindow(sender)
        window?.makeFirstResponder(scoreView)
        if scoreDocument.needsSetup {
            scoreDocument.needsSetup = false
            DispatchQueue.main.async { self.runNewScoreAssistant() }
        }
    }

    // MARK: Construction de l'interface

    private func buildUI(_ doc: ScoreDocument) {
        guard let content = window?.contentView else { return }

        // Barre du haut.
        let top = NSStackView()
        top.orientation = .horizontal
        top.spacing = 8
        top.edgeInsets = NSEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)
        playButton = symbolButton("play.fill", title: "Écouter", tip: "Écouter / arrêter (barre d'espace)", action: #selector(togglePlayback(_:)))
        let fromStart = symbolButton("backward.end.fill", title: "Début", tip: "Écouter depuis le début", action: #selector(playFromStart(_:)))
        let tempoLabel = NSTextField(labelWithString: "♩ =")
        tempoLabel.font = .systemFont(ofSize: 14)
        tempoField.formatter = { let f = NumberFormatter(); f.minimum = 20; f.maximum = 400; f.maximumFractionDigits = 0; return f }()
        tempoField.widthAnchor.constraint(equalToConstant: 48).isActive = true
        tempoField.target = self; tempoField.action = #selector(tempoEdited(_:))
        tempoField.toolTip = "Tempo (noires par minute)"
        tempoStepper.minValue = 20; tempoStepper.maxValue = 400; tempoStepper.increment = 2
        tempoStepper.target = self; tempoStepper.action = #selector(tempoStepped(_:))
        let spacer = NSView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        let zoomOut = symbolButton("minus.magnifyingglass", title: "", tip: "Zoom arrière (⌘ -)", action: #selector(zoomOut(_:)))
        let zoomIn = symbolButton("plus.magnifyingglass", title: "", tip: "Zoom avant (⌘ +)", action: #selector(zoomIn(_:)))
        let pdf = symbolButton("doc.richtext", title: "PDF", tip: "Exporter en PDF (⌘ E)", action: #selector(exportPDF(_:)))
        let midi = symbolButton("pianokeys", title: "MIDI", tip: "Exporter en MIDI", action: #selector(exportMIDI(_:)))
        for v in [playButton!, fromStart, tempoLabel, tempoField, tempoStepper, spacer, zoomOut, zoomIn, pdf, midi] as [NSView] { top.addArrangedSubview(v) }

        // Palette (outils, durées, altérations).
        // Palette à positions fixes (pas de mise en page automatique : rendu identique partout).
        let palette = FlippedView()
        var py: CGFloat = 10
        func addSection(_ title: String) {
            let l = sectionLabel(title)
            l.frame = NSRect(x: 8, y: py, width: 100, height: 14)
            palette.addSubview(l)
            py += 18
        }
        func addRow(_ buttons: [NSButton]) {
            for (i, b) in buttons.enumerated() {
                b.frame = NSRect(x: 8 + CGFloat(i) * 50, y: py, width: 46, height: 46)
                palette.addSubview(b)
            }
            py += 50
        }
        addSection("Outils")
        let selectBtn = paletteButton(symbol: "cursorarrow", glyph: nil, tip: "Sélection : cliquer une note pour la choisir, la glisser pour changer sa hauteur (Échap)", tag: 0, action: #selector(toolChosen(_:)))
        let pencilBtn = paletteButton(symbol: "pencil", glyph: nil, tip: "Saisie : cliquer sur la portée pour poser une note (Échap)", tag: 1, action: #selector(toolChosen(_:)))
        toolButtons = [.select: selectBtn, .note: pencilBtn]
        addRow([selectBtn, pencilBtn])

        addSection("Durées")
        var durRow: [NSButton] = []
        for base in DurationBase.allCases where base != .breve && base != .hundredTwentyEighth {
            let b = paletteButton(symbol: nil, glyph: SMuFL.metronomeNote(base), tip: "\(base.frenchName) — touche \(base.rawValue)", tag: base.rawValue, action: #selector(durationChosen(_:)))
            durationButtons[base] = b
            durRow.append(b)
            if durRow.count == 2 { addRow(durRow); durRow = [] }
        }
        if !durRow.isEmpty { addRow(durRow) }
        restButton = paletteButton(symbol: nil, glyph: SMuFL.rest(.quarter), tip: "Silences au lieu de notes — touche R (Entrée pose un silence)", tag: 0, action: #selector(restToggled(_:)))
        dotButton = paletteButton(symbol: nil, glyph: SMuFL.augmentationDot, tip: "Point — touche .", tag: 0, action: #selector(dotToggled(_:)))
        addRow([restButton, dotButton])

        addSection("Altérations")
        let flat = paletteButton(symbol: nil, glyph: SMuFL.flat, tip: "Bémol — touche -", tag: -1, action: #selector(accidentalChosen(_:)))
        let natural = paletteButton(symbol: nil, glyph: SMuFL.natural, tip: "Bécarre — touche =", tag: 0, action: #selector(accidentalChosen(_:)))
        let sharp = paletteButton(symbol: nil, glyph: SMuFL.sharp, tip: "Dièse — touche +", tag: 1, action: #selector(accidentalChosen(_:)))
        accidentalButtons = [-1: flat, 0: natural, 1: sharp]
        addRow([flat, natural])
        addRow([sharp])

        addSection("Liaison")
        let tie = paletteButton(symbol: nil, glyph: 0xE1FD, tip: "Lier la note sélectionnée à la suivante — touche T", tag: 0, action: #selector(tieChosen(_:)))
        addRow([tie])

        addSection("Mesures")
        let addMeasure = paletteButton(symbol: "plus.rectangle", glyph: nil, tip: "Ajouter une mesure à la fin (⌥⌘ M)", tag: 0, action: #selector(appendMeasure(_:)))
        let delMeasure = paletteButton(symbol: "minus.rectangle", glyph: nil, tip: "Supprimer la mesure sélectionnée", tag: 0, action: #selector(deleteMeasure(_:)))
        addRow([addMeasure, delMeasure])

        // Partition.
        scrollView = NSScrollView()
        scrollView.contentView = CenteringClipView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.allowsMagnification = true
        scrollView.minMagnification = 0.4
        scrollView.maxMagnification = 4
        scrollView.drawsBackground = true
        scrollView.backgroundColor = .underPageBackgroundColor
        scoreView = ScoreView(document: doc, state: state)
        scrollView.documentView = scoreView
        scrollView.magnification = 1.3
        scrollView.contentView.postsFrameChangedNotifications = true
        NotificationCenter.default.addObserver(forName: NSView.frameDidChangeNotification, object: scrollView.contentView, queue: .main) { [weak self] _ in
            self?.scoreView.updateSize()
        }

        // Barre d'état.
        statusLabel.font = .systemFont(ofSize: 12)
        statusLabel.textColor = .secondaryLabelColor
        statusLabel.lineBreakMode = .byTruncatingTail
        let status = NSStackView(views: [statusLabel])
        status.edgeInsets = NSEdgeInsets(top: 4, left: 12, bottom: 4, right: 12)

        let topSep = NSBox(); topSep.boxType = .separator
        let leftSep = NSBox(); leftSep.boxType = .separator
        let bottomSep = NSBox(); bottomSep.boxType = .separator
        for v in [top, topSep, palette, leftSep, scrollView!, bottomSep, status] as [NSView] {
            v.translatesAutoresizingMaskIntoConstraints = false
            content.addSubview(v)
        }
        NSLayoutConstraint.activate([
            top.topAnchor.constraint(equalTo: content.topAnchor),
            top.heightAnchor.constraint(equalToConstant: 44),
            // Taille minimale explicite : sans elle, la mise en page automatique peut écraser la fenêtre.
            content.heightAnchor.constraint(greaterThanOrEqualToConstant: 660),
            content.widthAnchor.constraint(greaterThanOrEqualToConstant: 760),
            palette.heightAnchor.constraint(greaterThanOrEqualToConstant: 590),
            topSep.heightAnchor.constraint(equalToConstant: 1),
            bottomSep.heightAnchor.constraint(equalToConstant: 1),
            top.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            top.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            topSep.topAnchor.constraint(equalTo: top.bottomAnchor),
            topSep.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            topSep.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            palette.topAnchor.constraint(equalTo: topSep.bottomAnchor),
            palette.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            palette.bottomAnchor.constraint(equalTo: bottomSep.topAnchor),
            palette.widthAnchor.constraint(equalToConstant: 112),
            leftSep.topAnchor.constraint(equalTo: topSep.bottomAnchor),
            leftSep.bottomAnchor.constraint(equalTo: bottomSep.topAnchor),
            leftSep.leadingAnchor.constraint(equalTo: palette.trailingAnchor),
            leftSep.widthAnchor.constraint(equalToConstant: 1),
            scrollView.topAnchor.constraint(equalTo: topSep.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leftSep.trailingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomSep.topAnchor),
            bottomSep.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            bottomSep.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            bottomSep.bottomAnchor.constraint(equalTo: status.topAnchor),
            status.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            status.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            status.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            status.heightAnchor.constraint(equalToConstant: 26),
        ])
        window?.initialFirstResponder = scoreView
    }

    private func sectionLabel(_ s: String) -> NSView {
        let l = NSTextField(labelWithString: s.uppercased())
        l.font = .systemFont(ofSize: 10, weight: .semibold)
        l.textColor = .secondaryLabelColor
        return l
    }

    private func unusedRow(_ views: [NSView]) -> NSStackView {
        let r = NSStackView(views: views)
        r.orientation = .horizontal
        r.spacing = 4
        return r
    }

    private func symbolButton(_ symbol: String, title: String, tip: String, action: Selector) -> NSButton {
        let b = NSButton(title: title, target: self, action: action)
        b.image = NSImage(systemSymbolName: symbol, accessibilityDescription: tip)
        b.imagePosition = title.isEmpty ? .imageOnly : .imageLeading
        b.bezelStyle = .rounded
        b.toolTip = tip
        b.refusesFirstResponder = true
        return b
    }

    private func paletteButton(symbol: String?, glyph: UInt32?, tip: String, tag: Int, action: Selector) -> NSButton {
        let b = NSButton(title: "", target: self, action: action)
        b.setButtonType(.pushOnPushOff)
        b.isBordered = false
        b.wantsLayer = true
        b.layer?.cornerRadius = 8
        b.layer?.borderWidth = 1
        b.tag = tag
        b.toolTip = tip
        b.refusesFirstResponder = true
        if let s = symbol {
            b.image = NSImage(systemSymbolName: s, accessibilityDescription: tip)
            b.imagePosition = .imageOnly
        } else if let g = glyph {
            let para = NSMutableParagraphStyle()
            para.alignment = .center
            b.attributedTitle = NSAttributedString(string: Fonts.string(g), attributes: [
                .font: Fonts.nsMusic(24), .foregroundColor: NSColor.labelColor, .paragraphStyle: para,
                .baselineOffset: -6,
            ])
        }
        paletteButtons.append(b)
        return b
    }

    // MARK: État des contrôles

    func refreshControls() {
        for (t, b) in toolButtons { b.state = state.tool == t ? .on : .off }
        for (d, b) in durationButtons { b.state = state.duration.base == d ? .on : .off }
        restButton.state = state.restMode ? .on : .off
        dotButton.state = state.duration.dots > 0 ? .on : .off
        for (a, b) in accidentalButtons { b.state = state.pendingAlter == a ? .on : .off }
        // Les silences ont un autre glyphe dans la palette.
        for (d, b) in durationButtons {
            let para = NSMutableParagraphStyle(); para.alignment = .center
            let g = state.restMode ? SMuFL.rest(d) : SMuFL.metronomeNote(d)
            b.attributedTitle = NSAttributedString(string: Fonts.string(g), attributes: [
                .font: Fonts.nsMusic(24), .foregroundColor: NSColor.labelColor, .paragraphStyle: para,
                .baselineOffset: state.restMode ? 0 : -6,
            ])
        }
        // Fond des boutons de la palette : bleu pâle si actif.
        for b in paletteButtons {
            b.layer?.backgroundColor = (b.state == .on ? NSColor.controlAccentColor.withAlphaComponent(0.28) : NSColor.controlBackgroundColor).cgColor
            b.layer?.borderColor = (b.state == .on ? NSColor.controlAccentColor : NSColor.separatorColor).cgColor
        }
        let tempo = scoreDocument.score.tempo(at: 0)
        tempoField.doubleValue = tempo
        tempoStepper.doubleValue = tempo
        playButton.image = NSImage(systemSymbolName: Player.shared.isPlaying ? "stop.fill" : "play.fill", accessibilityDescription: nil)
        playButton.title = Player.shared.isPlaying ? "Arrêter" : "Écouter"
        updateStatus()
        scoreView?.needsDisplay = true
    }

    func showStatus(_ text: String, isError: Bool) {
        transientStatus = text
        statusLabel.stringValue = text
        statusLabel.textColor = isError ? .systemRed : .secondaryLabelColor
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self, self.transientStatus == text else { return }
            self.transientStatus = nil
            self.updateStatus()
        }
    }

    private func updateStatus() {
        guard transientStatus == nil else { return }
        statusLabel.textColor = .secondaryLabelColor
        let s = scoreDocument.score
        var text: String
        switch state.tool {
        case .note:
            let what = state.restMode ? "Silence (\(state.duration.frenchName.lowercased()))" : state.duration.frenchName
            text = "✏️ Saisie : \(what). Cliquez sur la portée, ou tapez A B C D E F G (la si do ré mi fa sol). Entrée = silence, 1–7 = durée, Échap = sélection."
        case .select:
            text = "↖︎ Sélection : cliquez une note ; ↑↓ demi-ton, ⌥↑↓ octave, ←→ note voisine, Suppr = effacer, 1–7 = changer la durée. Échap = saisie."
        }
        if let sel = state.selection, let e = s.locate(sel)?.event {
            let desc = e.isRest ? "silence" : e.notes.map(\.pitch.frenchName).joined(separator: " + ")
            text = "Mesure \(sel.measure + 1) · \(desc) · \(e.isMeasureRest ? "mesure entière" : e.duration.frenchName.lowercased())   —   " + text
        }
        statusLabel.stringValue = text
    }

    // MARK: Actions

    @objc func toolChosen(_ sender: NSButton) {
        state.tool = sender.tag == 0 ? .select : .note
        if state.tool == .note && state.cursor == nil { state.cursor = scoreView.currentInputPosition() }
        state.changed()
        window?.makeFirstResponder(scoreView)
    }

    @objc func durationChosen(_ sender: NSButton) {
        if let b = DurationBase(rawValue: sender.tag) { scoreView.setDuration(b) }
        window?.makeFirstResponder(scoreView)
    }

    @objc func restToggled(_ sender: NSButton) { scoreView.toggleRestMode(); window?.makeFirstResponder(scoreView) }
    @objc func dotToggled(_ sender: NSButton) { scoreView.toggleDot(); window?.makeFirstResponder(scoreView) }
    @objc func accidentalChosen(_ sender: NSButton) { scoreView.applyAccidental(sender.tag); window?.makeFirstResponder(scoreView) }
    @objc func tieChosen(_ sender: NSButton) { sender.state = .off; scoreView.toggleTie(); window?.makeFirstResponder(scoreView) }

    @objc func appendMeasure(_ sender: Any?) {
        (sender as? NSButton)?.state = .off
        scoreDocument.apply("Ajouter une mesure") { $0.appendMeasures(1) }
        window?.makeFirstResponder(scoreView)
    }

    @objc func insertMeasure(_ sender: Any?) {
        let m = state.selection?.measure ?? state.cursor?.measure ?? 0
        scoreDocument.apply("Insérer une mesure") { $0.insertMeasures(at: m, count: 1) }
    }

    @objc func deleteMeasure(_ sender: Any?) {
        (sender as? NSButton)?.state = .off
        let m = state.selection?.measure ?? state.cursor?.measure ?? (scoreDocument.score.measureCount - 1)
        if scoreDocument.apply("Supprimer la mesure", { try $0.deleteMeasures(m..<(m + 1)) }) {
            state.selection = nil
            if let c = state.cursor, c.measure >= scoreDocument.score.measureCount {
                state.cursor = TimePosition(staff: c.staff, measure: scoreDocument.score.measureCount - 1, offset: .zero)
            }
            state.changed()
        }
        window?.makeFirstResponder(scoreView)
    }

    @objc func tempoEdited(_ sender: NSTextField) { setTempo(sender.doubleValue) }
    @objc func tempoStepped(_ sender: NSStepper) { setTempo(sender.doubleValue) }

    private func setTempo(_ bpm: Double) {
        guard bpm >= 20 else { return }
        scoreDocument.apply("Tempo") { $0.setTempo(bpm, at: 0) }
        window?.makeFirstResponder(scoreView)
    }

    @objc func togglePlayback(_ sender: Any?) {
        if Player.shared.isPlaying { Player.shared.stop(); refreshControls(); return }
        let s = scoreDocument.score
        var startBeat = 0.0
        if let sel = state.selection, let loc = s.locate(sel) {
            startBeat = s.measureStartBeats[sel.measure] + loc.start.doubleValue * 4
        } else if let c = state.cursor, c.measure < s.measureCount {
            startBeat = s.measureStartBeats[c.measure]
        }
        startPlayback(from: startBeat)
    }

    @objc func playFromStart(_ sender: Any?) { startPlayback(from: 0) }

    private func startPlayback(from beat: Double) {
        Player.shared.onPosition = { [weak self] beat in self?.playbackMoved(beat) }
        do {
            try Player.shared.play(scoreDocument.score, fromBeat: beat)
        } catch {
            showStatus("Lecture impossible : vérifiez la sortie audio du Mac (\(error.localizedDescription)).", isError: true)
        }
        refreshControls()
        window?.makeFirstResponder(scoreView)
    }

    private func playbackMoved(_ beat: Double?) {
        scoreView.playbackBeat = beat
        if beat == nil { refreshControls(); return }
        if let r = scoreView.playbackRect(), !scoreView.visibleRect.contains(r) { scoreView.scrollToVisible(r) }
    }

    @objc func zoomIn(_ sender: Any?) { scrollView.animator().magnification = min(4, scrollView.magnification * 1.2) }
    @objc func zoomOut(_ sender: Any?) { scrollView.animator().magnification = max(0.4, scrollView.magnification / 1.2) }
    @objc func zoomActual(_ sender: Any?) { scrollView.animator().magnification = 1.3 }

    @objc func exportPDF(_ sender: Any?) {
        guard let window else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.pdf]
        panel.nameFieldStringValue = scoreDocument.suggestedBaseName + ".pdf"
        panel.message = "Exporter la partition en PDF (pour l'imprimer ou l'envoyer)"
        panel.beginSheetModal(for: window) { [weak self] r in
            guard r == .OK, let url = panel.url, let self else { return }
            do {
                try self.scoreDocument.exportPDF(to: url)
                self.showStatus("PDF enregistré : \(url.lastPathComponent)", isError: false)
            } catch {
                self.showError("Impossible d'enregistrer le PDF.", error)
            }
        }
    }

    @objc func exportMIDI(_ sender: Any?) {
        guard let window else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [UTType(filenameExtension: "mid") ?? .midi]
        panel.nameFieldStringValue = scoreDocument.suggestedBaseName + ".mid"
        panel.message = "Exporter la partition en fichier MIDI"
        panel.beginSheetModal(for: window) { [weak self] r in
            guard r == .OK, let url = panel.url, let self else { return }
            do {
                try self.scoreDocument.exportMIDI(to: url)
                self.showStatus("Fichier MIDI enregistré : \(url.lastPathComponent)", isError: false)
            } catch {
                self.showError("Impossible d'enregistrer le fichier MIDI.", error)
            }
        }
    }

    @objc func printScore(_ sender: Any?) {
        let info = NSPrintInfo.shared.copy() as! NSPrintInfo
        info.topMargin = 0; info.bottomMargin = 0; info.leftMargin = 0; info.rightMargin = 0
        info.horizontalPagination = .fit
        info.verticalPagination = .automatic
        info.isHorizontallyCentered = true
        info.isVerticallyCentered = true
        let op = NSPrintOperation(view: PrintView(layout: scoreDocument.layout), printInfo: info)
        op.jobTitle = scoreDocument.suggestedBaseName
        if let window { op.runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil) } else { op.run() }
    }

    @objc func editScoreInfo(_ sender: Any?) {
        guard let window else { return }
        let alert = NSAlert()
        alert.messageText = "Titre et compositeur"
        let title = NSTextField(string: scoreDocument.score.metadata.title)
        let subtitle = NSTextField(string: scoreDocument.score.metadata.subtitle)
        let composer = NSTextField(string: scoreDocument.score.metadata.composer)
        let grid = NSGridView(views: [
            [NSTextField(labelWithString: "Titre :"), title],
            [NSTextField(labelWithString: "Sous-titre :"), subtitle],
            [NSTextField(labelWithString: "Compositeur :"), composer],
        ])
        for f in [title, subtitle, composer] { f.widthAnchor.constraint(equalToConstant: 280).isActive = true }
        grid.frame = NSRect(x: 0, y: 0, width: 380, height: 90)
        alert.accessoryView = grid
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Annuler")
        alert.beginSheetModal(for: window) { [weak self] r in
            guard r == .alertFirstButtonReturn, let self else { return }
            self.scoreDocument.apply("Titre et compositeur") {
                $0.metadata.title = title.stringValue
                $0.metadata.subtitle = subtitle.stringValue
                $0.metadata.composer = composer.stringValue
            }
        }
    }

    func showError(_ message: String, _ error: Error) {
        let a = NSAlert()
        a.messageText = message
        a.informativeText = error.localizedDescription
        a.alertStyle = .warning
        if let window { a.beginSheetModal(for: window) } else { a.runModal() }
    }

    // MARK: Assistant « Nouvelle partition »

    func runNewScoreAssistant() {
        guard let window else { return }
        let sheet = NewScoreAssistant()
        sheet.begin(on: window) { [weak self] result in
            guard let self, let result else { return }
            let score = Score.make(template: result.template, title: result.title, composer: result.composer,
                                   time: result.time, key: result.key, tempo: result.tempo, measures: result.measures)
            // Pas d'annulation pour la création elle-même.
            self.scoreDocument.undoManager?.disableUndoRegistration()
            self.scoreDocument.score = score
            self.scoreDocument.undoManager?.enableUndoRegistration()
            self.state.selection = nil
            self.state.cursor = TimePosition(staff: StaffRef(part: 0, staff: 0), measure: 0, offset: .zero)
            self.state.tool = .note
            self.state.changed()
            self.window?.makeFirstResponder(self.scoreView)
        }
    }

    // MARK: NSWindowDelegate

    func windowWillClose(_ notification: Notification) {
        Player.shared.stop()
    }
}

/// Vue à coordonnées « haut en bas ».
final class FlippedView: NSView {
    override var isFlipped: Bool { true }
}
