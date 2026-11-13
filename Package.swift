// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PartiMac",
    defaultLocalization: "fr",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "PartiMac", targets: ["PartiMac"]),
        .library(name: "PartiCore", targets: ["PartiCore"]),
    ],
    targets: [
        // Cœur en Swift pur (modèle, édition, MIDI, gravure) : testable partout.
        .target(name: "PartiCore", path: "Sources/PartiCore"),
        // Application macOS (AppKit + Core Graphics + AVFoundation).
        .executableTarget(name: "PartiMac", dependencies: ["PartiCore"], path: "Sources/PartiMac"),
        .testTarget(name: "PartiCoreTests", dependencies: ["PartiCore"], path: "Tests/PartiCoreTests"),
    ]
)
