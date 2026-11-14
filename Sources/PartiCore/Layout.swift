import Foundation

// MARK: - Sortie de la mise en page (indépendante de toute bibliothèque graphique)

public struct LPoint: Hashable { public var x: Double; public var y: Double
    public init(_ x: Double, _ y: Double) { self.x = x; self.y = y } }

public struct LRect: Hashable {
    public var x: Double, y: Double, width: Double, height: Double
    public init(x: Double, y: Double, width: Double, height: Double) { self.x = x; self.y = y; self.width = width; self.height = height }
    public var maxX: Double { x + width }
    public var maxY: Double { y + height }
    public func contains(_ p: LPoint) -> Bool { p.x >= x && p.x <= maxX && p.y >= y && p.y <= maxY }
}

/// Clé d'un événement affiché (pour la sélection et la surbrillance).
public struct EventKey: Hashable {
    public var staff: StaffRef
    public var measure: Int
    public var voice: Int
    public var eventID: UUID
    public init(staff: StaffRef, measure: Int, voice: Int, eventID: UUID) {
        self.staff = staff; self.measure = measure; self.voice = voice; self.eventID = eventID
    }
}

public enum TextAlign { case left, center, right }

public enum DrawItem {
    /// Glyphe SMuFL ; `size` = taille de police en points ; `scaleY` pour l'accolade.
    case glyph(UInt32, LPoint, size: Double, scaleY: Double, owner: EventKey?)
    case line(LPoint, LPoint, width: Double, owner: EventKey?)
    case polygon([LPoint], owner: EventKey?)
    /// Liaison : courbe de p1 à p2, bombée vers le haut si `up`.
    case tie(LPoint, LPoint, up: Bool, owner: EventKey?)
    /// Texte : `y` = haut du texte.
    case text(String, LPoint, size: Double, bold: Bool, italic: Bool, align: TextAlign)
}

/// Événement placé (pour le clic, la sélection, le curseur).
public struct PlacedEvent {
    public var key: EventKey
    public var x: Double
    public var width: Double
    public var start: Fraction
    /// Positions verticales (demi-interlignes depuis la ligne du bas) des notes.
    public var positions: [Int]
}

public struct PlacedStaff {
    public var ref: StaffRef
    public var top: Double
    public var clef: Clef
}

public struct PlacedMeasure {
    public var index: Int
    public var x0: Double
    public var x1: Double
    public var slots: [Fraction]
    public var slotX: [Double]
    public var length: Fraction

    /// Abscisse d'une position (en rondes) dans la mesure.
    public func x(at offset: Double) -> Double {
        guard !slots.isEmpty else { return x0 }
        let times = slots.map(\.doubleValue) + [length.doubleValue]
        let xs = slotX + [x1]
        if offset <= times[0] { return xs[0] }
        for i in 0..<(times.count - 1) where offset < times[i + 1] {
            let r = (offset - times[i]) / max(1e-9, times[i + 1] - times[i])
            return xs[i] + r * (xs[i + 1] - xs[i])
        }
        return xs[xs.count - 1]
    }
}

public struct PlacedSystem {
    public var page: Int
    public var top: Double
    public var bottom: Double
    public var x0: Double
    public var x1: Double
    public var staves: [PlacedStaff]
    public var measures: [PlacedMeasure]
    public var events: [EventKey: PlacedEvent]
    /// Rectangles des textes et symboles posés (pour les sélectionner au clic).
    public var annotationBoxes: [UUID: LRect] = [:]

    public func staff(_ ref: StaffRef) -> PlacedStaff? { staves.first { $0.ref == ref } }
    public func measure(_ i: Int) -> PlacedMeasure? { measures.first { $0.index == i } }
}

public struct LayoutPage {
    public var width: Double
    public var height: Double
    public var items: [DrawItem]
}

public struct HitResult {
    public var page: Int
    public var staff: StaffRef
    public var measure: Int
    /// Début de l'événement le plus proche du clic.
    public var offset: Fraction
    /// Position verticale (demi-interlignes depuis la ligne du bas).
    public var position: Int
    public var clef: Clef
    /// Événement + note sous le pointeur, s'il y en a un.
    public var event: EventKey?
    public var noteIndex: Int?
}

public struct ScoreLayout {
    public var pages: [LayoutPage]
    public var systems: [PlacedSystem]
    public var staffSpace: Double

    public func system(containing measure: Int) -> PlacedSystem? {
        systems.first { s in s.measures.contains { $0.index == measure } }
    }

    public func placedEvent(_ key: EventKey) -> (system: PlacedSystem, event: PlacedEvent)? {
        guard let s = system(containing: key.measure), let e = s.events[key] else { return nil }
        return (s, e)
    }

    /// Analyse un clic (coordonnées de la page).
    public func hitTest(page: Int, point p: LPoint) -> HitResult? {
        let sp = staffSpace
        let candidates = systems.filter { $0.page == page && p.y >= $0.top - 6 * sp && p.y <= $0.bottom + 6 * sp }
        guard let sys = candidates.min(by: { abs(($0.top + $0.bottom) / 2 - p.y) < abs(($1.top + $1.bottom) / 2 - p.y) }) else { return nil }
        guard let staff = sys.staves.min(by: { abs($0.top + 2 * sp - p.y) < abs($1.top + 2 * sp - p.y) }) else { return nil }
        let measure = sys.measures.first { p.x >= $0.x0 && p.x < $0.x1 }
            ?? (p.x < sys.x0 + 1 ? sys.measures.first : p.x >= sys.x1 - 1 ? sys.measures.last : nil)
        guard let m = measure else { return nil }
        let position = Int(((staff.top + 4 * sp - p.y) / (sp / 2)).rounded())
        let evs = sys.events.values.filter { $0.key.staff == staff.ref && $0.key.measure == m.index && $0.key.voice == 0 }
        let nearest = evs.min { abs($0.x + $0.width / 2 - p.x) < abs($1.x + $1.width / 2 - p.x) }
        var hitKey: EventKey?
        var noteIndex: Int?
        if let e = nearest, p.x >= e.x - 0.6 * sp, p.x <= e.x + e.width + 0.6 * sp,
           let ni = e.positions.firstIndex(where: { abs($0 - position) <= 1 }) {
            hitKey = e.key; noteIndex = ni
        }
        return HitResult(page: page, staff: staff.ref, measure: m.index, offset: nearest?.start ?? .zero,
                         position: position, clef: staff.clef, event: hitKey, noteIndex: noteIndex)
    }
}

