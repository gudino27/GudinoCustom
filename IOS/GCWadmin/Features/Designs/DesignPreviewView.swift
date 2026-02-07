//
//  DesignPreviewView.swift
//  GCWadmin
//
//  Design preview with Floor Plan and Wall Views - matches webapp DesignPreview.js
//

import SwiftUI

// MARK: - Room Data Structures

struct RoomDimensions {
    let width: CGFloat   // feet
    let height: CGFloat  // feet
    let wallHeight: CGFloat // inches

    var widthInches: CGFloat { width * 12 }
    var heightInches: CGFloat { height * 12 }
    var squareFeet: CGFloat { width * height }
}

struct RoomElement: Identifiable {
    let id: String
    let type: String
    let category: String
    let x: CGFloat        // pixel coordinates
    let y: CGFloat
    let width: CGFloat    // inches
    let depth: CGFloat    // inches
    let rotation: CGFloat // degrees
    let mountHeight: CGFloat
    let materialId: String?
    let finish: String?
}

struct RoomData {
    let dimensions: RoomDimensions
    let elements: [RoomElement]
    let walls: [Int]
    let doors: [[String: Any]]

    var cabinetCount: Int {
        elements.filter { $0.category == "cabinet" }.count
    }

    var applianceCount: Int {
        elements.filter { $0.category == "appliance" }.count
    }

    static func parse(from jsonString: String?) -> RoomData? {
        guard let jsonString = jsonString,
              let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        // Parse dimensions
        guard let dims = json["dimensions"] as? [String: Any] else { return nil }
        let width = parseNumber(dims["width"]) ?? 10
        let height = parseNumber(dims["height"]) ?? 10
        let wallHeight = parseNumber(dims["wallHeight"]) ?? 96

        let dimensions = RoomDimensions(width: width, height: height, wallHeight: wallHeight)

        // Parse elements
        var elements: [RoomElement] = []
        if let elementsArray = json["elements"] as? [[String: Any]] {
            for (index, elem) in elementsArray.enumerated() {
                let element = RoomElement(
                    id: (elem["id"] as? String) ?? "el-\(index)",
                    type: (elem["type"] as? String) ?? "base",
                    category: (elem["category"] as? String) ?? "cabinet",
                    x: parseNumber(elem["x"]) ?? 0,
                    y: parseNumber(elem["y"]) ?? 0,
                    width: parseNumber(elem["width"]) ?? 36,
                    depth: parseNumber(elem["depth"]) ?? 24,
                    rotation: parseNumber(elem["rotation"]) ?? 0,
                    mountHeight: parseNumber(elem["mountHeight"]) ?? 0,
                    materialId: elem["materialId"] as? String,
                    finish: elem["finish"] as? String
                )
                elements.append(element)
            }
        }

        let walls = (json["walls"] as? [Int]) ?? [1, 2, 3, 4]
        let doors = (json["doors"] as? [[String: Any]]) ?? []

        return RoomData(dimensions: dimensions, elements: elements, walls: walls, doors: doors)
    }

    private static func parseNumber(_ value: Any?) -> CGFloat? {
        if let doubleVal = value as? Double { return CGFloat(doubleVal) }
        if let intVal = value as? Int { return CGFloat(intVal) }
        if let strVal = value as? String, let d = Double(strVal) { return CGFloat(d) }
        return nil
    }
}

// MARK: - Element Type Info

struct ElementTypeInfo {
    let name: String
    let defaultHeight: CGFloat
    let color: Color
    let strokeColor: Color?

