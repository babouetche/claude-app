import AppKit
import PartiCore

/// Assistant « Nouvelle partition » (équivalent de la fenêtre de création d'Encore).
final class NewScoreAssistant {
    struct Result {
        var template: ScoreTemplate
        var title: String
        var composer: String
        var time: TimeSignature
        var key: KeySignature
        var tempo: Double
        var measures: Int
    }

    static let times: [TimeSignature] = [TimeSignature(4, 4), TimeSignature(3, 4), TimeSignature(2, 4), TimeSignature(6, 8),
                                         TimeSignature(2, 2), TimeSignature(3, 8), TimeSignature(9, 8), TimeSignature(12, 8),
                                         TimeSignature(5, 4), TimeSignature(6, 4)]

    func begin(on window: NSWindow, completion: @escaping (Result?) -> Void) {
        let alert = NSAlert()
        alert.messageText = "Nouvelle partition"
        alert.informativeText = "Choisissez l'instrument et les réglages de départ. Tout reste modifiable ensuite."
        if let icon = NSApp.applicationIconImage { alert.icon = icon }

        let template = NSPopUpButton()
        for t in ScoreTemplate.allCases { template.addItem(withTitle: t.frenchName) }
        if let last = UserDefaults.standard.string(forKey: "lastTemplate"),
           let i = ScoreTemplate.allCases.firstIndex(where: { $0.rawValue == last }) { template.selectItem(at: i) }

        let title = NSTextField(string: "")
        title.placeholderString = "Sans titre"
        let composer = NSTextField(string: UserDefaults.standard.string(forKey: "lastComposer") ?? "")
        composer.placeholderString = "Facultatif"

        let key = NSPopUpButton()
        for f in (-7...7).reversed() { key.addItem(withTitle: KeySignature(f).frenchName); key.lastItem?.tag = f }
        key.selectItem(withTag: 0)

        let time = NSPopUpButton()
        for t in NewScoreAssistant.times { time.addItem(withTitle: t.description) }

        let tempo = NSTextField(string: "100")
        tempo.formatter = { let f = NumberFormatter(); f.minimum = 20; f.maximum = 400; f.maximumFractionDigits = 0; return f }()
        let measures = NSTextField(string: "16")
        measures.formatter = { let f = NumberFormatter(); f.minimum = 1; f.maximum = 999; f.maximumFractionDigits = 0; return f }()

        let grid = NSGridView(views: [
            [label("Instrument :"), template],
            [label("Titre :"), title],
            [label("Compositeur :"), composer],
            [label("Tonalité :"), key],
            [label("Mesure :"), time],
            [label("Tempo (♩ par minute) :"), tempo],
            [label("Nombre de mesures :"), measures],
        ])
        grid.rowSpacing = 8
        grid.column(at: 0).xPlacement = .trailing
        for v in [template, title, composer, key, time] as [NSView] { v.widthAnchor.constraint(equalToConstant: 300).isActive = true }
        for v in [tempo, measures] { v.widthAnchor.constraint(equalToConstant: 70).isActive = true }
        grid.frame = NSRect(x: 0, y: 0, width: 470, height: 230)
        alert.accessoryView = grid
        alert.addButton(withTitle: "Créer la partition")
        alert.addButton(withTitle: "Annuler")
        alert.window.initialFirstResponder = template

        alert.beginSheetModal(for: window) { response in
            guard response == .alertFirstButtonReturn else { completion(nil); return }
            let tpl = ScoreTemplate.allCases[max(0, template.indexOfSelectedItem)]
            UserDefaults.standard.set(tpl.rawValue, forKey: "lastTemplate")
            UserDefaults.standard.set(composer.stringValue, forKey: "lastComposer")
            completion(Result(template: tpl,
                              title: title.stringValue,
                              composer: composer.stringValue,
                              time: NewScoreAssistant.times[max(0, time.indexOfSelectedItem)],
                              key: KeySignature(key.selectedTag()),
                              tempo: tempo.doubleValue > 0 ? tempo.doubleValue : 100,
                              measures: measures.integerValue > 0 ? measures.integerValue : 16))
        }
    }

    private func label(_ s: String) -> NSTextField { NSTextField(labelWithString: s) }
}
