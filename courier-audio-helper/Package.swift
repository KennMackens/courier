// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "courier-audio-helper",
    platforms: [
        .macOS("14.2")
    ],
    targets: [
        .executableTarget(
            name: "courier-audio-helper",
            path: "Sources"
        )
    ]
)