    static let types: [String: ElementTypeInfo] = [
        "base":            ElementTypeInfo(name: "Base Cabinet", defaultHeight: 34.5, color: Color(hex: "8B4513"), strokeColor: nil),
        "wall":            ElementTypeInfo(name: "Wall Cabinet", defaultHeight: 30, color: Color(hex: "A0522D"), strokeColor: nil),
        "tall":            ElementTypeInfo(name: "Tall Cabinet", defaultHeight: 84, color: Color(hex: "8B4513"), strokeColor: nil),
        "corner":          ElementTypeInfo(name: "Corner Cabinet", defaultHeight: 34.5, color: Color(hex: "8B4513"), strokeColor: nil),
        "sink-base":       ElementTypeInfo(name: "Sink Base", defaultHeight: 34.5, color: Color(hex: "8B4513"), strokeColor: nil),
        "vanity":          ElementTypeInfo(name: "Vanity", defaultHeight: 32, color: Color(hex: "8B4513"), strokeColor: nil),
        "vanity-sink":     ElementTypeInfo(name: "Vanity w/ Sink", defaultHeight: 32, color: Color(hex: "654321"), strokeColor: nil),
        "medicine":        ElementTypeInfo(name: "Medicine Cabinet", defaultHeight: 30, color: Color(hex: "A0522D"), strokeColor: nil),
        "linen":           ElementTypeInfo(name: "Linen Cabinet", defaultHeight: 84, color: Color(hex: "8B4513"), strokeColor: nil),
        "linen-tower":     ElementTypeInfo(name: "Linen Tower", defaultHeight: 84, color: Color(hex: "8B4513"), strokeColor: nil),
        "double-vanity":   ElementTypeInfo(name: "Double Vanity", defaultHeight: 32, color: Color(hex: "8B4513"), strokeColor: nil),
        "floating-vanity": ElementTypeInfo(name: "Floating Vanity", defaultHeight: 32, color: Color(hex: "8B4513"), strokeColor: nil),
        "refrigerator":    ElementTypeInfo(name: "Refrigerator", defaultHeight: 70, color: Color(hex: "C0C0C0"), strokeColor: nil),
        "stove":           ElementTypeInfo(name: "Stove/Range", defaultHeight: 36, color: Color(hex: "666666"), strokeColor: nil),
        "dishwasher":      ElementTypeInfo(name: "Dishwasher", defaultHeight: 34, color: Color(hex: "C0C0C0"), strokeColor: nil),
        "microwave":       ElementTypeInfo(name: "Microwave", defaultHeight: 18, color: Color(hex: "666666"), strokeColor: nil),
        "toilet":          ElementTypeInfo(name: "Toilet", defaultHeight: 30, color: .white, strokeColor: Color(hex: "999999")),
        "tub":             ElementTypeInfo(name: "Bathtub", defaultHeight: 20, color: Color(hex: "E8F4FD"), strokeColor: Color(hex: "4A90E2")),
        "shower":          ElementTypeInfo(name: "Shower", defaultHeight: 80, color: Color(hex: "F0F8FF"), strokeColor: Color(hex: "4A90E2")),
    ]

    static func info(for type: String) -> ElementTypeInfo {
        types[type] ?? ElementTypeInfo(name: type.capitalized, defaultHeight: 30, color: Color(hex: "999999"), strokeColor: nil)
    }
}

// MARK: - Design Preview View

struct DesignPreviewView: View {
    let detail: DesignDetail
    @State private var viewMode: String = "floor"
    @State private var activeRoom: String = "kitchen"
    @State private var selectedWall: Int = 1

    private var kitchenData: RoomData? {
        RoomData.parse(from: detail.kitchenData)
    }

    private var bathroomData: RoomData? {
        RoomData.parse(from: detail.bathroomData)
    }

    private var currentRoomData: RoomData? {
        activeRoom == "kitchen" ? kitchenData : bathroomData
    }

    private var hasKitchen: Bool { detail.includeKitchen == true && kitchenData != nil }
    private var hasBathroom: Bool { detail.includeBathroom == true && bathroomData != nil }

    var body: some View {
        VStack(spacing: AppSpacing.md) {
            // Room switcher
            if hasKitchen && hasBathroom {
                roomSwitcher
            }

            // Room info
            if let roomData = currentRoomData {
                roomInfoBar(roomData)
            }

            // View mode tabs
            viewModeTabs

            // Content
            if let roomData = currentRoomData {
                switch viewMode {
                case "walls":
                    wallElevationView(roomData)
                default:
                    floorPlanView(roomData)
                }

                // Room stats
                roomStatsBar(roomData)
            } else {
                noDataView
            }
        }
    }

    // MARK: - Room Switcher

