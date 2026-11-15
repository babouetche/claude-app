import PartiCore

/// Presse-papiers interne (partagé entre les fenêtres).
enum AppClipboard {
    enum Content {
        case notes(NoteClip)
        case measures(MeasureClip)
    }
    static var content: Content?
}
