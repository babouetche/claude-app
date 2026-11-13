import AppKit
import CoreText
import PartiCore

/// Polices embarquées.
enum Fonts {
    static var registered = false

    static func register() {
        guard !registered else { return }
        registered = true
        let candidates = [
            Bundle.main.url(forResource: "Bravura", withExtension: "otf", subdirectory: "Fonts"),
            Bundle.main.url(forResource: "Bravura", withExtension: "otf"),
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("Resources/Fonts/Bravura.otf"),
        ].compactMap { $0 }
        for url in candidates where FileManager.default.fileExists(atPath: url.path) {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            return
        }
        NSLog("PartiMac : police Bravura introuvable")
    }

    private static var cache: [CGFloat: CTFont] = [:]

    static func music(_ size: CGFloat) -> CTFont {
        if let f = cache[size] { return f }
        register()
        let f = CTFontCreateWithName("Bravura" as CFString, size, nil)
        cache[size] = f
        return f
    }

    static func nsMusic(_ size: CGFloat) -> NSFont { register(); return NSFont(name: "Bravura", size: size) ?? .systemFont(ofSize: size) }

    static func string(_ cp: UInt32) -> String { String(UnicodeScalar(cp).map(Character.init) ?? " ") }
}

/// Dessine une page de partition dans un contexte Core Graphics orienté « haut en bas ».
struct Renderer {
    var ink = NSColor.black
    var highlight = NSColor.systemBlue

    func draw(_ page: LayoutPage, in ctx: CGContext, selected: Set<EventKey> = []) {
        ctx.saveGState()
        ctx.textMatrix = .identity
        for item in page.items {
            switch item {
            case let .glyph(cp, p, size, scaleY, owner):
                let color = owner.map { selected.contains($0) } == true ? highlight : ink
                drawGlyph(cp, at: p, size: CGFloat(size), scaleY: CGFloat(scaleY), color: color, ctx: ctx)
            case let .line(a, b, width, owner):
                ctx.setStrokeColor((owner.map { selected.contains($0) } == true ? highlight : ink).cgColor)
                ctx.setLineWidth(CGFloat(width))
                ctx.setLineCap(.butt)
                ctx.move(to: CGPoint(x: a.x, y: a.y))
                ctx.addLine(to: CGPoint(x: b.x, y: b.y))
                ctx.strokePath()
            case let .polygon(points, owner):
                guard let f = points.first else { continue }
                ctx.setFillColor((owner.map { selected.contains($0) } == true ? highlight : ink).cgColor)
                ctx.move(to: CGPoint(x: f.x, y: f.y))
                for p in points.dropFirst() { ctx.addLine(to: CGPoint(x: p.x, y: p.y)) }
                ctx.closePath()
                ctx.fillPath()
            case let .tie(a, b, up, owner):
                ctx.setFillColor((owner.map { selected.contains($0) } == true ? highlight : ink).cgColor)
                let span = b.x - a.x
                let h = min(max(span * 0.18, 3), 10) * (up ? -1 : 1)
                let t = h * 0.55
                ctx.move(to: CGPoint(x: a.x, y: a.y))
                ctx.addCurve(to: CGPoint(x: b.x, y: b.y),
                             control1: CGPoint(x: a.x + span * 0.25, y: a.y + h),
                             control2: CGPoint(x: b.x - span * 0.25, y: b.y + h))
                ctx.addCurve(to: CGPoint(x: a.x, y: a.y),
                             control1: CGPoint(x: b.x - span * 0.25, y: b.y + t),
                             control2: CGPoint(x: a.x + span * 0.25, y: a.y + t))
                ctx.fillPath()
            case let .text(string, p, size, bold, italic, align):
                drawText(string, at: p, size: CGFloat(size), bold: bold, italic: italic, align: align)
            }
        }
        ctx.restoreGState()
    }

    func drawGlyph(_ cp: UInt32, at p: LPoint, size: CGFloat, scaleY: CGFloat = 1, color: NSColor, ctx: CGContext) {
        let font = Fonts.music(size)
        var ch = UniChar(truncatingIfNeeded: cp)
        var glyph = CGGlyph()
        guard CTFontGetGlyphsForCharacters(font, &ch, &glyph, 1) else { return }
        ctx.saveGState()
        // AppKit modifie la matrice de texte en dessinant les titres : on la remet à zéro à chaque glyphe.
        ctx.textMatrix = .identity
        ctx.textPosition = .zero
        ctx.setFillColor(color.cgColor)
        ctx.translateBy(x: CGFloat(p.x), y: CGFloat(p.y))
        ctx.scaleBy(x: 1, y: -scaleY)
        var pos = CGPoint.zero
        CTFontDrawGlyphs(font, &glyph, &pos, 1, ctx)
        ctx.restoreGState()
    }