// MARK: - Moteur de gravure

public struct LayoutEngine {
    public init() {}

    struct MeasurePlan {
        var slots: [Fraction] = []
        var slotRel: [Double] = []      // abscisses relatives (avant étirement)
        var prefix: Double = 0          // changement d'armure / de métrique en début de mesure
        var width: Double = 0
    }

    public func layout(_ score: Score) -> ScoreLayout {
        let page = score.page
        let sp = page.staffSpace
        let refs = score.staffRefs
        let contentLeft = page.marginLeft + (score.parts.contains { $0.staves.count > 1 } ? 1.6 * sp : 0)
        let contentWidth = page.width - page.marginRight - contentLeft

        // Positions verticales des portées dans un système.
        var staffOffsets: [Double] = []
        var y = 0.0
        for (i, r) in refs.enumerated() {
            if i > 0 { y += (r.part == refs[i - 1].part ? 11 : 13) * sp }
            staffOffsets.append(y)
        }
        let systemHeight = (staffOffsets.last ?? 0) + 4 * sp

        // 1. Largeur naturelle de chaque mesure.
        let plans = (0..<score.measureCount).map { planMeasure(score, $0, refs: refs, sp: sp) }

        // 2. Répartition en systèmes.
        func header(_ m: Int) -> Double {
            let info = score.measures[m]
            var w = 0.8 * sp + 3.0 * sp + 0.6 * sp
            w += Double(abs(info.key.fifths)) * 1.1 * sp + (info.key.fifths != 0 ? 0.6 * sp : 0)
            if m == 0 || score.measures[m - 1].time != info.time { w += timeSigWidth(info.time, sp) + 0.8 * sp }
            return w
        }
        var systemsRanges: [Range<Int>] = []
        // Si la partition impose ses retours à la ligne (import Encore), on les respecte à la lettre.
        let hasBreaks = score.measures.contains { $0.systemBreak }
        var m = 0
        while m < score.measureCount {
            let avail = contentWidth - header(m)
            var end = m
            var used = 0.0
            while end < score.measureCount {
                let w = plans[end].width - (end == m ? plans[end].prefix : 0)
                if end > m && (score.measures[end].systemBreak || (!hasBreaks && used + w > avail)) { break }
                used += w; end += 1
            }
            systemsRanges.append(m..<end)
            m = end
        }

        // 3. Pages.
        var pages: [LayoutPage] = []
        var systems: [PlacedSystem] = []
        var items: [DrawItem] = []
        var pageIndex = 0
        var cursorY = page.marginTop
        func newPage() {
            pages.append(LayoutPage(width: page.width, height: page.height, items: items))
            items = []; pageIndex += 1; cursorY = page.marginTop
        }

        // Titre et compositeur sur la première page.
        let md = score.metadata
        if !md.title.isEmpty || !md.composer.isEmpty || !md.subtitle.isEmpty {
            if !md.title.isEmpty { items.append(.text(md.title, LPoint(page.width / 2, cursorY), size: 22, bold: true, italic: false, align: .center)) }
            cursorY += 32
            if !md.subtitle.isEmpty { items.append(.text(md.subtitle, LPoint(page.width / 2, cursorY), size: 13, bold: false, italic: false, align: .center)); cursorY += 18 }
            if !md.composer.isEmpty { items.append(.text(md.composer, LPoint(page.width - page.marginRight, cursorY), size: 11, bold: false, italic: false, align: .right)) }
            cursorY += 20
        }

        for (si, range) in systemsRanges.enumerated() {
            let needed = 5 * sp + systemHeight + 4 * sp
            if cursorY + needed > page.height - page.marginBottom && cursorY > page.marginTop + 1 { newPage() }
            let top = cursorY + 5 * sp
            let isLast = si == systemsRanges.count - 1
            let sys = drawSystem(score, range: range, plans: plans, refs: refs, staffOffsets: staffOffsets,
                                 top: top, x0: contentLeft, width: contentWidth, header: header(range.lowerBound),
                                 justify: !isLast, sp: sp, page: pageIndex, items: &items)
            systems.append(sys)
            cursorY = top + systemHeight + 4 * sp + 2 * sp
        }
        pages.append(LayoutPage(width: page.width, height: page.height, items: items))

        var result = ScoreLayout(pages: pages, systems: systems, staffSpace: sp)
        addTies(score, layout: &result, sp: sp)
        addSpanners(score, layout: &result, sp: sp)
        if !md.copyright.isEmpty {
            result.pages[0].items.append(.text(md.copyright, LPoint(page.width / 2, page.height - page.marginBottom + 14), size: 8, bold: false, italic: false, align: .center))
        }
        for i in result.pages.indices where result.pages.count > 1 && i > 0 {
            result.pages[i].items.append(.text("\(i + 1)", LPoint(i % 2 == 0 ? page.width - page.marginRight : page.marginLeft, page.marginTop - 30),
                                               size: 10, bold: false, italic: false, align: i % 2 == 0 ? .right : .left))
        }
        return result
    }

    func timeSigWidth(_ t: TimeSignature, _ sp: Double) -> Double {
        Double(max(String(t.beats).count, String(t.beatType).count)) * 1.85 * sp
    }

