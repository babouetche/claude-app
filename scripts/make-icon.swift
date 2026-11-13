// Génère l'icône originale de PartiMac (dégradé, portée et deux croches liées).
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

    // Fond : carré arrondi façon macOS, dégradé bleu nuit → corail.
    let inset = s * 0.09
    let rect = CGRect(x: inset, y: inset, width: s - 2 * inset, height: s - 2 * inset)
    let path = CGPath(roundedRect: rect, cornerWidth: rect.width * 0.225, cornerHeight: rect.width * 0.225, transform: nil)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.012), blur: s * 0.03, color: NSColor.black.withAlphaComponent(0.35).cgColor)
    ctx.addPath(path); ctx.setFillColor(NSColor.black.cgColor); ctx.fillPath()
    ctx.restoreGState()
    ctx.saveGState()
    ctx.addPath(path); ctx.clip()
    let colors = [NSColor(calibratedRed: 0.10, green: 0.16, blue: 0.42, alpha: 1).cgColor,
                  NSColor(calibratedRed: 0.36, green: 0.22, blue: 0.62, alpha: 1).cgColor,
                  NSColor(calibratedRed: 0.95, green: 0.45, blue: 0.40, alpha: 1).cgColor] as CFArray
    let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.55, 1])!
    ctx.drawLinearGradient(grad, start: CGPoint(x: rect.minX, y: rect.maxY), end: CGPoint(x: rect.maxX, y: rect.minY), options: [])

    // Portée.
    let sp = rect.height * 0.085
    let staffBottom = rect.minY + rect.height * 0.30
    ctx.setStrokeColor(NSColor.white.withAlphaComponent(0.55).cgColor)
    ctx.setLineWidth(max(1, s * 0.008))
    for i in 0..<5 {
        let y = staffBottom + CGFloat(i) * sp
        ctx.move(to: CGPoint(x: rect.minX + rect.width * 0.08, y: y))
        ctx.addLine(to: CGPoint(x: rect.maxX - rect.width * 0.08, y: y))
    }
    ctx.strokePath()

    // Deux croches liées.
    ctx.setFillColor(NSColor.white.cgColor)
    func head(_ cx: CGFloat, _ cy: CGFloat) {
        ctx.saveGState()
        ctx.translateBy(x: cx, y: cy)
        ctx.rotate(by: 0.35)
        ctx.fillEllipse(in: CGRect(x: -sp * 0.72, y: -sp * 0.5, width: sp * 1.44, height: sp * 1.0))
        ctx.restoreGState()
    }
    let x1 = rect.minX + rect.width * 0.33, y1 = staffBottom + sp * 1.0
    let x2 = rect.minX + rect.width * 0.63, y2 = staffBottom + sp * 2.0
    head(x1, y1); head(x2, y2)
    let stemW = sp * 0.16
    let top1 = y1 + sp * 3.9, top2 = y2 + sp * 3.9
    ctx.fill(CGRect(x: x1 + sp * 0.6, y: y1, width: stemW, height: top1 - y1))
    ctx.fill(CGRect(x: x2 + sp * 0.6, y: y2, width: stemW, height: top2 - y2))
    let bt = sp * 0.55
    ctx.move(to: CGPoint(x: x1 + sp * 0.6, y: top1))
    ctx.addLine(to: CGPoint(x: x2 + sp * 0.6 + stemW, y: top2))
    ctx.addLine(to: CGPoint(x: x2 + sp * 0.6 + stemW, y: top2 - bt))
    ctx.addLine(to: CGPoint(x: x1 + sp * 0.6, y: top1 - bt))
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
