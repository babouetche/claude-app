import AppKit
import PartiCore

/// Document .partimac : enregistrement automatique, versions et récupération après plantage gérés par macOS.
@objc(ScoreDocument)
final class ScoreDocument: NSDocument {
    static let typeIdentifier = "com.partimac.score"

    var score: Score = Score.make(template: .piano) {
        didSet { layoutCache = nil; onChange?() }
    }
    /// Vrai si la partition vient d'être créée (pas ouverte depuis un fichier) : on propose l'assistant.
    var needsSetup = false
    var onChange: (() -> Void)?

    private var layoutCache: ScoreLayout?
    var layout: ScoreLayout {
        if let l = layoutCache { return l }
        let l = LayoutEngine().layout(score)
        layoutCache = l
        return l
    }

    override init() {
        super.init()
        hasUndoManager = true
    }

    override class var autosavesInPlace: Bool { true }
    override class var preservesVersions: Bool { true }

    override func makeWindowControllers() {
        if fileURL == nil && autosavedContentsFileURL == nil && !isDocumentEdited && !importedContent {
            needsSetup = true
        }
        LaunchLog.write("création de la fenêtre de partition")
        addWindowController(ScoreWindowController(document: self))
    }

    var importedContent = false

    override func data(ofType typeName: String) throws -> Data {
        try ScoreCodec.encode(score)
    }

    override func read(from data: Data, ofType typeName: String) throws {
        score = try ScoreCodec.decode(data)
    }

    /// Applique une modification annulable.
    @discardableResult
    func apply(_ actionName: String, _ change: (inout Score) throws -> Void) -> Bool {
        var s = score
        do { try change(&s) } catch {
            NSSound.beep()
            (windowControllers.first as? ScoreWindowController)?.showStatus(error.localizedDescription, isError: true)
            return false
        }
        guard s != score else { return true }
        replaceScore(with: s, actionName: actionName)
        return true
    }

    func replaceScore(with new: Score, actionName: String) {
        let old = score
        undoManager?.registerUndo(withTarget: self) { doc in
            doc.replaceScore(with: old, actionName: actionName)
        }
        undoManager?.setActionName(actionName)
        score = new
    }

    // MARK: Exports

    func exportPDF(to url: URL) throws {
        try Exporter.pdfData(layout).write(to: url)
    }

    func exportMIDI(to url: URL) throws {
        try MIDIExporter.data(for: score).write(to: url)
    }

    var suggestedBaseName: String {
        if let name = fileURL?.deletingPathExtension().lastPathComponent { return name }
        let t = score.metadata.title.trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? "Partition" : t
    }
}
