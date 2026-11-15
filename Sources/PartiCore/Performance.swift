import Foundation

/// Ordre de lecture : reprises, cases de 1re/2e fois, D.C. / D.S. et Fine.
public struct PerformedMeasure: Hashable {
    public var measure: Int
    /// Début de la mesure dans l'interprétation, en noires.
    public var startBeat: Double
}

extension Score {
    private func hasMark(_ m: Int, _ test: (Annotation) -> Bool) -> Bool {
        annotations.contains { $0.measure == m && test($0) }
    }

    private func isDaCapo(_ m: Int) -> Bool {
        hasMark(m) { let t = $0.text.lowercased(); return t.contains("d.c.") || t.contains("da capo") }
    }
    private func isDalSegno(_ m: Int) -> Bool {
        hasMark(m) { let t = $0.text.lowercased(); return t.contains("d.s.") || t.contains("dal segno") }
    }
    private func isFine(_ m: Int) -> Bool {
        hasMark(m) { let t = $0.text.lowercased().trimmingCharacters(in: .whitespaces); return t == "fine" || t == "fin" || t.hasSuffix(" fine") }
    }

    /// Nombre de passages d'une reprise finissant à la mesure `end` (2 par défaut, plus avec des cases 3., 4.…).
    private func passes(endingAt end: Int) -> Int {
        var bits = measures[end].volta
        var k = end + 1
        while k < measureCount && measures[k].volta != 0 { bits |= measures[k].volta; k += 1 }
        let highest = (0..<16).last { bits & (1 << $0) != 0 }.map { $0 + 1 } ?? 0
        return max(2, highest)
    }

    /// Mesures dans l'ordre où elles sont jouées.
    public func performanceOrder() -> [Int] {
        guard measureCount > 0 else { return [] }
        let segno = (0..<measureCount).first { m in hasMark(m) { $0.glyph == 0xE047 } } ?? 0
        var order: [Int] = []
        var i = 0
        var pass = 1
        var sectionStart = 0
        var afterJump = false
        var steps = 0
        while i < measureCount && steps < 20_000 {
            steps += 1
            let info = measures[i]
            if info.repeatStart && sectionStart != i && !afterJump { sectionStart = i; pass = 1 }
            if info.volta != 0 {
                if afterJump {
                    // Après D.C./D.S. : seule la dernière case est jouée.
                    let isLast = i + 1 >= measureCount || measures[i + 1].volta == 0 || measures[i + 1].volta == info.volta
                    let groupEnd = (i..<measureCount).first { $0 + 1 >= measureCount || measures[$0 + 1].volta == 0 } ?? i
                    if !(isLast && measures[groupEnd].volta == info.volta) { i += 1; continue }
                } else if info.volta & (1 << (pass - 1)) == 0 {
                    i += 1; continue
                }
            }
            order.append(i)
            if afterJump && isFine(i) { break }
            if info.barline == .repeatEnd && !afterJump && pass < passes(endingAt: i) {
                pass += 1
                i = sectionStart
                continue
            }
            if !afterJump && (isDaCapo(i) || isDalSegno(i)) {
                afterJump = true
                i = isDalSegno(i) ? segno : 0
                continue
            }
            // Nouvelle section après une reprise terminée.
            if info.barline == .repeatEnd { sectionStart = i + 1; pass = 1 }
            i += 1
        }
        return order
    }

    /// Interprétation complète : mesures jouées et leur position en noires.
    public var performance: [PerformedMeasure] {
        var beat = 0.0
        return performanceOrder().map { m in
            defer { beat += measureLength(m).doubleValue * 4 }
            return PerformedMeasure(measure: m, startBeat: beat)
        }
    }

    public var performanceLengthInBeats: Double {
        performanceOrder().reduce(0.0) { $0 + measureLength($1).doubleValue * 4 }
    }

    /// Position (en noires, dans l'interprétation) du premier passage de la mesure `m`.
    public func performanceBeat(measure m: Int, offsetBeats: Double = 0) -> Double {
        (performance.first { $0.measure == m }?.startBeat ?? 0) + offsetBeats
    }

    /// Mesure jouée et position dans la mesure (en noires) pour une position de lecture.
    public func performedLocation(atBeat beat: Double) -> (measure: Int, beatInMeasure: Double)? {
        guard let p = performance.last(where: { $0.startBeat <= beat + 1e-9 }) else { return nil }
        return (p.measure, beat - p.startBeat)
    }
}