    /// Espacement : largeur attribuée à une durée (en rondes).
    func spacing(_ delta: Fraction, _ sp: Double) -> Double { sp * (1.7 + 2.4 * (delta.doubleValue * 4).squareRoot()) }

    func planMeasure(_ score: Score, _ m: Int, refs: [StaffRef], sp: Double) -> MeasurePlan {
        var plan = MeasurePlan()
        let ml = score.measureLength(m)
        let info = score.measures[m]
        if m > 0 {
            let prev = score.measures[m - 1]
            if prev.key != info.key { plan.prefix += Double(max(1, abs(info.key.fifths))) * 1.1 * sp + 0.8 * sp }
            if prev.time != info.time { plan.prefix += timeSigWidth(info.time, sp) + 1.0 * sp }
        }
        var minDelta: [Fraction: Fraction] = [:]
        var accidentals: Set<Fraction> = []
        for r in refs {
            let evs = score.timedEvents(r, measure: m)
            for (i, te) in evs.enumerated() {
                let next = i + 1 < evs.count ? evs[i + 1].start : ml
                let d = next - te.start
                minDelta[te.start] = min(minDelta[te.start] ?? d, d)
                if te.event.notes.contains(where: { $0.pitch.alter != info.key.alter(forStep: $0.pitch.step) }) { accidentals.insert(te.start) }
            }
        }
        plan.slots = minDelta.keys.sorted()
        var x = plan.prefix + 1.3 * sp + (info.repeatStart ? 1.6 * sp : 0)
        for s in plan.slots {
            if accidentals.contains(s) { x += 1.2 * sp }
            plan.slotRel.append(x)
            x += spacing(minDelta[s]!, sp)
        }
        if plan.slots.count == 1 && minDelta[plan.slots[0]] == ml && score.staffRefs.allSatisfy({ score.events($0, measure: m).first?.isMeasureRest ?? true }) {
            x = max(x, plan.prefix + 9 * sp)
        }
        if info.barline == .repeatEnd { x += 1.4 * sp }
        plan.width = max(x + 0.4 * sp, plan.prefix + 6 * sp)
        return plan
    }

    // MARK: Système