    private var roomSwitcher: some View {
        HStack(spacing: 0) {
            Button(action: { activeRoom = "kitchen" }) {
                HStack(spacing: 6) {
                    Image(systemName: "fork.knife")
                        .font(.system(size: 12))
                    Text("Kitchen")
                        .font(.subheadline)
                        .fontWeight(activeRoom == "kitchen" ? .semibold : .regular)
                }
                .foregroundColor(activeRoom == "kitchen" ? AppColors.blue : AppColors.textGray)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(activeRoom == "kitchen" ? AppColors.infoBg : Color.clear)
                .cornerRadius(8)
            }

            Button(action: { activeRoom = "bathroom" }) {
                HStack(spacing: 6) {
                    Image(systemName: "shower")
                        .font(.system(size: 12))
                    Text("Bathroom")
                        .font(.subheadline)
                        .fontWeight(activeRoom == "bathroom" ? .semibold : .regular)
                }
                .foregroundColor(activeRoom == "bathroom" ? Color(hex: "7c3aed") : AppColors.textGray)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(activeRoom == "bathroom" ? Color(hex: "7c3aed").opacity(0.1) : Color.clear)
                .cornerRadius(8)
            }
        }
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }

    // MARK: - Room Info

    private func roomInfoBar(_ roomData: RoomData) -> some View {
        HStack(spacing: 16) {
            HStack(spacing: 4) {
                Image(systemName: activeRoom == "kitchen" ? "fork.knife" : "shower")
                    .font(.system(size: 12))
                Text(activeRoom == "kitchen" ? "Kitchen" : "Bathroom")
                    .font(.subheadline).fontWeight(.medium)
            }
            .foregroundColor(AppColors.text)

            Spacer()

            HStack(spacing: 12) {
                HStack(spacing: 4) {
                    Text("Width:")
                        .font(.caption).foregroundColor(AppColors.textGray)
                    Text("\(Int(roomData.dimensions.width))'")
                        .font(.caption).fontWeight(.medium).foregroundColor(AppColors.text)
                }
                HStack(spacing: 4) {
                    Text("Depth:")
                        .font(.caption).foregroundColor(AppColors.textGray)
                    Text("\(Int(roomData.dimensions.height))'")
                        .font(.caption).fontWeight(.medium).foregroundColor(AppColors.text)
                }
            }
        }
        .padding(12)
        .background(Color.white)
        .cornerRadius(8)
    }

    // MARK: - View Mode Tabs

    private var viewModeTabs: some View {
        HStack(spacing: 0) {
            viewModeTab("Floor Plan", value: "floor", icon: "square.dashed")
            viewModeTab("Wall Views", value: "walls", icon: "rectangle.split.3x1")
        }
        .background(AppColors.gray200)
        .cornerRadius(8)
    }

