import AppKit
import PartiCore

/// Outil actif, à la manière d'Encore : sélection (flèche) ou saisie (crayon).
enum Tool { case select, note }

/// État de saisie partagé entre la palette, le canevas et la barre d'état.
final class EditorState {
    var tool: Tool = .note
    var duration = Duration(.quarter)
    var restMode = false
    /// Altération à appliquer à la prochaine note saisie.
    var pendingAlter: Int?
    var selection: EventRef?
    var selectedNote: Int?
    /// Curseur de saisie au clavier.
    var cursor: TimePosition?
    var onChange: (() -> Void)?
    func changed() { onChange?() }
}

/// Canevas de la partition : pages, saisie souris / clavier, curseurs.
final class ScoreView: NSView {
    weak var document: ScoreDocument?
    let state: EditorState
    var playbackBeat: Double? { didSet { needsDisplay = true } }

    let pageGap: CGFloat = 28
    private var dragStartPosition: Int?
    private var dragOriginal: Score?
    private var dragAccum = 0

    init(document: ScoreDocument, state: EditorState) {
        self.document = document
        self.state = state
        super.init(frame: .zero)
        updateSize()
    }
    required init?(coder: NSCoder) { fatalError() }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    override func becomeFirstResponder() -> Bool { true }

    var layout: ScoreLayout? { document?.layout }

    // MARK: Géométrie des pages

    func pageOrigin(_ i: Int) -> CGPoint {
        guard let l = layout else { return .zero }
        var y = pageGap
        for p in 0..<i { y += CGFloat(l.pages[p].height) + pageGap }
        let w = CGFloat(l.pages[i].width)
        return CGPoint(x: max(pageGap, (bounds.width - w) / 2), y: y)
    }

    func updateSize() {
        guard let l = layout else { return }
        let w = (l.pages.map { CGFloat($0.width) }.max() ?? 600) + 2 * pageGap
        let h = l.pages.reduce(pageGap) { $0 + CGFloat($1.height) + pageGap }
        let width = max(w, superview?.bounds.width ?? w)
        if frame.size != NSSize(width: width, height: h) { setFrameSize(NSSize(width: width, height: h)) }
        needsDisplay = true
    }

    // MARK: Dessin

    override func draw(_ dirtyRect: NSRect) {
        Theme.desk.setFill()
        dirtyRect.fill()
        guard let l = layout, let ctx = NSGraphicsContext.current?.cgContext, let doc = document else { return }
        var selectedKeys = Set<EventKey>()
        if let sel = state.selection {
            selectedKeys.insert(EventKey(staff: sel.staff, measure: sel.measure, voice: sel.voice, eventID: sel.eventID))
        }
        for (i, page) in l.pages.enumerated() {
            let o = pageOrigin(i)
            let rect = CGRect(x: o.x, y: o.y, width: CGFloat(page.width), height: CGFloat(page.height))
            guard rect.insetBy(dx: -20, dy: -20).intersects(dirtyRect) else { continue }
            ctx.saveGState()
            ctx.setShadow(offset: CGSize(width: 0, height: 2), blur: 8, color: NSColor.black.withAlphaComponent(0.25).cgColor)
            ctx.setFillColor(NSColor.white.cgColor)
            ctx.fill(rect)
            ctx.restoreGState()
            ctx.saveGState()
            ctx.translateBy(x: o.x, y: o.y)
            Renderer().draw(page, in: ctx, selected: selectedKeys)
            drawCursors(page: i, ctx: ctx, layout: l, score: doc.score)
            ctx.restoreGState()
        }
    }

    private func drawCursors(page: Int, ctx: CGContext, layout l: ScoreLayout, score: Score) {
        let sp = l.staffSpace
        // Curseur de saisie.
        if state.tool == .note, let c = state.cursor, let sys = l.system(containing: c.measure), sys.page == page,
           let m = sys.measure(c.measure), let st = sys.staff(c.staff) {
            let x = m.x(at: c.offset.doubleValue) - 0.4 * sp
            ctx.setFillColor(NSColor.systemBlue.withAlphaComponent(0.25).cgColor)
            ctx.fill(CGRect(x: x, y: st.top - 1.5 * sp, width: 1.9 * sp, height: 7 * sp))
            ctx.setFillColor(NSColor.systemBlue.cgColor)
            ctx.fill(CGRect(x: x, y: st.top - 1.5 * sp, width: 0.25 * sp, height: 7 * sp))
        }
        // Curseur de lecture.
        if let beat = playbackBeat {
            let starts = score.measureStartBeats
            guard let m = starts.indices.dropLast().last(where: { starts[$0] <= beat }),
                  let sys = l.system(containing: m), sys.page == page, let pm = sys.measure(m) else { return }
            let x = pm.x(at: (beat - starts[m]) / 4)
            ctx.setFillColor(NSColor.systemGreen.withAlphaComponent(0.8).cgColor)
            ctx.fill(CGRect(x: x - 1, y: sys.top - 2 * sp, width: 2.5, height: sys.bottom - sys.top + 4 * sp))
        }
    }