    func drawSystem(_ score: Score, range: Range<Int>, plans: [MeasurePlan], refs: [StaffRef], staffOffsets: [Double],
                    top: Double, x0: Double, width: Double, header: Double, justify: Bool, sp: Double, page: Int,
                    items: inout [DrawItem]) -> PlacedSystem {
        let fs = 4 * sp
        let x1Full = x0 + width
        let natural = range.reduce(0.0) { $0 + plans[$1].width - ($1 == range.lowerBound ? plans[$1].prefix : 0) }
        let avail = width - header
        let factor = justify || natural > avail ? avail / max(1, natural) : 1.0
        let xEnd = justify ? x1Full : x0 + header + natural * factor
        var placed = PlacedSystem(page: page, top: top, bottom: top + (staffOffsets.last ?? 0) + 4 * sp,
                                  x0: x0, x1: xEnd, staves: [], measures: [], events: [:])
        let first = range.lowerBound
        let firstInfo = score.measures[first]

        // Portées et en-tête (clé, armure, métrique).
        for (i, r) in refs.enumerated() {
            let st = top + staffOffsets[i]
            let clef = score[r].clef
            placed.staves.append(PlacedStaff(ref: r, top: st, clef: clef))
            for l in 0..<5 {
                let ly = st + Double(l) * sp
                items.append(.line(LPoint(x0, ly), LPoint(xEnd, ly), width: SMuFL.staffLine * sp, owner: nil))
            }
            var hx = x0 + 0.8 * sp
            items.append(.glyph(SMuFL.clef(clef), LPoint(hx, yPos(st, clef.anchorPosition, sp)), size: fs, scaleY: 1, owner: nil))
            hx += 3.0 * sp + 0.6 * sp
            hx = drawKeySignature(firstInfo.key, clef: clef, x: hx, staffTop: st, sp: sp, items: &items)
            if first == 0 || score.measures[first - 1].time != firstInfo.time {
                drawTimeSignature(firstInfo.time, x: hx, staffTop: st, sp: sp, items: &items)
            }
        }
        // Accolades et barre de début de système.
        if refs.count > 1 {
            items.append(.line(LPoint(x0, top), LPoint(x0, placed.bottom), width: SMuFL.thinBarline * sp, owner: nil))
        }
        for (p, part) in score.parts.enumerated() where part.staves.count > 1 {
            let idx = refs.indices.filter { refs[$0].part == p }
            let yTop = top + staffOffsets[idx.first!]
            let yBot = top + staffOffsets[idx.last!] + 4 * sp
            let h = yBot - yTop
            items.append(.glyph(SMuFL.brace, LPoint(x0 - 0.5 * sp - min(2.2, h / fs * 0.45) * 1.3 * sp, yBot), size: fs, scaleY: h / fs, owner: nil))
        }
        // Numéro de mesure en début de système.
        if first > 0 {
            items.append(.text("\(first + 1)", LPoint(x0, top - 2.9 * sp), size: sp * 1.5, bold: false, italic: true, align: .left))
        }

        // Mesures.
        var mx = x0 + header
        for m in range {
            let plan = plans[m]
            let prefix = m == first ? 0 : plan.prefix
            let w = (plan.width - (m == first ? plan.prefix : 0)) * factor
            let mEnd = mx + w
            var pm = PlacedMeasure(index: m, x0: mx, x1: mEnd, slots: plan.slots,
                                   slotX: plan.slotRel.map { mx + ($0 - plan.prefix + prefix) * factor }, length: score.measureLength(m))
            // Changement d'armure / de métrique en milieu de système.
            if m != first {
                let info = score.measures[m]
                for (i, r) in refs.enumerated() {
                    let st = top + staffOffsets[i]
                    var cx = mx + 0.6 * sp
                    if score.measures[m - 1].key != info.key {
                        cx = drawKeySignature(info.key, clef: score[r].clef, x: cx, staffTop: st, sp: sp, items: &items)
                    }
                    if score.measures[m - 1].time != info.time {
                        drawTimeSignature(info.time, x: cx, staffTop: st, sp: sp, items: &items)
                    }
                }
            }
            if pm.slotX.isEmpty { pm.slotX = [mx + 1.3 * sp] ; pm.slots = [.zero] }
            for (i, r) in refs.enumerated() {
                drawStaffMeasure(score, ref: r, measure: m, placed: pm, staffTop: top + staffOffsets[i], sp: sp,
                                 items: &items, events: &placed.events, boxes: &placed.annotationBoxes)
            }
            // Barre de mesure (par partie).
            let barline = score.measures[m].barline
            for (p, _) in score.parts.enumerated() {
                let idx = refs.indices.filter { refs[$0].part == p }
                guard let a = idx.first, let b = idx.last else { continue }
                let yA = top + staffOffsets[a], yB = top + staffOffsets[b] + 4 * sp
                let tops = idx.map { top + staffOffsets[$0] }
                drawBarline(barline, x: mEnd, yTop: yA, yBottom: yB, sp: sp, items: &items)
                if barline == .repeatEnd {
                    for t in tops { drawRepeatDots(x: mEnd - SMuFL.thickBarline * sp - 1.2 * sp, staffTop: t, sp: sp, items: &items) }
                }
                if score.measures[m].repeatStart {
                    let rx = mx + (m == first ? 0 : prefix * factor) + 0.1 * sp
                    let thick = SMuFL.thickBarline * sp
                    items.append(.line(LPoint(rx + thick / 2, yA), LPoint(rx + thick / 2, yB), width: thick, owner: nil))
                    items.append(.line(LPoint(rx + thick + 0.4 * sp, yA), LPoint(rx + thick + 0.4 * sp, yB), width: SMuFL.thinBarline * sp, owner: nil))
                    for t in tops { drawRepeatDots(x: rx + thick + 0.8 * sp, staffTop: t, sp: sp, items: &items) }
                }
            }
            placed.measures.append(pm)
            mx = mEnd
        }
        // Cases de 1re/2e/3e fois au-dessus de la première portée.
        var k = 0
        let pms = placed.measures
        while k < pms.count {
            let v = score.measures[pms[k].index].volta
            guard v != 0 else { k += 1; continue }
            var j = k
            while j + 1 < pms.count && score.measures[pms[j + 1].index].volta == v { j += 1 }
            let y = top - 4.2 * sp
            let xa = pms[k].x0 + 0.4 * sp, xb = pms[j].x1 - 0.6 * sp
            let lw = SMuFL.thinBarline * sp
            items.append(.line(LPoint(xa, y + 1.6 * sp), LPoint(xa, y), width: lw, owner: nil))
            items.append(.line(LPoint(xa, y), LPoint(xb, y), width: lw, owner: nil))
            let lastIndex = pms[j].index
            let endsHere = lastIndex + 1 >= score.measureCount || score.measures[lastIndex + 1].volta != v
            if endsHere { items.append(.line(LPoint(xb, y), LPoint(xb, y + 1.6 * sp), width: lw, owner: nil)) }
            let label = (0..<8).filter { v & (1 << $0) != 0 }.map { "\($0 + 1)." }.joined(separator: ",")
            items.append(.text(label, LPoint(xa + 0.5 * sp, y + 0.25 * sp), size: sp * 1.6, bold: true, italic: false, align: .left))
            k = j + 1
        }
        return placed
    }

    func yPos(_ staffTop: Double, _ position: Int, _ sp: Double) -> Double { staffTop + 4 * sp - Double(position) * sp / 2 }

    @discardableResult
    func drawKeySignature(_ key: KeySignature, clef: Clef, x: Double, staffTop: Double, sp: Double, items: inout [DrawItem]) -> Double {
        guard key.fifths != 0 else { return x }
        let sharps = key.fifths > 0
        let positions = clef.keySignaturePositions(sharps: sharps)
        var cx = x
        for i in 0..<abs(key.fifths) {
            items.append(.glyph(sharps ? SMuFL.sharp : SMuFL.flat, LPoint(cx, yPos(staffTop, positions[i], sp)), size: 4 * sp, scaleY: 1, owner: nil))
            cx += (sharps ? 1.1 : 1.0) * sp
        }
        return cx + 0.6 * sp
    }

    func drawTimeSignature(_ t: TimeSignature, x: Double, staffTop: Double, sp: Double, items: inout [DrawItem]) {
        let w = timeSigWidth(t, sp)
        for (num, y) in [(t.beats, staffTop + 1 * sp), (t.beatType, staffTop + 3 * sp)] {
            let digits = String(num).compactMap { $0.wholeNumberValue }
            var cx = x + (w - Double(digits.count) * 1.85 * sp) / 2
            for d in digits {
                items.append(.glyph(SMuFL.timeSigDigit(d), LPoint(cx, y), size: 4 * sp, scaleY: 1, owner: nil))
                cx += 1.85 * sp
            }
        }
    }

    func drawBarline(_ b: Barline, x: Double, yTop: Double, yBottom: Double, sp: Double, items: inout [DrawItem]) {
        let thin = SMuFL.thinBarline * sp
        switch b {
        case .regular:
            items.append(.line(LPoint(x - thin / 2, yTop), LPoint(x - thin / 2, yBottom), width: thin, owner: nil))
        case .double:
            items.append(.line(LPoint(x - thin / 2, yTop), LPoint(x - thin / 2, yBottom), width: thin, owner: nil))
            items.append(.line(LPoint(x - 0.6 * sp, yTop), LPoint(x - 0.6 * sp, yBottom), width: thin, owner: nil))
        case .final, .repeatEnd:
            let thick = SMuFL.thickBarline * sp
            items.append(.line(LPoint(x - thick / 2, yTop), LPoint(x - thick / 2, yBottom), width: thick, owner: nil))
            items.append(.line(LPoint(x - thick - 0.4 * sp, yTop), LPoint(x - thick - 0.4 * sp, yBottom), width: thin, owner: nil))
        }
    }

