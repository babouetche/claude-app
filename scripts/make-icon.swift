// Génère l'icône originale de « Partitions de Titi » : accordéon bleu sur fond ciel et mer.
// Usage : swift scripts/make-icon.swift <dossier.iconset>
import AppKit

let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "AppIcon.iconset"
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

func render(_ px: Int) -> Data? {
    let s = CGFloat(px)
    guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
                                     samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                     bytesPerRow: 0, bitsPerPixel: 0) else { return nil }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let ctx = NSGraphicsContext.current!.cgContext

    // Fond : carré arrondi façon macOS, ciel → mer.
    let inset = s * 0.09
    let rect = CGRect(x: inset, y: inset, width: s - 2 * inset, height: s - 2 * inset)
    let path = CGPath(roundedRect: rect, cornerWidth: rect.width * 0.225, cornerHeight: rect.width * 0.225, transform: nil)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.012), blur: s * 0.03, color: NSColor.black.withAlphaComponent(0.35).cgColor)
    ctx.addPath(path); ctx.setFillColor(NSColor.black.cgColor); ctx.fillPath()
    ctx.restoreGState()
    ctx.saveGState()
    ctx.addPath(path); ctx.clip()
    let sky = [NSColor(calibratedRed: 0.62, green: 0.82, blue: 0.97, alpha: 1).cgColor,
               NSColor(calibratedRed: 0.30, green: 0.60, blue: 0.86, alpha: 1).cgColor,
               NSColor(calibratedRed: 0.08, green: 0.30, blue: 0.55, alpha: 1).cgColor] as CFArray
    let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: sky, locations: [0, 0.5, 1])!
    ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: rect.maxY), end: CGPoint(x: 0, y: rect.minY), options: [])

    // Accordéon bleu : clavier main gauche, soufflet, clavier main droite.
    let u = rect.width / 100
    let cx = rect.midX, cy = rect.midY - 4 * u
    let h = 50 * u
    let boxW = 22 * u, bellowsW = 26 * u
    let left = CGRect(x: cx - bellowsW / 2 - boxW, y: cy - h / 2, width: boxW, height: h)
    let right = CGRect(x: cx + bellowsW / 2, y: cy - h / 2, width: boxW, height: h)
    let bellows = CGRect(x: cx - bellowsW / 2, y: cy - h / 2 + 2 * u, width: bellowsW, height: h - 4 * u)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -1.5 * u), blur: 4 * u, color: NSColor.black.withAlphaComponent(0.45).cgColor)
    ctx.setFillColor(NSColor(calibratedRed: 0.06, green: 0.07, blue: 0.12, alpha: 1).cgColor)
    ctx.fill(bellows)
    let blue = [NSColor(calibratedRed: 0.22, green: 0.45, blue: 0.98, alpha: 1).cgColor,
                NSColor(calibratedRed: 0.07, green: 0.20, blue: 0.70, alpha: 1).cgColor] as CFArray
    let boxGrad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: blue, locations: [0, 1])!
    for box in [left, right] {
        let bp = CGPath(roundedRect: box, cornerWidth: 4 * u, cornerHeight: 4 * u, transform: nil)
        ctx.addPath(bp); ctx.setFillColor(NSColor.black.cgColor); ctx.fillPath()
    }
    ctx.restoreGState()
    for box in [left, right] {
        ctx.saveGState()
        ctx.addPath(CGPath(roundedRect: box, cornerWidth: 4 * u, cornerHeight: 4 * u, transform: nil)); ctx.clip()
        ctx.drawLinearGradient(boxGrad, start: CGPoint(x: box.minX, y: box.maxY), end: CGPoint(x: box.maxX, y: box.minY), options: [])
        ctx.restoreGState()
    }
    // Plis du soufflet.
    ctx.setStrokeColor(NSColor.white.withAlphaComponent(0.75).cgColor)
    ctx.setLineWidth(max(1, 0.7 * u))
    for i in 1..<7 {
        let x = bellows.minX + bellows.width * CGFloat(i) / 7
        ctx.move(to: CGPoint(x: x, y: bellows.minY)); ctx.addLine(to: CGPoint(x: x, y: bellows.maxY))
    }
    ctx.strokePath()
    // Boutons (grilles de points blancs).
    ctx.setFillColor(NSColor.white.withAlphaComponent(0.9).cgColor)
    let r = 1.5 * u
    for (box, cols) in [(left, 3), (right, 3)] {
        for c in 0..<cols { for row in 0..<7 {
            let x = box.minX + box.width * (CGFloat(c) + 1) / CGFloat(cols + 1)
            let y = box.minY + h * 0.12 + CGFloat(row) * h * 0.125 + (c % 2 == 0 ? 0 : h * 0.06)
            ctx.fillEllipse(in: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r))
        } }
    }
    // Deux croches au-dessus.
    ctx.setFillColor(NSColor.white.cgColor)
    let ny = cy + h / 2 + 7 * u
    for (i, nx) in [cx - 9 * u, cx + 5 * u].enumerated() {
        ctx.saveGState()
        ctx.translateBy(x: nx, y: ny + CGFloat(i) * 3 * u); ctx.rotate(by: 0.35)
        ctx.fillEllipse(in: CGRect(x: -3.2 * u, y: -2.2 * u, width: 6.4 * u, height: 4.4 * u))
        ctx.restoreGState()
        ctx.fill(CGRect(x: nx + 2.4 * u, y: ny + CGFloat(i) * 3 * u, width: 0.9 * u, height: 14 * u))
    }
    ctx.move(to: CGPoint(x: cx - 6.6 * u, y: ny + 14 * u))
    ctx.addLine(to: CGPoint(x: cx + 8.3 * u, y: ny + 17 * u))
    ctx.addLine(to: CGPoint(x: cx + 8.3 * u, y: ny + 14.5 * u))
    ctx.addLine(to: CGPoint(x: cx - 6.6 * u, y: ny + 11.5 * u))
    ctx.closePath(); ctx.fillPath()
    ctx.restoreGState()

    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])
}

for (name, px) in [("16x16", 16), ("16x16@2x", 32), ("32x32", 32), ("32x32@2x", 64), ("128x128", 128),
                   ("128x128@2x", 256), ("256x256", 256), ("256x256@2x", 512), ("512x512", 512), ("512x512@2x", 1024)] {
    if let data = render(px) { try? data.write(to: URL(fileURLWithPath: "\(outDir)/icon_\(name).png")) }
}
print("Icône générée dans \(outDir)")
