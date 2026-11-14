import Foundation

// MARK: - Hauteurs

/// Hauteur écrite : degré (0 = do … 6 = si), altération (-2…+2), octave (do central = do4).
public struct Pitch: Hashable, Codable {
    public var step: Int
    public var alter: Int
    public var octave: Int

    public init(step: Int, alter: Int = 0, octave: Int) {
        self.step = step; self.alter = alter; self.octave = octave
    }

    /// Construit à partir d'un indice diatonique (octave * 7 + degré).
    public init(diatonic: Int, alter: Int = 0) {
        let o = diatonic >= 0 ? diatonic / 7 : (diatonic - 6) / 7
        self.init(step: diatonic - o * 7, alter: alter, octave: o)
    }

    static let semitones = [0, 2, 4, 5, 7, 9, 11]
    public static let letters = ["C", "D", "E", "F", "G", "A", "B"]
    public static let frenchNames = ["do", "ré", "mi", "fa", "sol", "la", "si"]

    public var diatonic: Int { octave * 7 + step }
    public var midi: Int { (octave + 1) * 12 + Pitch.semitones[step] + alter }

    public var frenchName: String {
        let acc = ["♭♭", "♭", "", "♯", "♯♯"][max(0, min(4, alter + 2))]
        return "\(Pitch.frenchNames[step])\(acc)\(octave)"
    }

    private static let sharpSpelling = [(0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (3, 0), (3, 1), (4, 0), (4, 1), (5, 0), (5, 1), (6, 0)]
    private static let flatSpelling = [(0, 0), (1, -1), (1, 0), (2, -1), (2, 0), (3, 0), (4, -1), (4, 0), (5, -1), (5, 0), (6, -1), (6, 0)]

    public static func fromMIDI(_ m: Int, preferFlats: Bool = false) -> Pitch {
        let pc = ((m % 12) + 12) % 12
        let octave = (m - pc) / 12 - 1
        let s = preferFlats ? flatSpelling[pc] : sharpSpelling[pc]
        return Pitch(step: s.0, alter: s.1, octave: octave)
    }
}

// MARK: - Durées

/// Valeurs de notes. Les valeurs brutes correspondent aux touches d'Encore (0 = carrée … 8 = quintuple croche).
public enum DurationBase: Int, Codable, CaseIterable {
    case breve = 0, whole, half, quarter, eighth, sixteenth, thirtySecond, sixtyFourth, hundredTwentyEighth

    public var fraction: Fraction { self == .breve ? Fraction(2) : Fraction(1, 1 << (rawValue - 1)) }

    public var frenchName: String {
        ["Carrée", "Ronde", "Blanche", "Noire", "Croche", "Double croche", "Triple croche", "Quadruple croche", "Quintuple croche"][rawValue]
    }

    /// Nombre de crochets / barres de ligature (0 pour noire et plus longues).
    public var flagCount: Int { max(0, rawValue - 3) }
    public var hasStem: Bool { rawValue >= 2 }
}

public struct Duration: Hashable, Codable {
    public var base: DurationBase
    public var dots: Int

    public init(_ base: DurationBase, dots: Int = 0) { self.base = base; self.dots = dots }

    /// Durée en rondes (avec points).
    public var fraction: Fraction {
        var total = base.fraction
        var add = base.fraction
        for _ in 0..<dots { add = add * Fraction(1, 2); total += add }
        return total
    }

    public var frenchName: String {
        base.frenchName + (dots == 1 ? " pointée" : dots == 2 ? " doublement pointée" : "")
    }

    /// Toutes les durées simples ou pointées, de la plus longue à la plus courte.
    public static let candidates: [Duration] = {
        var all: [Duration] = []
        for b in DurationBase.allCases { for d in 0...2 { all.append(Duration(b, dots: d)) } }
        return all.sorted { $0.fraction > $1.fraction }
    }()

    /// Durée exactement égale à `length`, si elle existe.
    public static func exact(_ length: Fraction) -> Duration? {
        candidates.first { $0.fraction == length }
    }

