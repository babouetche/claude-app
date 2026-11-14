import AppKit
import UniformTypeIdentifiers
import PartiCore

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillFinishLaunching(_ notification: Notification) {
        LaunchLog.write("willFinishLaunching")
        // Le premier contrôleur créé devient le contrôleur partagé : on impose le nôtre.
        _ = DocumentController()
        LaunchLog.write("contrôleur de documents : \(type(of: NSDocumentController.shared))")
        Fonts.register()
        NSApp.mainMenu = MainMenu.build()
        LaunchLog.write("menus prêts")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.activate(ignoringOtherApps: true)
        LaunchLog.write("didFinishLaunching — fenêtres : \(NSApp.windows.count), documents : \(NSDocumentController.shared.documents.count)")
        // Si aucune partition n'a été ouverte (fichier double-cliqué, restauration), on en crée une nous-mêmes.
        // Léger délai : si l'app a été ouverte par un double-clic sur un fichier, il arrive juste après.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { AppDelegate.ensureWindow() }
        // Vérification discrète des mises à jour (une fois par jour).
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { Updater.checkAutomatically() }
    }

    static func ensureWindow() {
        let dc = NSDocumentController.shared
        guard dc.documents.isEmpty else {
            for d in dc.documents where d.windowControllers.isEmpty { d.makeWindowControllers(); d.showWindows() }
            return
        }
        do {
            let doc = try dc.openUntitledDocumentAndDisplay(true)
            LaunchLog.write("nouvelle partition créée : \(type(of: doc)), fenêtres liées : \(doc.windowControllers.count)")
            // Ceinture et bretelles : on s'assure que la fenêtre est bien montrée.
            if doc.windowControllers.isEmpty { doc.makeWindowControllers() }
            doc.showWindows()
            for wc in doc.windowControllers where wc.window?.isVisible != true { wc.showWindow(nil) }
        } catch {
            LaunchLog.write("ERREUR création partition (méthode standard) : \(error)")
            // Repli : création directe, sans passer par les types de documents.
            let doc = ScoreDocument()
            doc.fileType = ScoreDocument.typeIdentifier
            dc.addDocument(doc)
            doc.makeWindowControllers()
            doc.showWindows()
            LaunchLog.write("partition créée par la méthode de secours")
        }
    }

    /// La partition de départ est créée par ensureWindow() (plus fiable que le mécanisme automatique).
    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { AppDelegate.ensureWindow() }
        return true
    }
    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool { true }

    // MARK: Commandes globales

    /// Crée une partition à partir d'un fichier Encore (.enc) ou MIDI, et l'affiche.
    @discardableResult
    static func importDocument(from url: URL) throws -> ScoreDocument {
        let data = try Data(contentsOf: url)
        let name = url.deletingPathExtension().lastPathComponent
        let doc = ScoreDocument()
        doc.importedContent = true
        var message = ""
        if url.pathExtension.lowercased() == "enc" {
            let (score, report) = try EncoreImporter.importScore(from: data, fileName: name)
            doc.score = score
            message = "Partition Encore importée : \(report.measures) mesures, \(report.notes) notes, \(report.texts) textes."
            if report.hiddenVoiceNotes > 0 { message += " \(report.hiddenVoiceNotes) notes de voix secondaires ne sont pas encore affichées." }
            if report.skippedGraceNotes > 0 { message += " \(report.skippedGraceNotes) notes d'ornement ignorées." }
        } else {
            doc.score = try MIDIImporter.score(from: data, title: name)
            message = "Fichier MIDI importé."
        }
        doc.fileType = ScoreDocument.typeIdentifier
        doc.displayName = name
        NSDocumentController.shared.addDocument(doc)
        doc.makeWindowControllers()
        doc.showWindows()
        doc.updateChangeCount(.changeDone)
        (doc.windowControllers.first as? ScoreWindowController)?.showStatus(message + " Enregistrez-la (⌘S) pour la garder au format de l'app.", isError: false)
        LaunchLog.write("import \(url.lastPathComponent) : \(message)")
        return doc
    }

    @objc func checkForUpdates(_ sender: Any?) { Updater.check(userInitiated: true) }

    @objc func importEncore(_ sender: Any?) {
        let panel = NSOpenPanel()
        // Pas de filtre par type : Encore déclare ses propres types de fichiers, qui seraient grisés.
        // On filtre par extension.
        let filter = ExtensionFilter(["enc"])
        panel.delegate = filter
        panel.allowsMultipleSelection = true
        panel.message = "Choisissez une ou plusieurs partitions Encore (.enc) à ouvrir"
        panel.prompt = "Importer"
        let response = panel.runModal()
        withExtendedLifetime(filter) {}
        guard response == .OK else { return }
        var failures: [String] = []
        for url in panel.urls {
            do { try AppDelegate.importDocument(from: url) } catch { failures.append("\(url.lastPathComponent) : \(error.localizedDescription)") }
        }
        if !failures.isEmpty {
            let a = NSAlert()
            a.messageText = "Certaines partitions n'ont pas pu être importées."
            a.informativeText = failures.joined(separator: "\n")
            a.runModal()
        }
    }

    @objc func importMIDI(_ sender: Any?) {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [UTType(filenameExtension: "mid") ?? .midi, UTType(filenameExtension: "midi") ?? .midi, .midi]
        panel.message = "Choisissez un fichier MIDI à transformer en partition"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let data = try Data(contentsOf: url)
            let score = try MIDIImporter.score(from: data, title: url.deletingPathExtension().lastPathComponent)
            let doc = ScoreDocument()
            doc.importedContent = true
            doc.score = score
            NSDocumentController.shared.addDocument(doc)
            doc.makeWindowControllers()
            doc.showWindows()
            doc.updateChangeCount(.changeDone)
        } catch {
            let a = NSAlert()
            a.messageText = "Impossible d'importer ce fichier MIDI."
            a.informativeText = error.localizedDescription
            a.runModal()
        }
    }

    @objc func showShortcuts(_ sender: Any?) {
        let a = NSAlert()
        a.messageText = "Raccourcis clavier — Partitions de Titi"
        a.informativeText = """
        SAISIE
        1 à 7 : ronde, blanche, noire, croche, double, triple, quadruple croche (0 = carrée, 8 = quintuple)
        A B C D E F G : poser la note la, si, do, ré, mi, fa, sol (à la hauteur la plus proche)
        Maj + lettre : ajouter la note à l'accord
        Entrée : poser un silence  ·  R : mode silences pour la souris
        . : point  ·  + dièse  ·  - bémol  ·  = bécarre  ·  T : liaison
        Clic sur la portée : poser une note  ·  Maj + clic : ajouter à l'accord

        MODIFIER
        Échap : passer de la saisie (crayon) à la sélection (flèche)
        ← → : note précédente / suivante
        ↑ ↓ : un demi-ton  ·  Maj ↑↓ : un degré  ·  ⌥ ↑↓ : une octave
        Suppr : remplacer par un silence
        Glisser une note (flèche) : changer sa hauteur
        ⌘ Z : annuler  ·  ⇧⌘ Z : rétablir

        LECTURE ET FICHIERS
        Espace : écouter / arrêter (à partir de la note sélectionnée)
        ⌘ S : enregistrer  ·  ⌘ E : exporter en PDF  ·  ⌘ P : imprimer
        ⌘ + / ⌘ - : zoom
        """
        a.runModal()
    }
}