    /// Rectangle (coordonnées de la vue) du curseur de lecture, pour le défilement automatique.
    func playbackRect() -> NSRect? {
        guard let beat = playbackBeat, let l = layout, let doc = document else { return nil }
        let starts = doc.score.measureStartBeats
        guard let m = starts.indices.dropLast().last(where: { starts[$0] <= beat }),
              let sys = l.system(containing: m), let pm = sys.measure(m) else { return nil }
        let o = pageOrigin(sys.page)
        let x = pm.x(at: (beat - starts[m]) / 4)
        return NSRect(x: o.x + x - 60, y: o.y + sys.top - 40, width: 120, height: sys.bottom - sys.top + 80)
    }

    func hit(_ event: NSEvent) -> HitResult? {
        guard let l = layout else { return nil }
        let p = convert(event.locationInWindow, from: nil)
        for i in l.pages.indices {
            let o = pageOrigin(i)
            let local = LPoint(Double(p.x - o.x), Double(p.y - o.y))
            if local.y >= 0 && local.y <= l.pages[i].height && local.x >= 0 && local.x <= l.pages[i].width {
                return l.hitTest(page: i, point: local)
            }
        }
        return nil
    }

    // MARK: Souris

    override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        guard let doc = document, let h = hit(event) else {
            state.selection = nil; state.changed(); return
        }
        let score = doc.score
        if state.tool == .note && !event.modifierFlags.contains(.command) {
            let diatonic = h.clef.bottomLineDiatonic + h.position
            var pitch = Pitch(diatonic: diatonic)
            pitch.alter = state.pendingAlter ?? score.measures[h.measure].key.alter(forStep: pitch.step)
            let pos = TimePosition(staff: h.staff, measure: h.measure, offset: h.offset)
            if event.modifierFlags.contains(.shift), let target = score.event(at: pos), !state.restMode {
                // Maj+clic : ajoute la note à l'accord.
                doc.apply("Ajouter une note à l'accord") { try $0.addPitch(pitch, to: target) }
                select(target, note: nil)
                Player.shared.preview([pitch], part: h.staff.part, score: doc.score)
            } else {
                insert(at: pos, pitches: state.restMode ? [] : [pitch])
            }
            return
        }
        // Outil sélection.
        if let key = h.event {
            select(EventRef(staff: key.staff, measure: key.measure, voice: key.voice, eventID: key.eventID), note: h.noteIndex)
            dragStartPosition = h.position
            dragOriginal = doc.score
            dragAccum = 0
            if let e = doc.score.locate(state.selection!)?.event, !e.isRest {
                Player.shared.preview(e.notes.map(\.pitch), part: key.staff.part, score: doc.score)
            }
        } else {
            let pos = TimePosition(staff: h.staff, measure: h.measure, offset: h.offset)
            if let ref = score.event(at: pos) { select(ref, note: nil) } else { state.selection = nil; state.changed() }
        }
    }

    override func mouseDragged(with event: NSEvent) {
        guard state.tool == .select, let start = dragStartPosition, let sel = state.selection,
              let doc = document, let original = dragOriginal, let h = hit(event) else { return }
        let steps = h.position - start
        guard steps != dragAccum else { return }
        dragAccum = steps
        var s = original
        try? s.transposeDiatonic(sel, noteIndex: state.selectedNote, steps: steps)
        doc.score = s   // aperçu ; l'annulation est enregistrée au relâchement
        relayout()
    }

    override func mouseUp(with event: NSEvent) {
        defer { dragStartPosition = nil; dragOriginal = nil; dragAccum = 0 }
        guard let doc = document, let original = dragOriginal, dragAccum != 0 else { return }
        let moved = doc.score
        doc.score = original
        doc.replaceScore(with: moved, actionName: "Déplacer la note")
        if let sel = state.selection, let e = doc.score.locate(sel)?.event {
            Player.shared.preview(e.notes.map(\.pitch), part: sel.staff.part, score: doc.score)
        }
        relayout()
    }

    // MARK: Saisie

    func select(_ ref: EventRef?, note: Int?) {
        state.selection = ref
        state.selectedNote = note
        state.changed()
        needsDisplay = true
    }

    /// Insère une note / un silence à la position et avance le curseur.
    func insert(at pos: TimePosition, pitches: [Pitch]) {
        guard let doc = document else { return }
        var newRef: EventRef?
        let ok = doc.apply(pitches.isEmpty ? "Saisir un silence" : "Saisir une note") { s in
            newRef = try s.setEvent(at: pos, duration: state.duration, pitches: pitches)
        }
        guard ok, let ref = newRef else { return }
        state.pendingAlter = nil
        select(ref, note: nil)
        advanceCursor(after: ref)
        if !pitches.isEmpty { Player.shared.preview(pitches, part: pos.staff.part, score: doc.score) }
        relayout()
    }

    func advanceCursor(after ref: EventRef) {
        guard let doc = document, let loc = doc.score.locate(ref) else { return }
        let ml = doc.score.measureLength(ref.measure)
        var offset = loc.start + loc.event.length(measureLength: ml)
        var m = ref.measure
        if offset >= ml {
            m += 1; offset = .zero
            if m >= doc.score.measureCount {
                doc.apply("Ajouter une mesure") { $0.appendMeasures(1) }
            }
        }
        state.cursor = TimePosition(staff: ref.staff, measure: m, voice: ref.voice, offset: offset)
        state.changed()
        scrollCursorVisible()
    }

    func scrollCursorVisible() {
        guard let c = state.cursor, let l = layout, let sys = l.system(containing: c.measure),
              let pm = sys.measure(c.measure) else { return }
        let o = pageOrigin(sys.page)
        scrollToVisible(NSRect(x: o.x + pm.x(at: c.offset.doubleValue) - 80, y: o.y + sys.top - 40, width: 160, height: sys.bottom - sys.top + 80))
    }

    func relayout() {
        updateSize()
        needsDisplay = true
    }

    /// Hauteur de référence pour la saisie par lettre : note précédente, sinon milieu de la portée.
    func referenceDiatonic(for pos: TimePosition) -> Int {
        guard let doc = document else { return 34 }
        let s = doc.score
        var m = pos.measure
        var before = pos.offset
        while m >= 0 {
            let notes = s.timedEvents(pos.staff, measure: m, voice: pos.voice).filter { $0.start < before && !$0.event.isRest }
            if let last = notes.last, let top = last.event.notes.last { return top.pitch.diatonic }
            m -= 1; before = Fraction(1000)
        }
        return s[pos.staff].clef.bottomLineDiatonic + 4
    }

    func currentInputPosition() -> TimePosition {
        if let c = state.cursor { return c }
        if let sel = state.selection, let loc = document?.score.locate(sel) {
            return TimePosition(staff: sel.staff, measure: sel.measure, voice: sel.voice, offset: loc.start)
        }
        return TimePosition(staff: StaffRef(part: 0, staff: 0), measure: 0, offset: .zero)
    }

    // MARK: Clavier (raccourcis proches d'Encore)

    static let digitKeyCodes: [UInt16: Int] = [29: 0, 18: 1, 19: 2, 20: 3, 21: 4, 23: 5, 22: 6, 26: 7, 28: 8,
                                               82: 0, 83: 1, 84: 2, 85: 3, 86: 4, 87: 5, 88: 6, 89: 7, 91: 8]

    override func keyDown(with event: NSEvent) {
        guard let doc = document else { return }
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if flags.contains(.command) || flags.contains(.control) { super.keyDown(with: event); return }
        let chars = event.characters ?? ""
        let plain = (event.charactersIgnoringModifiers ?? "").lowercased()

        // Durées : touches 0–8 (rangée du haut ou pavé numérique, quel que soit le clavier).
        if let d = ScoreView.digitKeyCodes[event.keyCode] {
            setDuration(DurationBase(rawValue: d)!)
            return
        }
        switch event.keyCode {
        case 53: // Échap
            state.tool = state.tool == .note ? .select : .note
            if state.tool == .note && state.cursor == nil { state.cursor = currentInputPosition() }
            state.changed(); needsDisplay = true
            return
        case 49: // Espace
            (window?.windowController as? ScoreWindowController)?.togglePlayback(nil)
            return
        case 36, 76: // Entrée : silence
            insert(at: currentInputPosition(), pitches: [])
            return
        case 51, 117: // Effacer
            if let sel = state.selection { doc.apply("Effacer") { try $0.makeRest(sel) }; relayout() }
            return
        case 123, 124: // ← →
            moveSelection(forward: event.keyCode == 124)
            return
        case 125, 126: // ↓ ↑
            guard let sel = state.selection else { NSSound.beep(); return }
            let up = event.keyCode == 126
            if flags.contains(.option) {
                doc.apply("Changer d'octave") { try $0.transposeDiatonic(sel, noteIndex: state.selectedNote, steps: up ? 7 : -7) }
            } else if flags.contains(.shift) {
                doc.apply("Monter / descendre d'un degré") { try $0.transposeDiatonic(sel, noteIndex: state.selectedNote, steps: up ? 1 : -1) }
            } else {
                doc.apply("Monter / descendre d'un demi-ton") { try $0.transposeChromatic(sel, noteIndex: state.selectedNote, semitones: up ? 1 : -1) }
            }
            if let e = doc.score.locate(sel)?.event { Player.shared.preview(e.notes.map(\.pitch), part: sel.staff.part, score: doc.score) }
            relayout()
            return
        case 65: // point du pavé numérique
            toggleDot(); return
        case 78: // - du pavé numérique
            applyAccidental(-1); return
        case 69: // + du pavé numérique
            applyAccidental(1); return
        default: break
        }

        if let letterIndex = ["c", "d", "e", "f", "g", "a", "b"].firstIndex(of: plain) {
            let pos = currentInputPosition()
            let pitch0 = doc.score.pitch(letter: letterIndex, near: referenceDiatonic(for: pos), measure: pos.measure)
            var pitch = pitch0
            if let a = state.pendingAlter { pitch.alter = a }
            if flags.contains(.shift), let sel = state.selection {
                // Maj + lettre : ajoute la note à l'accord sélectionné.
                var p = pitch
                if let top = doc.score.locate(sel)?.event.notes.last?.pitch {
                    p = doc.score.pitch(letter: letterIndex, near: top.diatonic + 2, measure: sel.measure)
                    if p.diatonic <= top.diatonic { p = Pitch(diatonic: p.diatonic + 7, alter: p.alter) }
                }
                doc.apply("Ajouter une note à l'accord") { try $0.addPitch(p, to: sel) }
                Player.shared.preview([p], part: sel.staff.part, score: doc.score)
                relayout()
            } else {
                state.tool = .note
                insert(at: pos, pitches: [pitch])
            }
            return
        }
        switch chars {
        case "r", "R": toggleRestMode()
        case ".", ";": toggleDot()
        case "+", "#": applyAccidental(1)
        case "-": applyAccidental(-1)
        case "=": applyAccidental(0)
        case "t", "T": toggleTie()
        default: super.keyDown(with: event)
        }
    }

    func setDuration(_ base: DurationBase) {
        state.duration = Duration(base, dots: 0)
        if state.tool == .select, let sel = state.selection, let doc = document {
            var newRef: EventRef?
            doc.apply("Changer la durée") { newRef = try $0.changeDuration(sel, to: state.duration) }
            if let r = newRef { select(r, note: nil) }
            relayout()
        }
        state.changed()
    }

    func toggleRestMode() { state.restMode.toggle(); state.changed() }

    func toggleDot() {
        if state.tool == .select, let sel = state.selection, let doc = document {
            var newRef: EventRef?
            doc.apply("Point") { newRef = try $0.toggleDot(sel) }
            if let r = newRef { select(r, note: nil) }
            relayout()
        } else {
            state.duration.dots = state.duration.dots == 0 ? 1 : 0
            state.changed()
        }
    }

    func toggleTie() {
        guard let sel = state.selection, let doc = document else { NSSound.beep(); return }
        doc.apply("Liaison de prolongation") { try $0.toggleTie(sel) }
        relayout()
    }

    /// Altération : sur la note sélectionnée (outil flèche, ou juste après la saisie), sinon pour la prochaine note.
    func applyAccidental(_ alter: Int) {
        if let sel = state.selection, let doc = document, let e = doc.score.locate(sel)?.event, !e.isRest {
            doc.apply("Altération") { try $0.setAlter(sel, noteIndex: state.selectedNote, alter: alter) }
            if let e2 = doc.score.locate(sel)?.event { Player.shared.preview(e2.notes.map(\.pitch), part: sel.staff.part, score: doc.score) }
            relayout()
        } else {
            state.pendingAlter = alter
            state.changed()
        }
    }

    func moveSelection(forward: Bool) {
        guard let doc = document else { return }
        guard let sel = state.selection else {
            if let ref = doc.score.event(at: currentInputPosition()) { select(ref, note: nil) }
            return
        }
        if let n = doc.score.neighbor(of: sel, forward: forward) {
            select(n, note: nil)
            if let loc = doc.score.locate(n) {
                state.cursor = TimePosition(staff: n.staff, measure: n.measure, voice: n.voice, offset: loc.start)
                if !loc.event.isRest { Player.shared.preview(loc.event.notes.map(\.pitch), part: n.staff.part, score: doc.score) }
            }
            state.changed()
            scrollCursorVisible()
        }
    }
}

/// Vue de défilement qui centre les pages horizontalement.
final class CenteringClipView: NSClipView {
    override func constrainBoundsRect(_ proposedBounds: NSRect) -> NSRect {
        var r = super.constrainBoundsRect(proposedBounds)
        guard let doc = documentView else { return r }
        if r.width > doc.frame.width { r.origin.x = (doc.frame.width - r.width) / 2 }
        return r
    }
}