    /// Découpe une longueur en durées (notes liées), de la plus longue à la plus courte.
    public static func decompose(_ length: Fraction, allowDots: Bool = true) -> [Duration] {
        var rest = length
        var out: [Duration] = []
        let list = candidates.filter { allowDots ? $0.dots <= 1 : $0.dots == 0 }
        while rest > .zero {
            guard let d = list.first(where: { $0.fraction <= rest }) else { break }
            out.append(d); rest -= d.fraction
        }
        return out
    }

    /// Durées de silences alignées sur la pulsation, à partir de la position `start`.
    public static func alignedRests(from start: Fraction, length: Fraction) -> [Duration] {
        var pos = start
        let end = start + length
        var out: [Duration] = []
        let bases = DurationBase.allCases.filter { $0 != .breve }
        while pos < end {
            let remaining = end - pos
            let pick = bases.first { $0.fraction <= remaining && pos.isMultiple(of: $0.fraction) }
                ?? bases.first { $0.fraction <= remaining }
            guard let b = pick else { break }
            out.append(Duration(b)); pos += b.fraction
        }
        return out
    }
}

// MARK: - Événements

public struct Note: Hashable, Codable, Identifiable {
    public var id: UUID
    public var pitch: Pitch
    /// Liaison de prolongation vers la note de même hauteur suivante.
    public var tie: Bool
    public var velocity: Int

    public init(id: UUID = UUID(), pitch: Pitch, tie: Bool = false, velocity: Int = 80) {
        self.id = id; self.pitch = pitch; self.tie = tie; self.velocity = velocity
    }
}

/// Articulations attachées à une note.
public enum Articulation: String, Codable, CaseIterable {
    case staccato, accent, tenuto, marcato, fermata, staccatissimo

    public var frenchName: String {
        switch self {
        case .staccato: return "Staccato"
        case .accent: return "Accent"
        case .tenuto: return "Tenuto"
        case .marcato: return "Marcato"
        case .fermata: return "Point d'orgue"
        case .staccatissimo: return "Staccatissimo"
        }
    }
}

/// Signe qui relie deux notes : liaison de phrasé, soufflet de crescendo / decrescendo.
public enum SpannerKind: String, Codable { case slur, crescendo, diminuendo }

public struct Spanner: Hashable, Codable, Identifiable {
    public var id: UUID
    public var kind: SpannerKind
    public var staff: StaffRef
    public var startMeasure: Int
    public var startEvent: UUID
    public var endMeasure: Int
    public var endEvent: UUID
    public init(id: UUID = UUID(), kind: SpannerKind, staff: StaffRef, startMeasure: Int, startEvent: UUID, endMeasure: Int, endEvent: UUID) {
        self.id = id; self.kind = kind; self.staff = staff
        self.startMeasure = startMeasure; self.startEvent = startEvent; self.endMeasure = endMeasure; self.endEvent = endEvent
    }
}

/// Nuances et vélocités MIDI correspondantes.
public enum Dynamics {
    public static let all: [(name: String, glyph: UInt32, velocity: Int)] = [
        ("ppp", 0xE52A, 24), ("pp", 0xE52B, 36), ("p", 0xE520, 50), ("mp", 0xE52C, 64), ("mf", 0xE52D, 80), ("f", 0xE522, 96),
        ("ff", 0xE52F, 112), ("fff", 0xE530, 124), ("fp", 0xE534, 96), ("sfz", 0xE539, 112),
    ]
    public static func velocity(_ text: String) -> Int? { all.first { $0.name == text }?.velocity }
}

/// n-olet : `actual` notes dans le temps de `normal`.
public struct Tuplet: Hashable, Codable {
    public var actual: Int
    public var normal: Int
    public init(actual: Int, normal: Int) { self.actual = actual; self.normal = normal }
}

/// Note, accord ou silence.
public struct Event: Hashable, Codable, Identifiable {
    public var id: UUID
    public var duration: Duration
    /// Vide = silence.
    public var notes: [Note]
    /// Silence de mesure entière (pause centrée, durée = la mesure).
    public var isMeasureRest: Bool
    public var tuplet: Tuplet?
    public var articulations: [Articulation]?
    /// Couleur d'affichage (0xRRGGBB), nil = noir.
    public var color: UInt32?

