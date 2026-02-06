//
//  ShimmerEffect.swift
//  GCWadmin
//
//  Shimmer animation effect matching admin.css ::before pseudo-element
//  Replicates: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)
//              translateX from -100% to 100% on hover
//

import SwiftUI

// MARK: - Shimmer Effect Modifier
struct ShimmerEffectModifier: ViewModifier {
    @State private var isAnimating = false

    let trigger: Bool
    let duration: Double
    let shimmerColor: Color
    let autoRepeat: Bool

    init(
        trigger: Bool = false,
        duration: Double = 0.6,
        shimmerColor: Color = .white.opacity(0.2),
        autoRepeat: Bool = false
    ) {
        self.trigger = trigger
        self.duration = duration
        self.shimmerColor = shimmerColor
        self.autoRepeat = autoRepeat
    }

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    shimmerGradient
                        .frame(width: geometry.size.width)
                        .offset(x: isAnimating ? geometry.size.width : -geometry.size.width)
                }
            )
            .clipped()
            .onChange(of: trigger) { _, newValue in
                if newValue {
                    startAnimation()
                }
            }
            .onAppear {
                if autoRepeat {
                    startAutoRepeat()
                }
            }
    }

    private var shimmerGradient: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                Color.clear,
                shimmerColor,
                Color.clear
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    private func startAnimation() {
        isAnimating = false
        withAnimation(.easeInOut(duration: duration)) {
            isAnimating = true
        }
        // Reset after animation completes
        DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.1) {
            isAnimating = false
        }
    }

    private func startAutoRepeat() {
        // Start shimmer loop for loading states
        withAnimation(.easeInOut(duration: duration).repeatForever(autoreverses: false)) {
            isAnimating = true
        }
    }
}

// MARK: - Hover Shimmer Effect (for Mac Catalyst / iPad)
struct HoverShimmerModifier: ViewModifier {
    @State private var isHovered = false
    @State private var shimmerOffset: CGFloat = -1

    let duration: Double
    let shimmerColor: Color

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    shimmerGradient
                        .frame(width: geometry.size.width)
                        .offset(x: shimmerOffset * geometry.size.width)
                }
            )
            .clipped()
            .onHover { hovering in
                isHovered = hovering
                if hovering {
                    animateShimmer()
                }
            }
    }

    private var shimmerGradient: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                Color.clear,
                shimmerColor,
                Color.clear
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    private func animateShimmer() {
        shimmerOffset = -1
        withAnimation(.easeInOut(duration: duration)) {
            shimmerOffset = 1
        }
    }
}

// MARK: - Touch Shimmer Effect (for iOS touch feedback)
struct TouchShimmerModifier: ViewModifier {
    @State private var isPressed = false
    @State private var shimmerOffset: CGFloat = -1

    let duration: Double
    let shimmerColor: Color

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    shimmerGradient
                        .frame(width: geometry.size.width)
                        .offset(x: shimmerOffset * geometry.size.width)
                        .allowsHitTesting(false)
                }
            )
            .clipped()
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !isPressed {
                            isPressed = true
                            animateShimmer()
                        }
                    }
                    .onEnded { _ in
                        isPressed = false
                    }
            )
    }

    private var shimmerGradient: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                Color.clear,
                shimmerColor,
                Color.clear
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    private func animateShimmer() {
        shimmerOffset = -1
        withAnimation(.easeInOut(duration: duration)) {
            shimmerOffset = 1
        }
    }
}

// MARK: - Continuous Shimmer (for loading states)
struct ContinuousShimmerModifier: ViewModifier {
    @State private var shimmerOffset: CGFloat = -1

    let duration: Double
    let shimmerColor: Color

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    shimmerGradient
                        .frame(width: geometry.size.width)
                        .offset(x: shimmerOffset * geometry.size.width)
                }
            )
            .clipped()
            .onAppear {
                withAnimation(
                    .linear(duration: duration)
                    .repeatForever(autoreverses: false)
                ) {
                    shimmerOffset = 1
                }
            }
    }

    private var shimmerGradient: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                Color.clear,
                shimmerColor,
                Color.clear
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )
    }
}