    func drawRepeatDots(x: Double, staffTop: Double, sp: Double, items: inout [DrawItem]) {
        for y in [staffTop + 1.5 * sp, staffTop + 2.5 * sp] {
            items.append(.glyph(0xE044, LPoint(x, y), size: 4 * sp, scaleY: 1, owner: nil))
        }
    }

    // MARK: Notes, silences, ligatures

    struct NoteDraw {
        var key: EventKey
        var event: Event
        var start: Fraction
        var x: Double
        var positions: [Int]     // triées, du grave à l'aigu
        var stemUp: Bool
        var beamed: Bool
        var stemX: Double = 0
        var stemEndY: Double = 0
    }

    func drawStaffMeasure(_ score: Score, ref: StaffRef, measure m: Int, placed pm: PlacedMeasure, staffTop: Double, sp: Double,
                          items: inout [DrawItem], events: inout [EventKey: PlacedEvent], boxes: inout [UUID: LRect]) {
        let fs = 4 * sp
        let clef = score[ref].clef
        let info = score.measures[m]
        let ml = score.measureLength(m)
        let timed = score.timedEvents(ref, measure: m)
        let middle = 4

        // État des altérations dans la mesure : indice diatonique -> altération courante.
        var accState: [Int: Int] = [:]
        func currentAlter(_ p: Pitch) -> Int { accState[p.diatonic] ?? info.key.alter(forStep: p.step) }

        // Groupes de ligatures.
        let group = info.time.beamGroup
        var beamGroups: [[Int]] = []
        var cur: [Int] = []
        var curBeat = -1
        for (i, te) in timed.enumerated() {
            let beat = Int((te.start / group).doubleValue.rounded(.down))
            let beamable = !te.event.isRest && te.event.duration.base.flagCount > 0
            if beamable && beat == curBeat && !cur.isEmpty {
                cur.append(i)
            } else {
                if cur.count > 1 { beamGroups.append(cur) }
                cur = beamable ? [i] : []
                curBeat = beat
            }
        }
        if cur.count > 1 { beamGroups.append(cur) }
        var groupOf: [Int: Int] = [:]
        for (g, list) in beamGroups.enumerated() { for i in list { groupOf[i] = g } }
        var groupUp: [Int: Bool] = [:]
        for (g, list) in beamGroups.enumerated() {
            let all = list.flatMap { i in timed[i].event.notes.map { $0.pitch.diatonic - clef.bottomLineDiatonic } }
            let avg = Double(all.reduce(0, +)) / Double(max(1, all.count))
            groupUp[g] = avg < Double(middle)
        }

        var notes: [NoteDraw] = []
        for (i, te) in timed.enumerated() {
            let e = te.event
            let key = EventKey(staff: ref, measure: m, voice: 0, eventID: e.id)
            let x = e.isMeasureRest ? (pm.x0 + pm.x1) / 2 - 0.56 * sp : pm.x(at: te.start.doubleValue)
            let base = e.duration.base
            if e.isRest {
                let restBase: DurationBase = e.isMeasureRest ? (ml > Fraction(1) ? .breve : .whole) : base
                let ry = staffTop + (restBase == .whole || restBase == .breve ? 1 : 2) * sp
                items.append(.glyph(SMuFL.rest(restBase), LPoint(x, ry), size: fs, scaleY: 1, owner: key))
                drawDots(e.duration.dots, x: x + SMuFL.restWidth(restBase) * sp + 0.35 * sp, y: staffTop + 1.5 * sp, sp: sp, owner: key, items: &items)
                events[key] = PlacedEvent(key: key, x: x, width: SMuFL.restWidth(restBase) * sp, start: te.start, positions: [])
                continue
            }
            let positions = e.notes.map { $0.pitch.diatonic - clef.bottomLineDiatonic }
            let sortedPos = positions.sorted()
            let up: Bool
            if let g = groupOf[i] { up = groupUp[g]! } else {
                up = Double(sortedPos.first! + sortedPos.last!) / 2 < Double(middle)
            }
            let headW = SMuFL.noteheadWidth(base) * sp
            events[key] = PlacedEvent(key: key, x: x, width: headW, start: te.start, positions: positions)

            // Lignes supplémentaires.
            let ledgerExtra = 0.4 * sp
            if sortedPos.first! <= -2 {
                for q in stride(from: -2, through: sortedPos.first!, by: -2) {
                    let ly = yPos(staffTop, q, sp)
                    items.append(.line(LPoint(x - ledgerExtra, ly), LPoint(x + headW + ledgerExtra, ly), width: SMuFL.ledger * sp, owner: nil))
                }
            }
            if sortedPos.last! >= 10 {
                for q in stride(from: 10, through: sortedPos.last!, by: 2) {
                    let ly = yPos(staffTop, q, sp)
                    items.append(.line(LPoint(x - ledgerExtra, ly), LPoint(x + headW + ledgerExtra, ly), width: SMuFL.ledger * sp, owner: nil))
                }
            }

            // Têtes de notes (secondes décalées), altérations, points.
            var shifted = Set<Int>()
            var prev: Int?
            for p in (up ? sortedPos : sortedPos.reversed()) {
                if let q = prev, abs(q - p) == 1, !shifted.contains(q) { shifted.insert(p) }
                prev = p
            }
            var accX = x - 0.25 * sp
            for (ni, note) in e.notes.enumerated().sorted(by: { $0.element.pitch.diatonic > $1.element.pitch.diatonic }) {
                let p = positions[ni]
                let hx = shifted.contains(p) ? (up ? x + headW - SMuFL.stem * sp : x - headW + SMuFL.stem * sp) : x
                let ny = yPos(staffTop, p, sp)
                items.append(.glyph(SMuFL.notehead(base), LPoint(hx, ny), size: fs, scaleY: 1, owner: key))
                let a = note.pitch.alter
                if a != currentAlter(note.pitch) {
                    let aw = SMuFL.accidentalWidth(a) * sp
                    items.append(.glyph(SMuFL.accidental(a), LPoint(accX - aw, ny), size: fs, scaleY: 1, owner: key))
                    accState[note.pitch.diatonic] = a
                    if e.notes.count > 2 { accX -= aw + 0.15 * sp }
                }
                let dotY = p % 2 == 0 ? yPos(staffTop, p + 1, sp) : ny
                let dotX = x + headW + (shifted.isEmpty || !up ? 0 : headW) + 0.3 * sp
                drawDots(e.duration.dots, x: dotX, y: dotY, sp: sp, owner: key, items: &items)
            }

            notes.append(NoteDraw(key: key, event: e, start: te.start, x: x, positions: sortedPos, stemUp: up, beamed: groupOf[i] != nil))
        }

        // Textes attachés (accords, basses, doigtés, nuances, symboles…).
        var stackAbove: [Int: Int] = [:], stackBelow: [Int: Int] = [:]
        for a in score.annotations where a.staff == ref && a.measure == m {
            let ax = pm.x(at: a.offset.doubleValue)
            let slot = Int(ax / sp)
            let isFinger = a.text.count <= 2 && a.text.allSatisfy(\.isNumber)
            let isChord = a.text.count >= 2 && a.text == a.text.uppercased() && a.text.contains(where: \.isLetter)
            let size = isFinger ? sp * 1.45 : isChord ? sp * 2.0 : sp * 1.7
            if let g = a.glyph {
                let y = yPos(staffTop, a.staffPosition ?? (a.above ? 12 : -4), sp)
                items.append(.glyph(g, LPoint(ax, y), size: 4 * sp, scaleY: 1, owner: nil))
                boxes[a.id] = LRect(x: ax - 0.2 * sp, y: y - 1.6 * sp, width: 2.6 * sp, height: 2.4 * sp)
                continue
            }
            var top: Double
            var bold = isFinger || isChord
            if let pos = a.staffPosition {
                // Position exacte (choisie dans Encore ou à la saisie).
                let y = yPos(staffTop, pos, sp)
                top = a.above ? y - size : y + 0.2 * sp
            } else if a.above {
                let n = stackAbove[slot, default: 0]; stackAbove[slot] = n + 1
                let highest = min(staffTop - 1.2 * sp, notes.filter { abs($0.x - ax) < 2 * sp }.map { yPos(staffTop, $0.positions.last!, sp) - 3.8 * sp }.min() ?? staffTop)
                top = min(staffTop - 1.2 * sp, highest) - size - Double(n) * size * 1.1
            } else {
                let n = stackBelow[slot, default: 0]; stackBelow[slot] = n + 1
                let lowest = max(staffTop + 5.2 * sp, notes.filter { abs($0.x - ax) < 2 * sp }.map { yPos(staffTop, $0.positions.first!, sp) + 1.5 * sp }.max() ?? 0)
                top = lowest + Double(n) * size * 1.1
                bold = bold || !isFinger
            }
            items.append(.text(a.text, LPoint(ax, top), size: size, bold: bold, italic: false, align: .left))
            boxes[a.id] = LRect(x: ax - 0.2 * sp, y: top - 0.2 * sp, width: Double(max(1, a.text.count)) * size * 0.62 + 0.4 * sp, height: size * 1.3)
        }

        // Hampes et crochets des notes isolées.
        for i in notes.indices where notes[i].event.duration.base.hasStem {
            let n = notes[i]
            let base = n.event.duration.base
            let headW = SMuFL.noteheadWidth(base) * sp
            let stemW = SMuFL.stem * sp
            let lowY = yPos(staffTop, n.positions.first!, sp)
            let highY = yPos(staffTop, n.positions.last!, sp)
            let midY = yPos(staffTop, middle, sp)
            let extra = Double(max(0, base.flagCount - 1)) * 0.75 * sp
            if n.stemUp {
                notes[i].stemX = n.x + headW - stemW / 2
                notes[i].stemEndY = min(highY - 3.5 * sp - extra, midY)
            } else {
                notes[i].stemX = n.x + stemW / 2
                notes[i].stemEndY = max(lowY + 3.5 * sp + extra, midY)
            }
            if !n.beamed {
                let from = n.stemUp ? lowY - 0.17 * sp : highY + 0.17 * sp
                items.append(.line(LPoint(notes[i].stemX, from), LPoint(notes[i].stemX, notes[i].stemEndY), width: stemW, owner: n.key))
                if base.flagCount > 0 {
                    items.append(.glyph(SMuFL.flag(base, up: n.stemUp), LPoint(notes[i].stemX - stemW / 2, notes[i].stemEndY), size: fs, scaleY: 1, owner: n.key))
                }
            }
        }

        // Articulations (côté tête de note, point d'orgue toujours au-dessus).
        for n in notes {
            guard let arts = n.event.articulations, !arts.isEmpty else { continue }
            let headW = SMuFL.noteheadWidth(n.event.duration.base) * sp
            let cx = n.x + headW / 2
            var stackIndex = 0
            for a in arts.sorted(by: { $0.rawValue < $1.rawValue }) {
                if a == .fermata {
                    let y = min(staffTop - 1.0 * sp, yPos(staffTop, n.positions.last!, sp) - 2.4 * sp)
                    items.append(.glyph(0xE4C0, LPoint(cx - 1.18 * sp, y), size: fs, scaleY: 1, owner: n.key))
                    continue
                }
                let below = n.stemUp
                let (glyph, width): (UInt32, Double) = {
                    switch a {
                    case .staccato: return (below ? 0xE4A3 : 0xE4A2, 0.38)
                    case .accent: return (below ? 0xE4A1 : 0xE4A0, 1.36)
                    case .tenuto: return (below ? 0xE4A5 : 0xE4A4, 1.34)
                    case .marcato: return (below ? 0xE4AD : 0xE4AC, 0.96)
                    case .staccatissimo: return (below ? 0xE4A7 : 0xE4A6, 0.42)
                    case .fermata: return (0xE4C0, 2.36)
                    }
                }()
                let step = Double(stackIndex) * 1.1 * sp
                let y = below ? yPos(staffTop, n.positions.first!, sp) + 1.5 * sp + step
                              : yPos(staffTop, n.positions.last!, sp) - 1.5 * sp - step
                items.append(.glyph(glyph, LPoint(cx - width * sp / 2, y), size: fs, scaleY: 1, owner: n.key))
                stackIndex += 1
            }
        }

        // Chiffres de n-olets (« 3 » au-dessus du groupe).
        var k = 0
        let tupletEvents = timed.filter { $0.event.tuplet != nil }
        while k < tupletEvents.count {
            let t = tupletEvents[k].event.tuplet!
            let group = Array(tupletEvents[k..<min(tupletEvents.count, k + t.actual)])
            let xs = group.map { pm.x(at: $0.start.doubleValue) }
            let mid = (xs.min()! + xs.max()!) / 2 + 0.6 * sp
            let highest = group.flatMap { g in g.event.notes.map { yPos(staffTop, $0.pitch.diatonic - clef.bottomLineDiatonic, sp) } }.min() ?? staffTop
            let y = min(staffTop - 1.2 * sp, highest - 4.2 * sp)
            items.append(.text("\(t.actual)", LPoint(mid, y), size: sp * 1.6, bold: true, italic: true, align: .center))
            k += max(1, group.count)
        }

        // Ligatures.
        for list in beamGroups {
            let members = list.compactMap { idx in notes.firstIndex { $0.key.eventID == timed[idx].event.id } }
            guard members.count > 1 else { continue }
            let up = notes[members[0]].stemUp
            let firstN = notes[members.first!], lastN = notes[members.last!]
            let x1 = firstN.stemX, x2 = lastN.stemX
            var y1 = firstN.stemEndY, y2 = lastN.stemEndY
            let maxSlope = 1.0 * sp
            if abs(y2 - y1) > maxSlope { y2 = y1 + (y2 > y1 ? maxSlope : -maxSlope) }
            let slope = (y2 - y1) / max(1, x2 - x1)
            // Longueur minimale des hampes.
            var shift = 0.0
            for idx in members {
                let n = notes[idx]
                let by = y1 + slope * (n.stemX - x1)
                let extra = Double(max(0, n.event.duration.base.flagCount - 1)) * 0.75 * sp
                if up {
                    let limit = yPos(staffTop, n.positions.last!, sp) - 2.6 * sp - extra
                    shift = min(shift, limit - by)
                } else {
                    let limit = yPos(staffTop, n.positions.first!, sp) + 2.6 * sp + extra
                    shift = max(shift, limit - by)
                }
            }
            y1 += shift
            func beamY(_ x: Double) -> Double { y1 + slope * (x - x1) }
            let t = SMuFL.beam * sp
            let stemW = SMuFL.stem * sp
            for idx in members {
                let n = notes[idx]
                let from = up ? yPos(staffTop, n.positions.first!, sp) - 0.17 * sp : yPos(staffTop, n.positions.last!, sp) + 0.17 * sp
                items.append(.line(LPoint(n.stemX, from), LPoint(n.stemX, beamY(n.stemX)), width: stemW, owner: n.key))
            }
            func beamSegment(_ xa: Double, _ xb: Double, level: Int) {
                let off = Double(level) * 0.75 * sp * (up ? 1 : -1)
                let ya = beamY(xa) + off, yb = beamY(xb) + off
                let d = up ? t : -t
                items.append(.polygon([LPoint(xa, ya), LPoint(xb, yb), LPoint(xb, yb + d), LPoint(xa, ya + d)], owner: nil))
            }
            beamSegment(x1 - stemW / 2, x2 + stemW / 2, level: 0)
            let maxLevel = members.map { notes[$0].event.duration.base.flagCount }.max() ?? 1
            if maxLevel > 1 {
                for level in 1..<maxLevel {
                    for (k, idx) in members.enumerated() {
                        let n = notes[idx]
                        guard n.event.duration.base.flagCount > level else { continue }
                        let nextHas = k + 1 < members.count && notes[members[k + 1]].event.duration.base.flagCount > level
                        let prevHas = k > 0 && notes[members[k - 1]].event.duration.base.flagCount > level
                        if nextHas {
                            beamSegment(n.stemX - stemW / 2, notes[members[k + 1]].stemX + stemW / 2, level: level)
                        } else if !prevHas {
                            let stub = 1.1 * sp
                            if k + 1 < members.count { beamSegment(n.stemX, n.stemX + stub, level: level) }
                            else { beamSegment(n.stemX - stub, n.stemX, level: level) }
                        }
                    }
                }
            }
        }
    }