    public init(id: UUID = UUID(), duration: Duration, notes: [Note] = [], isMeasureRest: Bool = false, tuplet: Tuplet? = nil) {
        self.id = id; self.duration = duration; self.notes = notes; self.isMeasureRest = isMeasureRest; self.tuplet = tuplet
    }

    public var isRest: Bool { notes.isEmpty }

    public func length(measureLength: Fraction) -> Fraction {
        if isMeasureRest { return measureLength }
        var f = duration.fraction
        if let t = tuplet { f = f * Fraction(t.normal, t.actual) }
        return f
    }

    public static func measureRest() -> Event { Event(duration: Duration(.whole), isMeasureRest: true) }
}

public struct Voice: Hashable, Codable {
    public var events: [Event]
    public init(events: [Event]) { self.events = events }
}

public struct StaffMeasure: Hashable, Codable {
    /// voices[0] existe toujours.
    public var voices: [Voice]
    public init(voices: [Voice] = [Voice(events: [.measureRest()])]) { self.voices = voices }
}

// MARK: - Clés, armures, métriques

public enum Clef: String, Codable, CaseIterable {
    case treble, bass, alto, tenor, treble8vb

    public var frenchName: String {
        switch self {
        case .treble: return "Clé de sol"
        case .bass: return "Clé de fa"
        case .alto: return "Clé d'ut 3e"
        case .tenor: return "Clé d'ut 4e"
        case .treble8vb: return "Clé de sol octaviée"
        }
    }

    /// Indice diatonique de la hauteur sur la ligne du bas.
    public var bottomLineDiatonic: Int {
        switch self {
        case .treble: return Pitch(step: 2, octave: 4).diatonic      // mi4
        case .bass: return Pitch(step: 4, octave: 2).diatonic        // sol2
        case .alto: return Pitch(step: 3, octave: 3).diatonic        // fa3
        case .tenor: return Pitch(step: 1, octave: 3).diatonic       // ré3
        case .treble8vb: return Pitch(step: 2, octave: 3).diatonic   // mi3
        }
    }

    /// Position (en demi-interlignes depuis la ligne du bas) de la ligne de référence de la clé.
    public var anchorPosition: Int {
        switch self {
        case .treble, .treble8vb: return 2
        case .bass: return 6
        case .alto: return 4
        case .tenor: return 6
        }
    }

    /// Positions des dièses / bémols de l'armure.
    public func keySignaturePositions(sharps: Bool) -> [Int] {
        let trebleSharps = [8, 5, 9, 6, 3, 7, 4]
        let trebleFlats = [4, 7, 3, 6, 2, 5, 1]
        switch self {
        case .treble, .treble8vb: return sharps ? trebleSharps : trebleFlats
        case .bass: return (sharps ? trebleSharps : trebleFlats).map { $0 - 2 }
        case .alto: return (sharps ? trebleSharps : trebleFlats).map { $0 - 1 }
        case .tenor: return sharps ? [2, 6, 3, 7, 4, 8, 5] : trebleFlats.map { $0 + 1 }
        }
    }
}

public struct KeySignature: Hashable, Codable {
    /// Nombre de dièses (> 0) ou de bémols (< 0).
    public var fifths: Int
    public init(_ fifths: Int) { self.fifths = max(-7, min(7, fifths)) }

    static let sharpOrder = [3, 0, 4, 1, 5, 2, 6]   // fa do sol ré la mi si
    static let flatOrder = [6, 2, 5, 1, 4, 0, 3]    // si mi la ré sol do fa

    /// Altération implicite du degré `step`.
    public func alter(forStep step: Int) -> Int {
        if fifths > 0 { return KeySignature.sharpOrder.prefix(fifths).contains(step) ? 1 : 0 }
        if fifths < 0 { return KeySignature.flatOrder.prefix(-fifths).contains(step) ? -1 : 0 }
        return 0
    }

