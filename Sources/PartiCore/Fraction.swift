import Foundation

/// Fraction rationnelle exacte (durées et positions dans la mesure, en rondes).
public struct Fraction: Hashable, Comparable, Codable, CustomStringConvertible {
    public let num: Int
    public let den: Int

    public init(_ n: Int, _ d: Int = 1) {
        precondition(d != 0, "dénominateur nul")
        var n = n, d = d
        if d < 0 { n = -n; d = -d }
        let g = Fraction.gcd(Swift.abs(n), d)
        num = n / g
        den = d / g
    }

    public static let zero = Fraction(0)
    public static let one = Fraction(1)

    static func gcd(_ a: Int, _ b: Int) -> Int {
        var a = a, b = b
        while b != 0 { (a, b) = (b, a % b) }
        return a == 0 ? 1 : a
    }

    public var doubleValue: Double { Double(num) / Double(den) }
    public var isZero: Bool { num == 0 }
    public var isInteger: Bool { den == 1 }
    public var description: String { den == 1 ? "\(num)" : "\(num)/\(den)" }

    public static func + (a: Fraction, b: Fraction) -> Fraction { Fraction(a.num * b.den + b.num * a.den, a.den * b.den) }
    public static func - (a: Fraction, b: Fraction) -> Fraction { Fraction(a.num * b.den - b.num * a.den, a.den * b.den) }
    public static func * (a: Fraction, b: Fraction) -> Fraction { Fraction(a.num * b.num, a.den * b.den) }
    public static func / (a: Fraction, b: Fraction) -> Fraction { Fraction(a.num * b.den, a.den * b.num) }
    public static func * (a: Fraction, b: Int) -> Fraction { Fraction(a.num * b, a.den) }
    public static func += (a: inout Fraction, b: Fraction) { a = a + b }
    public static func -= (a: inout Fraction, b: Fraction) { a = a - b }
    public static func < (a: Fraction, b: Fraction) -> Bool { a.num * b.den < b.num * a.den }

    /// Vrai si `self` est un multiple entier de `unit`.
    public func isMultiple(of unit: Fraction) -> Bool { (self / unit).isInteger }

    /// Approximation au plus proche multiple de 1/`grid`.
    public static func approximate(_ value: Double, grid: Int) -> Fraction {
        Fraction(Int((value * Double(grid)).rounded()), grid)
    }
}