enum MainMenu {
    static func build() -> NSMenu {
        let main = NSMenu()

        // PartiMac
        let app = submenu(main, "Partitions de Titi")
        app.addItem(withTitle: "À propos de Partitions de Titi", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        app.addItem(withTitle: "Rechercher les mises à jour…", action: #selector(AppDelegate.checkForUpdates(_:)), keyEquivalent: "")
        app.addItem(.separator())
        let services = NSMenu(title: "Services")
        app.addItem(withTitle: "Services", action: nil, keyEquivalent: "").submenu = services
        NSApp.servicesMenu = services
        app.addItem(.separator())
        app.addItem(withTitle: "Masquer Partitions de Titi", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let others = app.addItem(withTitle: "Masquer les autres", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        others.keyEquivalentModifierMask = [.command, .option]
        app.addItem(withTitle: "Tout afficher", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Quitter Partitions de Titi", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Fichier
        let file = submenu(main, "Fichier")
        file.addItem(withTitle: "Nouvelle partition…", action: #selector(NSDocumentController.newDocument(_:)), keyEquivalent: "n")
        file.addItem(withTitle: "Ouvrir…", action: #selector(NSDocumentController.openDocument(_:)), keyEquivalent: "o")
        let recent = NSMenu(title: "Ouvrir récent")
        recent.addItem(withTitle: "Effacer le menu", action: #selector(NSDocumentController.clearRecentDocuments(_:)), keyEquivalent: "")
        file.addItem(withTitle: "Ouvrir récent", action: nil, keyEquivalent: "").submenu = recent
        file.addItem(.separator())
        file.addItem(withTitle: "Fermer", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        file.addItem(withTitle: "Enregistrer…", action: #selector(NSDocument.save(_:)), keyEquivalent: "s")
        let saveAs = file.addItem(withTitle: "Enregistrer sous…", action: #selector(NSDocument.saveAs(_:)), keyEquivalent: "s")
        saveAs.keyEquivalentModifierMask = [.command, .shift]
        file.addItem(withTitle: "Revenir à…", action: #selector(NSDocument.revertToSaved(_:)), keyEquivalent: "")
        file.addItem(.separator())
        let enc = file.addItem(withTitle: "Importer des partitions Encore (.enc)…", action: #selector(AppDelegate.importEncore(_:)), keyEquivalent: "i")
        enc.keyEquivalentModifierMask = [.command, .shift]
        file.addItem(withTitle: "Importer un fichier MIDI…", action: #selector(AppDelegate.importMIDI(_:)), keyEquivalent: "")
        file.addItem(withTitle: "Exporter en PDF…", action: #selector(ScoreWindowController.exportPDF(_:)), keyEquivalent: "e")
        file.addItem(withTitle: "Exporter en MIDI…", action: #selector(ScoreWindowController.exportMIDI(_:)), keyEquivalent: "")
        file.addItem(.separator())
        file.addItem(withTitle: "Imprimer…", action: #selector(ScoreWindowController.printScore(_:)), keyEquivalent: "p")

        // Édition
        let edit = submenu(main, "Édition")
        edit.addItem(withTitle: "Annuler", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Rétablir", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Couper", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copier", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Coller", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Tout sélectionner", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // Mesures
        let measures = submenu(main, "Mesures")
        let add = measures.addItem(withTitle: "Ajouter une mesure à la fin", action: #selector(ScoreWindowController.appendMeasure(_:)), keyEquivalent: "m")
        add.keyEquivalentModifierMask = [.command, .option]
        measures.addItem(withTitle: "Insérer une mesure avant la sélection", action: #selector(ScoreWindowController.insertMeasure(_:)), keyEquivalent: "")
        measures.addItem(withTitle: "Supprimer la mesure sélectionnée", action: #selector(ScoreWindowController.deleteMeasure(_:)), keyEquivalent: "")

        // Partition
        let score = submenu(main, "Partition")
        score.addItem(withTitle: "Titre et compositeur…", action: #selector(ScoreWindowController.editScoreInfo(_:)), keyEquivalent: "")

        // Lecture
        let play = submenu(main, "Lecture")
        play.addItem(withTitle: "Écouter / arrêter (Espace)", action: #selector(ScoreWindowController.togglePlayback(_:)), keyEquivalent: "")
        play.addItem(withTitle: "Écouter depuis le début", action: #selector(ScoreWindowController.playFromStart(_:)), keyEquivalent: "")

        // Présentation
        let view = submenu(main, "Présentation")
        view.addItem(withTitle: "Zoom avant", action: #selector(ScoreWindowController.zoomIn(_:)), keyEquivalent: "+")
        view.addItem(withTitle: "Zoom arrière", action: #selector(ScoreWindowController.zoomOut(_:)), keyEquivalent: "-")
        view.addItem(withTitle: "Taille normale", action: #selector(ScoreWindowController.zoomActual(_:)), keyEquivalent: "0")
        view.addItem(.separator())
        let fs = view.addItem(withTitle: "Plein écran", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fs.keyEquivalentModifierMask = [.command, .control]

        // Fenêtre
        let window = submenu(main, "Fenêtre")
        window.addItem(withTitle: "Placer dans le Dock", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        window.addItem(withTitle: "Réduire/agrandir", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        NSApp.windowsMenu = window

        // Aide
        let help = submenu(main, "Aide")
        help.addItem(withTitle: "Raccourcis clavier", action: #selector(AppDelegate.showShortcuts(_:)), keyEquivalent: "?")
        NSApp.helpMenu = help

        return main
    }

    private static func submenu(_ main: NSMenu, _ title: String) -> NSMenu {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        let menu = NSMenu(title: title)
        item.submenu = menu
        main.addItem(item)
        return menu
    }
}

/// Contrôleur de documents : type et classe déclarés dans le code, sans dépendre de la lecture d'Info.plist.
final class DocumentController: NSDocumentController {
    static let encoreType = "com.passport.encore.score"
    static let midiType = "public.midi-audio"

    override var defaultType: String? { ScoreDocument.typeIdentifier }
    override var documentClassNames: [String] { [NSStringFromClass(ScoreDocument.self)] }
    override func documentClass(forType typeName: String) -> AnyClass? { ScoreDocument.self }
    override func typeForContents(of url: URL) throws -> String {
        switch url.pathExtension.lowercased() {
        case "enc": return DocumentController.encoreType
        case "mid", "midi": return DocumentController.midiType
        default: return ScoreDocument.typeIdentifier
        }
    }

    /// Fenêtre « Ouvrir » : on accepte nos partitions, Encore et MIDI, reconnus par leur extension.
    let openFilter = ExtensionFilter(["partimac", "enc", "mid", "midi"])

    override func beginOpenPanel(_ openPanel: NSOpenPanel, forTypes inTypes: [String]?, completionHandler: @escaping (Int) -> Void) {
        openPanel.delegate = openFilter
        openPanel.allowsMultipleSelection = true
        openPanel.message = "Choisissez une partition (Partitions de Titi, Encore .enc ou MIDI)"
        super.beginOpenPanel(openPanel, forTypes: nil, completionHandler: completionHandler)
    }

    override func runModalOpenPanel(_ openPanel: NSOpenPanel, forTypes types: [String]?) -> Int {
        openPanel.delegate = openFilter
        openPanel.allowsMultipleSelection = true
        return super.runModalOpenPanel(openPanel, forTypes: nil)
    }

    /// Les fichiers Encore et MIDI s'ouvrent comme une nouvelle partition (l'original n'est jamais modifié).
    override func openDocument(withContentsOf url: URL, display displayDocument: Bool,
                               completionHandler: @escaping (NSDocument?, Bool, Error?) -> Void) {
        let ext = url.pathExtension.lowercased()
        guard ["enc", "mid", "midi"].contains(ext) else {
            super.openDocument(withContentsOf: url, display: displayDocument, completionHandler: completionHandler)
            return
        }
        do {
            let doc = try AppDelegate.importDocument(from: url)
            completionHandler(doc, false, nil)
        } catch {
            LaunchLog.write("ERREUR import \(url.lastPathComponent) : \(error)")
            completionHandler(nil, false, error)
        }
    }
}

/// Filtre des fenêtres d'ouverture par extension (insensible à la casse).
final class ExtensionFilter: NSObject, NSOpenSavePanelDelegate {
    let extensions: Set<String>
    init(_ extensions: [String]) { self.extensions = Set(extensions) }
    func panel(_ sender: Any, shouldEnable url: URL) -> Bool {
        url.hasDirectoryPath || extensions.contains(url.pathExtension.lowercased())
    }
}
