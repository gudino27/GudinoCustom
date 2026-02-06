//
//  SubTabBar.swift
//  GCWadmin
//
//  Generic in-view tab bar for feature sections
//

import SwiftUI

struct SubTab: Identifiable {
    let id: String
    let label: String
    let icon: String
    var count: Int? = nil
}

struct SubTabBar: View {
    let tabs: [SubTab]
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = tab.id
                    }
                } label: {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 12))

                        Text(tab.label)
                            .font(AppTypography.small())
                            .fontWeight(.medium)

                        if let count = tab.count {
                            Text("\(count)")
                                .font(AppTypography.small())
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 1)
                                .background(selection == tab.id ? AppColors.blue : AppColors.textLight)
                                .cornerRadius(AppRadius.full)
                        }
                    }
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .foregroundColor(selection == tab.id ? AppColors.blue : AppColors.textGray)
                    .background(
                        selection == tab.id ?
                        AppColors.blue.opacity(0.1) :
                        Color.clear
                    )
                    .overlay(
                        Rectangle()
                            .frame(height: 2)
                            .foregroundColor(selection == tab.id ? AppColors.blue : Color.clear),
                        alignment: .bottom
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color.white)
        .cornerRadius(AppRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.md)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }
}