    public static let majorNames = ["do♭", "sol♭", "ré♭", "la♭", "mi♭", "si♭", "fa", "do", "sol", "ré", "la", "mi", "si", "fa♯", "do♯"]
    public static let minorNames = ["la♭", "mi♭", "si♭", "fa", "do", "sol", "ré", "la", "mi", "si", "fa♯", "do♯", "sol♯", "ré♯", "la♯"]

    public var frenchName: String {
        let i = fifths + 7
        let n = fifths == 0 ? "aucune altération" : "\(abs(fifths)) \(fifths > 0 ? "dièse" : "bémol")\(abs(fifths) > 1 ? "s" : "")"
        return "\(KeySignature.majorNames[i].capitalized) majeur / \(KeySignature.minorNames[i]) mineur (\(n))"
    }
}

public struct TimeSignature: Hashable, Codable {
    public var beats: Int
    public var beatType: Int
    public init(_ beats: Int, _ beatType: Int) { self.beats = beats; self.beatType = beatType }

    public var measureLength: Fraction { Fraction(beats, beatType) }
    public var isCompound: Bool { beatType >= 8 && beats % 3 == 0 && beats > 3 }

    /// Longueur d'un groupe de ligature.
    public var beamGroup: Fraction {
        if isCompound { return Fraction(3, beatType) }
        if beatType == 8 && beats == 3 { return Fraction(3, 8) }
        if beatType >= 8 { return Fraction(1, beatType) * 2 }
        return Fraction(1, beatType)
    }

    public var description: String { "\(beats)/\(beatType)" }
}

public enum Barline: String, Codable { case regular, double, final, repeatEnd }

/// Données globales d'une mesure (communes à toutes les portées).
public struct MeasureInfo: Hashable, Codable {
    public var time: TimeSignature
    public var key: KeySignature
    /// Tempo (noires par minute) qui démarre à cette mesure ; nil = inchangé.
    public var tempo: Double?
    public var barline: Barline
    /// Barre de reprise au début de la mesure.
    public var repeatStart: Bool = false
    /// Longueur réelle si différente de la métrique (mesure de levée).
    public var lengthOverride: Fraction?
    /// Case de 1re/2e/3e fois : un bit par passage (1 = 1re fois, 2 = 2e fois, 4 = 3e fois…).
    public var volta: Int = 0
    /// Commence une nouvelle ligne (système) à cette mesure.
    public var systemBreak: Bool = false

    public init(time: TimeSignature, key: KeySignature, tempo: Double? = nil, barline: Barline = .regular) {
        self.time = time; self.key = key; self.tempo = tempo; self.barline = barline
    }

    enum CodingKeys: String, CodingKey { case time, key, tempo, barline, repeatStart, lengthOverride, volta, systemBreak }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        time = try c.decode(TimeSignature.self, forKey: .time)
        key = try c.decode(KeySignature.self, forKey: .key)
        tempo = try c.decodeIfPresent(Double.self, forKey: .tempo)
        barline = try c.decodeIfPresent(Barline.self, forKey: .barline) ?? .regular
        repeatStart = try c.decodeIfPresent(Bool.self, forKey: .repeatStart) ?? false
        lengthOverride = try c.decodeIfPresent(Fraction.self, forKey: .lengthOverride)
        volta = try c.decodeIfPresent(Int.self, forKey: .volta) ?? 0
        systemBreak = try c.decodeIfPresent(Bool.self, forKey: .systemBreak) ?? false
    }
}

/// Texte attaché à une position (accord, basse, doigté, indication…).
public struct Annotation: Hashable, Codable, Identifiable {
    public var id: UUID
    public var staff: StaffRef
    public var measure: Int
    public var offset: Fraction
    public var text: String
    /// Au-dessus (true) ou au-dessous (false) de la portée.
    public var above: Bool
    /// Hauteur précise (demi-interlignes depuis la ligne du bas), si connue.
    public var staffPosition: Int?
    /// Symbole musical (point de code SMuFL) à dessiner à la place du texte.
    public var glyph: UInt32?