    func drawDots(_ count: Int, x: Double, y: Double, sp: Double, owner: EventKey?, items: inout [DrawItem]) {
        for d in 0..<count {
            items.append(.glyph(SMuFL.augmentationDot, LPoint(x + Double(d) * 0.55 * sp, y), size: 4 * sp, scaleY: 1, owner: owner))
        }
    }

    // MARK: Liaisons de phrasé et soufflets

    func addSpanners(_ score: Score, layout: inout ScoreLayout, sp: Double) {
        for s in score.spanners {
            let ka = EventKey(staff: s.staff, measure: s.startMeasure, voice: 0, eventID: s.startEvent)
            let kb = EventKey(staff: s.staff, measure: s.endMeasure, voice: 0, eventID: s.endEvent)
            guard let a = layout.placedEvent(ka), let b = layout.placedEvent(kb),
                  let sa = a.system.staff(s.staff), let sb = b.system.staff(s.staff) else { continue }
            let sameSystem = a.system.top == b.system.top && a.system.page == b.system.page
            switch s.kind {
            case .slur:
                // Au-dessus si les notes sont hautes (hampes en bas), sinon en dessous.
                let posA = a.event.positions.max() ?? 4, posB = b.event.positions.max() ?? 4
                let up = (posA + posB) / 2 >= 4
                func y(_ st: PlacedStaff, _ e: PlacedEvent) -> Double {
                    up ? yPos(st.top, (e.positions.max() ?? 4), sp) - 1.3 * sp : yPos(st.top, (e.positions.min() ?? 4), sp) + 1.3 * sp
                }
                let xa = a.event.x + a.event.width / 2, xb = b.event.x + b.event.width / 2
                if sameSystem {
                    let ya = y(sa, a.event), yb = y(sb, b.event)
                    let yy = up ? min(ya, yb) : max(ya, yb)
                    layout.pages[a.system.page].items.append(.tie(LPoint(xa, yy), LPoint(xb, yy), up: up, owner: nil))
                } else {
                    let ya = y(sa, a.event), yb = y(sb, b.event)
                    layout.pages[a.system.page].items.append(.tie(LPoint(xa, ya), LPoint(a.system.x1 - 0.5 * sp, ya), up: up, owner: nil))
                    layout.pages[b.system.page].items.append(.tie(LPoint(b.system.x0 + 4 * sp, yb), LPoint(xb, yb), up: up, owner: nil))
                }
            case .crescendo, .diminuendo:
                let cresc = s.kind == .crescendo
                let lw = SMuFL.thinBarline * sp
                func hairpin(page: Int, x1: Double, x2: Double, y: Double, openStart: Bool, openEnd: Bool) {
                    let h = 0.7 * sp
                    let h1 = cresc ? (openStart ? h * 0.5 : 0) : h
                    let h2 = cresc ? h : (openEnd ? h * 0.5 : 0)
                    layout.pages[page].items.append(.line(LPoint(x1, y - h1), LPoint(x2, y - h2), width: lw, owner: nil))
                    layout.pages[page].items.append(.line(LPoint(x1, y + h1), LPoint(x2, y + h2), width: lw, owner: nil))
                }
                let ya = sa.top + 4 * sp + 2.6 * sp
                if sameSystem {
                    hairpin(page: a.system.page, x1: a.event.x, x2: max(b.event.x + b.event.width, a.event.x + 3 * sp), y: ya, openStart: false, openEnd: false)
                } else {
                    hairpin(page: a.system.page, x1: a.event.x, x2: a.system.x1 - 0.5 * sp, y: ya, openStart: false, openEnd: true)
                    hairpin(page: b.system.page, x1: b.system.x0 + 4 * sp, x2: b.event.x + b.event.width, y: sb.top + 6.6 * sp, openStart: true, openEnd: false)
                }
            }
        }
    }