    func drawText(_ s: String, at p: LPoint, size: CGFloat, bold: Bool, italic: Bool, align: TextAlign) {
        var font = bold ? NSFont.boldSystemFont(ofSize: size) : NSFont.systemFont(ofSize: size)
        if italic { font = NSFontManager.shared.convert(font, toHaveTrait: .italicFontMask) }
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: ink]
        let str = NSAttributedString(string: s, attributes: attrs)
        let w = str.size().width
        let x: CGFloat
        switch align {
        case .left: x = CGFloat(p.x)
        case .center: x = CGFloat(p.x) - w / 2
        case .right: x = CGFloat(p.x) - w
        }
        str.draw(at: NSPoint(x: x, y: CGFloat(p.y)))
    }
}

/// Exports PDF et PNG.
enum Exporter {
    static func pdfData(_ layout: ScoreLayout) -> Data {
        let data = NSMutableData()
        guard let first = layout.pages.first,
              let consumer = CGDataConsumer(data: data as CFMutableData) else { return Data() }
        var box = CGRect(x: 0, y: 0, width: first.width, height: first.height)
        guard let ctx = CGContext(consumer: consumer, mediaBox: &box, nil) else { return Data() }
        for page in layout.pages {
            ctx.beginPDFPage(nil)
            ctx.saveGState()
            ctx.translateBy(x: 0, y: CGFloat(page.height))
            ctx.scaleBy(x: 1, y: -1)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)
            Renderer().draw(page, in: ctx)
            NSGraphicsContext.restoreGraphicsState()
            ctx.restoreGState()
            ctx.endPDFPage()
        }
        ctx.closePDF()
        return data as Data
    }

    static func png(_ page: LayoutPage, scale: CGFloat = 1) -> Data? {
        let w = Int(CGFloat(page.width) * scale), h = Int(CGFloat(page.height) * scale)
        guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
                                         samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                         bytesPerRow: 0, bitsPerPixel: 0),
              let gc = NSGraphicsContext(bitmapImageRep: rep) else { return nil }
        let ctx = gc.cgContext
        NSGraphicsContext.saveGraphicsState()
        ctx.setFillColor(NSColor.white.cgColor)
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        ctx.translateBy(x: 0, y: CGFloat(h))
        ctx.scaleBy(x: scale, y: -scale)
        NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)
        Renderer().draw(page, in: ctx)
        NSGraphicsContext.restoreGraphicsState()
        return rep.representation(using: .png, properties: [:])
    }
}

/// Vue d'impression : une page de partition par page imprimée.
final class PrintView: NSView {
    let layout: ScoreLayout
    init(layout: ScoreLayout) {
        self.layout = layout
        let w = layout.pages.first?.width ?? 595, h = layout.pages.first?.height ?? 842
        super.init(frame: NSRect(x: 0, y: 0, width: w, height: h * Double(max(1, layout.pages.count))))
    }
    required init?(coder: NSCoder) { fatalError() }
    override var isFlipped: Bool { true }

    override func knowsPageRange(_ range: NSRangePointer) -> Bool {
        range.pointee = NSRange(location: 1, length: layout.pages.count)
        return true
    }

    override func rectForPage(_ page: Int) -> NSRect {
        let h = layout.pages.first?.height ?? 842
        return NSRect(x: 0, y: CGFloat(page - 1) * CGFloat(h), width: bounds.width, height: CGFloat(h))
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        for (i, page) in layout.pages.enumerated() {
            let y = CGFloat(i) * CGFloat(page.height)
            guard NSRect(x: 0, y: y, width: CGFloat(page.width), height: CGFloat(page.height)).intersects(dirtyRect) else { continue }
            ctx.saveGState()
            ctx.translateBy(x: 0, y: y)
            Renderer().draw(page, in: ctx)
            ctx.restoreGState()
        }
    }
}