    public init(id: UUID = UUID(), staff: StaffRef, measure: Int, offset: Fraction, text: String, above: Bool,
                staffPosition: Int? = nil, glyph: UInt32? = nil) {
        self.id = id; self.staff = staff; self.measure = measure; self.offset = offset; self.text = text; self.above = above
        self.staffPosition = staffPosition; self.glyph = glyph
    }
}

// MARK: - Portées, parties, partition

public struct Staff: Hashable, Codable, Identifiable {
    public var id: UUID
    public var clef: Clef
    public var measures: [StaffMeasure]
    public init(id: UUID = UUID(), clef: Clef, measures: [StaffMeasure]) {
        self.id = id; self.clef = clef; self.measures = measures
    }
}

public struct Part: Hashable, Codable, Identifiable {
    public var id: UUID
    public var name: String
    public var abbreviation: String
    /// Programme General MIDI (0-127).
    public var program: Int
    public var volume: Double
    public var pan: Double
    public var staves: [Staff]

    public init(id: UUID = UUID(), name: String, abbreviation: String = "", program: Int, volume: Double = 0.8, pan: Double = 0, staves: [Staff]) {
        self.id = id; self.name = name; self.abbreviation = abbreviation; self.program = program
        self.volume = volume; self.pan = pan; self.staves = staves
    }
}

public struct ScoreMetadata: Hashable, Codable {
    public var title: String
    public var subtitle: String
    public var composer: String
    public var copyright: String
    public init(title: String = "", subtitle: String = "", composer: String = "", copyright: String = "") {
        self.title = title; self.subtitle = subtitle; self.composer = composer; self.copyright = copyright
    }
}

public struct PageSettings: Hashable, Codable {
    public var width: Double = 595.28     // A4 en points
    public var height: Double = 841.89
    public var marginTop: Double = 48
    public var marginBottom: Double = 48
    public var marginLeft: Double = 48
    public var marginRight: Double = 42
    /// Interligne en points (taille de portée).
    public var staffSpace: Double = 6.2
    /// Police des textes (titre, accords, doigtés…). Times New Roman, comme dans Encore.
    public var textFont: String = "Times New Roman"
    public init() {}

    enum CodingKeys: String, CodingKey { case width, height, marginTop, marginBottom, marginLeft, marginRight, staffSpace, textFont }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        width = try c.decodeIfPresent(Double.self, forKey: .width) ?? width
        height = try c.decodeIfPresent(Double.self, forKey: .height) ?? height
        marginTop = try c.decodeIfPresent(Double.self, forKey: .marginTop) ?? marginTop
        marginBottom = try c.decodeIfPresent(Double.self, forKey: .marginBottom) ?? marginBottom
        marginLeft = try c.decodeIfPresent(Double.self, forKey: .marginLeft) ?? marginLeft
        marginRight = try c.decodeIfPresent(Double.self, forKey: .marginRight) ?? marginRight
        staffSpace = try c.decodeIfPresent(Double.self, forKey: .staffSpace) ?? staffSpace
        textFont = try c.decodeIfPresent(String.self, forKey: .textFont) ?? textFont
    }
}

/// Référence d'une portée : partie + indice de portée dans la partie.
public struct StaffRef: Hashable, Codable, Comparable {
    public var part: Int
    public var staff: Int
    public init(part: Int, staff: Int) { self.part = part; self.staff = staff }
    public static func < (a: StaffRef, b: StaffRef) -> Bool { (a.part, a.staff) < (b.part, b.staff) }
}

public struct Score: Hashable, Codable {
    public var formatVersion: Int = 1
    public var metadata: ScoreMetadata
    public var page: PageSettings
    public var measures: [MeasureInfo]
    public var parts: [Part]
    public var annotations: [Annotation] = []
    public var spanners: [Spanner] = []

    public init(metadata: ScoreMetadata = ScoreMetadata(), page: PageSettings = PageSettings(), measures: [MeasureInfo], parts: [Part]) {
        self.metadata = metadata; self.page = page; self.measures = measures; self.parts = parts
    }