    private func viewModeTab(_ label: String, value: String, icon: String) -> some View {
        Button(action: { viewMode = value }) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                Text(label)
                    .font(.caption)
                    .fontWeight(viewMode == value ? .semibold : .regular)
            }
            .foregroundColor(viewMode == value ? AppColors.blue : AppColors.textGray)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(viewMode == value ? Color.white : Color.clear)
            .cornerRadius(8)
        }
    }

    // MARK: - Floor Plan View

    private func floorPlanView(_ roomData: RoomData) -> some View {
        let scale = calculateScale(roomData)
        let roomWidth = roomData.dimensions.widthInches * scale
        let roomHeight = roomData.dimensions.heightInches * scale
        let padding: CGFloat = 30

        return VStack(spacing: 0) {
            // Dimension label top
            Text("\(Int(roomData.dimensions.width))'")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(AppColors.text)
                .padding(.bottom, 4)

            HStack(spacing: 0) {
                // Dimension label left
                Text("\(Int(roomData.dimensions.height))'")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(AppColors.text)
                    .rotationEffect(.degrees(-90))
                    .frame(width: 20)

                Canvas { context, size in
                    let origin = CGPoint(x: padding, y: padding)

                    // Grid pattern
                    let gridSpacing: CGFloat = 24
                    context.stroke(
                        Path { path in
                            var x = origin.x
                            while x <= origin.x + roomWidth {
                                path.move(to: CGPoint(x: x, y: origin.y))
                                path.addLine(to: CGPoint(x: x, y: origin.y + roomHeight))
                                x += gridSpacing
                            }
                            var y = origin.y
                            while y <= origin.y + roomHeight {
                                path.move(to: CGPoint(x: origin.x, y: y))
                                path.addLine(to: CGPoint(x: origin.x + roomWidth, y: y))
                                y += gridSpacing
                            }
                        },
                        with: .color(Color(hex: "f0f0f0")),
                        lineWidth: 0.5
                    )

                    // Room outline
                    let roomRect = CGRect(x: origin.x, y: origin.y, width: roomWidth, height: roomHeight)
                    context.stroke(
                        Path(roomRect),
                        with: .color(Color(hex: "333333")),
                        lineWidth: 3
                    )

                    // Draw elements
                    for element in roomData.elements {
                        drawFloorPlanElement(context: context, element: element, scale: scale, origin: origin)
                    }
                }
                .frame(width: roomWidth + padding * 2, height: roomHeight + padding * 2)
            }
        }
        .padding(12)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }

    private func drawFloorPlanElement(context: GraphicsContext, element: RoomElement, scale: CGFloat, origin: CGPoint) {
        let info = ElementTypeInfo.info(for: element.type)
        let isRotated = Int(element.rotation) % 180 != 0
        let w = (isRotated ? element.depth : element.width) * scale
        let d = (isRotated ? element.width : element.depth) * scale
        let x = origin.x + element.x
        let y = origin.y + element.y

        let rect = CGRect(x: x, y: y, width: w, height: d)

        // Special rendering for bathroom fixtures
        switch element.type {
        case "toilet":
            // Tank
            let tankRect = CGRect(x: x + w * 0.2, y: y + d * 0.1, width: w * 0.6, height: d * 0.4)
            context.fill(Path(roundedRect: tankRect, cornerRadius: 4), with: .color(.white))
            context.stroke(Path(roundedRect: tankRect, cornerRadius: 4), with: .color(Color(hex: "999999")), lineWidth: 1.5)

            // Bowl (ellipse)
            let bowlRect = CGRect(x: x + w * 0.2, y: y + d * 0.45, width: w * 0.6, height: d * 0.5)
            context.fill(Path(ellipseIn: bowlRect), with: .color(.white))
            context.stroke(Path(ellipseIn: bowlRect), with: .color(Color(hex: "999999")), lineWidth: 1.5)

            // Label
            drawElementLabel(context: context, text: "WC", rect: rect, color: Color(hex: "666666"))

        case "tub":
            // Outer
            context.fill(Path(roundedRect: rect, cornerRadius: 8), with: .color(Color(hex: "E8F4FD")))
            context.stroke(Path(roundedRect: rect, cornerRadius: 8), with: .color(Color(hex: "4A90E2")), lineWidth: 2)
            // Inner
            let innerRect = CGRect(x: x + 4, y: y + 4, width: w - 8, height: d - 8)
            context.fill(Path(roundedRect: innerRect, cornerRadius: 4), with: .color(Color(hex: "F0F8FF")))
            context.stroke(Path(roundedRect: innerRect, cornerRadius: 4), with: .color(Color(hex: "4A90E2")), lineWidth: 0.5)
            drawElementLabel(context: context, text: "TUB", rect: rect, color: Color(hex: "4A90E2"))

        case "shower":
            context.fill(Path(roundedRect: rect, cornerRadius: 4), with: .color(Color(hex: "F0F8FF")))
            context.stroke(Path(roundedRect: rect, cornerRadius: 4), with: .color(Color(hex: "4A90E2")), lineWidth: 2)
            // Cross lines
            context.stroke(
                Path { path in
                    path.move(to: CGPoint(x: x, y: y))
                    path.addLine(to: CGPoint(x: x + w, y: y + d))
                    path.move(to: CGPoint(x: x + w, y: y))
                    path.addLine(to: CGPoint(x: x, y: y + d))
                },
                with: .color(Color(hex: "4A90E2")),
                lineWidth: 0.5
            )
            // Drain
            let drainRect = CGRect(x: x + w / 2 - w * 0.1, y: y + d / 2 - w * 0.1, width: w * 0.2, height: w * 0.2)
            context.fill(Path(ellipseIn: drainRect), with: .color(Color(hex: "cccccc")))

        default:
            // Cabinet / appliance default
            let fillColor = info.color
            let strokeColor = info.strokeColor ?? Color(hex: "333333")

            context.fill(Path(roundedRect: rect, cornerRadius: 2), with: .color(fillColor.opacity(0.9)))
            context.stroke(Path(roundedRect: rect, cornerRadius: 2), with: .color(strokeColor), lineWidth: 1.5)

            // Cross lines for cabinets
            if element.category == "cabinet" {
                context.stroke(
                    Path { path in
                        path.move(to: CGPoint(x: x, y: y))
                        path.addLine(to: CGPoint(x: x + w, y: y + d))
                        path.move(to: CGPoint(x: x + w, y: y))
                        path.addLine(to: CGPoint(x: x, y: y + d))
                    },
                    with: .color(Color(hex: "5c3a21")),
                    lineWidth: 0.5
                )
            }

            // Type label
            let label = element.type.uppercased().replacingOccurrences(of: "-", with: " ")
            let textColor: Color = element.category == "cabinet" ? .white : (info.strokeColor != nil ? info.strokeColor! : .white)
            drawElementLabel(context: context, text: label, rect: rect, color: textColor)
        }
    }

    private func drawElementLabel(context: GraphicsContext, text: String, rect: CGRect, color: Color) {
        let fontSize = min(rect.width, rect.height) / 5
        guard fontSize >= 5 else { return }

        context.draw(
            Text(text)
                .font(.system(size: max(fontSize, 7), weight: .bold))
                .foregroundColor(color),
            at: CGPoint(x: rect.midX, y: rect.midY),
            anchor: .center
        )
    }

    // MARK: - Wall Elevation View

    private func wallElevationView(_ roomData: RoomData) -> some View {
        let scale = calculateScale(roomData)
        let wallWidth: CGFloat = {
            let roomW = roomData.dimensions.widthInches * scale
            let roomH = roomData.dimensions.heightInches * scale
            return (selectedWall == 1 || selectedWall == 3) ? roomW : roomH
        }()
        let wallDisplayHeight: CGFloat = 240

        return VStack(spacing: AppSpacing.md) {
            // Wall selector
            HStack(spacing: 8) {
                ForEach(1...4, id: \.self) { wall in
                    Button(action: { selectedWall = wall }) {
                        Text("Wall \(wall)")
                            .font(.caption)
                            .fontWeight(selectedWall == wall ? .semibold : .regular)
                            .foregroundColor(selectedWall == wall ? .white : AppColors.textMedium)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(selectedWall == wall ? AppColors.blue : AppColors.gray200)
                            .cornerRadius(8)
                    }
                }
            }

            // Wall elevation canvas
            Canvas { context, size in
                let padding: CGFloat = 30
                let origin = CGPoint(x: padding, y: padding)

                // Wall background
                let wallRect = CGRect(x: origin.x, y: origin.y, width: wallWidth, height: wallDisplayHeight)
                context.fill(Path(wallRect), with: .color(Color(hex: "f8f9fa")))
                context.stroke(Path(wallRect), with: .color(Color(hex: "333333")), lineWidth: 2)

                // Floor line
                let floorY = origin.y + wallDisplayHeight
                context.stroke(
                    Path { path in
                        path.move(to: CGPoint(x: origin.x, y: floorY))
                        path.addLine(to: CGPoint(x: origin.x + wallWidth, y: floorY))
                    },
                    with: .color(Color(hex: "333333")),
                    lineWidth: 3
                )

                // Elements on this wall
                let elementsOnWall = getElementsOnWall(selectedWall, roomData: roomData, scale: scale)
                for element in elementsOnWall {
                    let info = ElementTypeInfo.info(for: element.type)
                    let elemWidth = element.width * scale
                    let elemHeight = (info.defaultHeight) * scale * 0.6
                    let yPos = element.category == "wall" || element.category == "medicine"
                        ? origin.y + 10
                        : floorY - elemHeight

                    let xPos: CGFloat = {
                        if selectedWall == 1 || selectedWall == 3 {
                            return origin.x + element.x
                        } else {
                            return origin.x + element.y
                        }
                    }()

                    let elemRect = CGRect(x: xPos, y: yPos, width: elemWidth, height: elemHeight)

                    // Cabinet body with gradient effect
                    context.fill(Path(roundedRect: elemRect, cornerRadius: 3), with: .color(info.color))
                    context.stroke(Path(roundedRect: elemRect, cornerRadius: 3), with: .color(Color(hex: "2F1B14")), lineWidth: 1.5)

                    // Door panels
                    if element.category == "cabinet" && elemWidth > 20 {
                        let leftDoor = CGRect(x: xPos + 4, y: yPos + 4, width: elemWidth / 2 - 6, height: elemHeight - 8)
                        let rightDoor = CGRect(x: xPos + elemWidth / 2 + 2, y: yPos + 4, width: elemWidth / 2 - 6, height: elemHeight - 8)
                        context.stroke(Path(roundedRect: leftDoor, cornerRadius: 2), with: .color(Color(hex: "2F1B14")), lineWidth: 1)
                        context.stroke(Path(roundedRect: rightDoor, cornerRadius: 2), with: .color(Color(hex: "2F1B14")), lineWidth: 1)

                        // Handles
                        let handleSize: CGFloat = 3
                        let leftHandle = CGRect(x: xPos + elemWidth / 2 - 10, y: yPos + elemHeight / 2 - handleSize / 2, width: handleSize, height: handleSize)
                        let rightHandle = CGRect(x: xPos + elemWidth / 2 + 7, y: yPos + elemHeight / 2 - handleSize / 2, width: handleSize, height: handleSize)
                        context.fill(Path(ellipseIn: leftHandle), with: .color(Color(hex: "C0C0C0")))
                        context.fill(Path(ellipseIn: rightHandle), with: .color(Color(hex: "C0C0C0")))
                    }

                    // Label below element
                    let label = element.type.uppercased().replacingOccurrences(of: "-", with: " ")
                    context.draw(
                        Text(label)
                            .font(.system(size: 7, weight: .bold))
                            .foregroundColor(AppColors.text),
                        at: CGPoint(x: xPos + elemWidth / 2, y: yPos + elemHeight + 10),
                        anchor: .center
                    )
                }

                // Height label
                context.draw(
                    Text("\(Int(roomData.dimensions.wallHeight))\" height")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(AppColors.textGray),
                    at: CGPoint(x: 15, y: origin.y + wallDisplayHeight / 2),
                    anchor: .center
                )
            }
            .frame(width: wallWidth + 60, height: wallDisplayHeight + 80)
            .background(Color.white)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppColors.border, lineWidth: 1)
            )
        }
    }

    private func getElementsOnWall(_ wallNumber: Int, roomData: RoomData, scale: CGFloat) -> [RoomElement] {
        let threshold: CGFloat = 20
        let roomWidth = roomData.dimensions.widthInches * scale
        let roomHeight = roomData.dimensions.heightInches * scale

        return roomData.elements.filter { element in
            let isRotated = Int(element.rotation) % 180 != 0
            let elemWidth = (isRotated ? element.depth : element.width) * scale
            let elemDepth = (isRotated ? element.width : element.depth) * scale

            switch wallNumber {
            case 1: return element.y < threshold
            case 2: return element.x + elemWidth > roomWidth - threshold
            case 3: return element.y + elemDepth > roomHeight - threshold
            case 4: return element.x < threshold
            default: return false
            }
        }
    }

    // MARK: - Room Stats

    private func roomStatsBar(_ roomData: RoomData) -> some View {
        HStack(spacing: 8) {
            roomStatCard(value: "\(roomData.cabinetCount)", label: "Cabinets", color: AppColors.blue)
            roomStatCard(value: "\(roomData.applianceCount)", label: "Appliances", color: AppColors.successMedium)
            roomStatCard(value: "\(Int(roomData.dimensions.squareFeet))", label: "Sq Ft", color: AppColors.warningMedium)
        }
    }

    private func roomStatCard(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color.white)
        .cornerRadius(8)
    }

    // MARK: - No Data View

    private var noDataView: some View {
        VStack(spacing: 12) {
            Image(systemName: activeRoom == "kitchen" ? "fork.knife" : "shower")
                .font(.system(size: 36))
                .foregroundColor(AppColors.gray400)
            Text("No design data available for \(activeRoom)")
                .font(.subheadline)
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .background(AppColors.gray50)
        .cornerRadius(8)
    }

    // MARK: - Scale Calculation

    private func calculateScale(_ roomData: RoomData) -> CGFloat {
        let maxCanvasSize: CGFloat = 300 // fit mobile screen
        let scaleX = maxCanvasSize / roomData.dimensions.widthInches
        let scaleY = maxCanvasSize / roomData.dimensions.heightInches
        return min(scaleX, scaleY)
    }
}