    // MARK: Liaisons de prolongation

    func addTies(_ score: Score, layout: inout ScoreLayout, sp: Double) {
        for ref in score.staffRefs {
            // Événements dans l'ordre, avec leur système.
            var seq: [(sys: Int, ev: Event, key: EventKey)] = []
            for m in 0..<score.measureCount {
                guard let si = layout.systems.firstIndex(where: { s in s.measures.contains { $0.index == m } }) else { continue }
                for e in score.events(ref, measure: m) { seq.append((si, e, EventKey(staff: ref, measure: m, voice: 0, eventID: e.id))) }
            }
            for (i, item) in seq.enumerated() where item.ev.notes.contains(where: \.tie) {
                let sys = layout.systems[item.sys]
                guard let pe = sys.events[item.key], let staff = sys.staff(ref) else { continue }
                let next = i + 1 < seq.count ? seq[i + 1] : nil
                let headW = pe.width
                for note in item.ev.notes where note.tie {
                    let p = note.pitch.diatonic - staff.clef.bottomLineDiatonic
                    let up = p >= 4
                    let y = yPos(staff.top, p, sp) + (up ? -0.6 * sp : 0.6 * sp)
                    let xa = pe.x + headW + 0.15 * sp
                    let target = next.flatMap { n in n.ev.notes.contains { $0.pitch.midi == note.pitch.midi } ? n : nil }
                    if let n = target, n.sys == item.sys, let ne = sys.events[n.key] {
                        layout.pages[sys.page].items.append(.tie(LPoint(xa, y), LPoint(ne.x - 0.15 * sp, y), up: up, owner: item.key))
                    } else {
                        layout.pages[sys.page].items.append(.tie(LPoint(xa, y), LPoint(min(xa + 3 * sp, sys.x1), y), up: up, owner: item.key))
                        if let n = target, n.sys != item.sys {
                            let ns = layout.systems[n.sys]
                            if let ne = ns.events[n.key], let nst = ns.staff(ref) {
                                let ny = yPos(nst.top, p, sp) + (up ? -0.6 * sp : 0.6 * sp)
                                layout.pages[ns.page].items.append(.tie(LPoint(ne.x - 3 * sp, ny), LPoint(ne.x - 0.15 * sp, ny), up: up, owner: n.key))
                            }
                        }
                    }
                }
            }
        }
    }
}