    enum CodingKeys: String, CodingKey { case formatVersion, metadata, page, measures, parts, annotations, spanners }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        formatVersion = try c.decodeIfPresent(Int.self, forKey: .formatVersion) ?? 1
        metadata = try c.decodeIfPresent(ScoreMetadata.self, forKey: .metadata) ?? ScoreMetadata()
        page = try c.decodeIfPresent(PageSettings.self, forKey: .page) ?? PageSettings()
        measures = try c.decode([MeasureInfo].self, forKey: .measures)
        parts = try c.decode([Part].self, forKey: .parts)
        annotations = try c.decodeIfPresent([Annotation].self, forKey: .annotations) ?? []
        spanners = try c.decodeIfPresent([Spanner].self, forKey: .spanners) ?? []
    }

    public var measureCount: Int { measures.count }

    public var staffRefs: [StaffRef] {
        parts.indices.flatMap { p in parts[p].staves.indices.map { StaffRef(part: p, staff: $0) } }
    }

    public subscript(ref: StaffRef) -> Staff {
        get { parts[ref.part].staves[ref.staff] }
        set { parts[ref.part].staves[ref.staff] = newValue }
    }

    public func measureLength(_ m: Int) -> Fraction { measures[m].lengthOverride ?? measures[m].time.measureLength }

    /// Tempo en vigueur à la mesure `m`.
    public func tempo(at m: Int) -> Double {
        var t = 100.0
        for i in 0...min(m, measures.count - 1) where measures[i].tempo != nil { t = measures[i].tempo! }
        return t
    }

    /// Début de chaque mesure, en noires.
    public var measureStartBeats: [Double] {
        var out: [Double] = []
        var acc = 0.0
        for m in measures.indices { out.append(acc); acc += measureLength(m).doubleValue * 4 }
        out.append(acc)
        return out
    }
}

// MARK: - Modèles de partition

public enum ScoreTemplate: String, CaseIterable, Codable {
    case piano, accordion, melodyTreble, melodyBass

    public var frenchName: String {
        switch self {
        case .piano: return "Piano"
        case .accordion: return "Accordéon (main droite + main gauche)"
        case .melodyTreble: return "Mélodie seule (clé de sol)"
        case .melodyBass: return "Mélodie seule (clé de fa)"
        }
    }

    func makeParts(measures: Int) -> [Part] {
        func staff(_ c: Clef) -> Staff { Staff(clef: c, measures: Array(repeating: StaffMeasure(), count: measures)) }
        switch self {
        case .piano:
            return [Part(name: "Piano", abbreviation: "Pno.", program: 0, staves: [staff(.treble), staff(.bass)])]
        case .accordion:
            return [Part(name: "Accordéon", abbreviation: "Acc.", program: GM.accordion, staves: [staff(.treble), staff(.bass)])]
        case .melodyTreble:
            return [Part(name: "Mélodie", abbreviation: "Mél.", program: 0, staves: [staff(.treble)])]
        case .melodyBass:
            return [Part(name: "Basse", abbreviation: "B.", program: 32, staves: [staff(.bass)])]
        }
    }
}

/// Quelques programmes General MIDI utiles (numérotation 0-127).
public enum GM {
    public static let piano = 0
    public static let accordion = 21
    public static let harmonica = 22
    public static let tangoAccordion = 23
}

extension Score {
    public static func make(template: ScoreTemplate,
                            title: String = "",
                            composer: String = "",
                            time: TimeSignature = TimeSignature(4, 4),
                            key: KeySignature = KeySignature(0),
                            tempo: Double = 100,
                            measures count: Int = 16) -> Score {
        let n = max(1, count)
        var infos = Array(repeating: MeasureInfo(time: time, key: key), count: n)
        infos[0].tempo = tempo
        infos[n - 1].barline = .final
        return Score(metadata: ScoreMetadata(title: title, composer: composer),
                     measures: infos,
                     parts: template.makeParts(measures: n))
    }
}