// MARK: - View Extensions
extension View {
    /// Apply shimmer effect triggered by a boolean
    /// - Parameters:
    ///   - trigger: Boolean that triggers the animation when true
    ///   - duration: Animation duration (default 0.6s matching admin.css)
    ///   - color: Shimmer color (default white 0.2 opacity)
    func shimmer(
        trigger: Bool,
        duration: Double = 0.6,
        color: Color = .white.opacity(0.2)
    ) -> some View {
        modifier(ShimmerEffectModifier(
            trigger: trigger,
            duration: duration,
            shimmerColor: color
        ))
    }

    /// Apply hover-triggered shimmer effect (Mac Catalyst / iPad)
    /// - Parameters:
    ///   - duration: Animation duration (default 0.6s)
    ///   - color: Shimmer color
    func hoverShimmer(
        duration: Double = 0.6,
        color: Color = .white.opacity(0.2)
    ) -> some View {
        modifier(HoverShimmerModifier(
            duration: duration,
            shimmerColor: color
        ))
    }

    /// Apply touch-triggered shimmer effect (iOS)
    /// - Parameters:
    ///   - duration: Animation duration
    ///   - color: Shimmer color
    func touchShimmer(
        duration: Double = 0.6,
        color: Color = .white.opacity(0.3)
    ) -> some View {
        modifier(TouchShimmerModifier(
            duration: duration,
            shimmerColor: color
        ))
    }

    /// Apply continuous shimmer effect (for loading states)
    /// - Parameters:
    ///   - duration: Animation duration per cycle
    ///   - color: Shimmer color
    func continuousShimmer(
        duration: Double = 2.0,
        color: Color = .white.opacity(0.2)
    ) -> some View {
        modifier(ContinuousShimmerModifier(
            duration: duration,
            shimmerColor: color
        ))
    }

    /// Nav shimmer effect (2s duration like admin-nav-glass)
    func navShimmer() -> some View {
        hoverShimmer(duration: 2.0, color: .white.opacity(0.2))
    }

    /// Tab shimmer effect (0.6s duration like admin-tab-glass)
    func tabShimmer() -> some View {
        hoverShimmer(duration: 0.6, color: .white.opacity(0.3))
    }
}

// MARK: - Previews
#Preview("Shimmer Effects") {
    struct ShimmerDemo: View {
        @State private var triggerShimmer = false

        var body: some View {
            ZStack {
                AppColors.primary
                    .ignoresSafeArea()

                VStack(spacing: AppSpacing.xxxl) {
                    // Manual trigger shimmer
                    Button(action: {
                        triggerShimmer = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                            triggerShimmer = false
                        }
                    }) {
                        Text("Tap for Shimmer")
                            .foregroundColor(.white)
                            .padding()
                            .background(AppColors.blue)
                            .cornerRadius(AppRadius.lg)
                    }
                    .shimmer(trigger: triggerShimmer)

                    // Hover shimmer (works on iPad/Mac)
                    Text("Hover for Shimmer")
                        .foregroundColor(.white)
                        .padding()
                        .navGlass(cornerRadius: AppRadius.lg)
                        .hoverShimmer(duration: 0.6)

                    // Touch shimmer
                    Text("Touch for Shimmer")
                        .foregroundColor(.white)
                        .padding()
                        .tabGlass(isActive: false)
                        .touchShimmer()

                    // Continuous shimmer (loading)
                    Text("Loading...")
                        .foregroundColor(.white)
                        .padding()
                        .background(AppColors.glassTab)
                        .cornerRadius(AppRadius.lg)
                        .continuousShimmer(duration: 2.0)
                }
                .padding()
            }
        }
    }

    return ShimmerDemo()
}
