import AppKit
import PartiCore

/// Saisie des paroles : un petit champ suit les notes.
/// Espace ou Tab = note suivante, « - » = syllabe coupée puis note suivante,
/// Effacer dans un champ vide = note précédente, Entrée = terminer, Échap = annuler la syllabe.
final class LyricsEditor: NSObject, NSTextFieldDelegate {
    weak var view: ScoreView?
    let field: NSTextField
    var ref: EventRef
    let verse: Int

    init(view: ScoreView, ref: EventRef, verse: Int) {
        self.view = view; self.ref = ref; self.verse = verse
        field = NSTextField(string: "")
        super.init()
        field.delegate = self
        field.alignment = .center
        field.font = NSFont(name: "Times New Roman", size: 15) ?? .systemFont(ofSize: 15)
        field.focusRingType = .none
        field.bezelStyle = .roundedBezel
        field.backgroundColor = NSColor(srgbRed: 0.90, green: 0.95, blue: 1, alpha: 1)
        field.textColor = .black
        field.placeholderString = "syllabe"
        view.addSubview(field)
        load()
    }

    var document: ScoreDocument? { view?.document }

    /// Place le champ sous la note et y met la syllabe existante.
    func load() {
        guard let view, let doc = document else { return }
        view.select(ref, note: nil)
        field.stringValue = doc.score.locate(ref)?.event.lyric(verse) ?? ""
        position()
        view.window?.makeFirstResponder(field)
        field.currentEditor()?.selectAll(nil)
    }

    func position() {
        guard let view, let l = view.layout, let sys = l.system(containing: ref.measure),
              let st = sys.staff(ref.staff),
              let pe = sys.events[EventKey(staff: ref.staff, measure: ref.measure, voice: ref.voice, eventID: ref.eventID)] else { return }
        let sp = l.staffSpace
        let o = view.pageOrigin(sys.page)
        let cx = o.x + CGFloat(pe.x + pe.width / 2)
        let y = o.y + CGFloat(st.top + 4 * sp + 2.6 * sp + Double(verse) * LayoutEngine.lyricLine * sp) - 3
        field.frame = NSRect(x: cx - 55, y: y, width: 110, height: 24)
        view.scrollToVisible(field.frame.insetBy(dx: -80, dy: -60))
    }

    func commit() {
        guard let doc = document else { return }
        let text = field.stringValue.trimmingCharacters(in: .whitespaces)
        let current = doc.score.locate(ref)?.event.lyric(verse) ?? ""
        guard text != current else { return }
        _ = doc.apply("Paroles") { try $0.setLyric(ref, verse: verse, text: text) }
        view?.relayout()
    }

    func move(forward: Bool) {
        guard let doc = document else { return }
        guard let next = doc.score.neighborNote(of: ref, forward: forward) else {
            if forward { finish(); view?.status("Paroles : dernière note atteinte.") } else { NSSound.beep() }
            return
        }
        ref = next
        load()
    }

    func finish() {
        field.delegate = nil
        field.removeFromSuperview()
        view?.lyricsEditor = nil
        view?.window?.makeFirstResponder(view)
        view?.needsDisplay = true
    }

    // MARK: NSTextFieldDelegate

    func controlTextDidChange(_ obj: Notification) {
        let s = field.stringValue
        if s.hasSuffix(" ") {
            field.stringValue = String(s.dropLast())
            commit(); move(forward: true)
        } else if s.hasSuffix("-") && s.count > 1 {
            commit(); move(forward: true)
        }
    }

    func control(_ control: NSControl, textView: NSTextView, doCommandBy sel: Selector) -> Bool {
        switch sel {
        case #selector(NSResponder.insertNewline(_:)):
            commit(); finish(); view?.status("Paroles enregistrées.")
            return true
        case #selector(NSResponder.cancelOperation(_:)):
            finish()
            return true
        case #selector(NSResponder.insertTab(_:)):
            commit(); move(forward: true)
            return true
        case #selector(NSResponder.moveRight(_:)) where textView.selectedRange().location >= (field.stringValue as NSString).length:
            commit(); move(forward: true)
            return true
        case #selector(NSResponder.insertBacktab(_:)):
            commit(); move(forward: false)
            return true
        case #selector(NSResponder.moveLeft(_:)) where textView.selectedRange().location == 0 && textView.selectedRange().length == 0:
            commit(); move(forward: false)
            return true
        case #selector(NSResponder.deleteBackward(_:)) where field.stringValue.isEmpty:
            commit(); move(forward: false)
            return true
        default:
            return false
        }
    }
}

extension ScoreView {
    /// Démarre la saisie des paroles (couplet `verse`, à partir de 0) sur la note sélectionnée.
    func beginLyrics(verse: Int) {
        guard let doc = document else { return }
        lyricsEditor?.finish()
        var start = state.selection
        if let s = start, doc.score.locate(s)?.event.isRest ?? true { start = doc.score.neighborNote(of: s, forward: true) }
        if start == nil, let ref = doc.score.staffRefs.first {
            // Première note de la partition.
            outer: for m in 0..<doc.score.measureCount {
                for e in doc.score.events(ref, measure: m) where !e.isRest {
                    start = EventRef(staff: ref, measure: m, eventID: e.id); break outer
                }
            }
        }
        guard let ref = start else { status("Écrivez d'abord des notes, puis ajoutez les paroles.", isError: true); return }
        state.tool = .select
        state.changed()
        lyricsEditor = LyricsEditor(view: self, ref: ref, verse: verse)
        status("Paroles, \(verse + 1)\(verse == 0 ? "er" : "e") couplet : tapez la syllabe puis Espace (ou « - » pour couper un mot). Entrée pour finir.")
    }

    func status(_ text: String, isError: Bool = false) {
        (window?.windowController as? ScoreWindowController)?.showStatus(text, isError: isError)
    }
}
