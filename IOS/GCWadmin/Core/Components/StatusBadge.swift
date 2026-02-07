//
//  StatusBadge.swift
//  GCWadmin
//
//  Reusable color-coded status pill badge
//

import SwiftUI

struct StatusBadge: View {
    let label: String
    let color: Color
    let bgColor: Color

    init(label: String, color: Color, bgColor: Color) {
        self.label = label
        self.color = color
        self.bgColor = bgColor
    }

    var body: some View {
        Text(label)
            .font(AppTypography.small())
            .fontWeight(.medium)
            .foregroundColor(color)
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, 2)
            .background(bgColor)
            .cornerRadius(AppRadius.full)
    }
}

// MARK: - Convenience Initializers

extension StatusBadge {
    static func success(_ label: String) -> StatusBadge {
        StatusBadge(label: label, color: AppColors.success, bgColor: AppColors.successBg)
    }

    static func error(_ label: String) -> StatusBadge {
        StatusBadge(label: label, color: AppColors.error, bgColor: AppColors.errorBg)
    }

    static func warning(_ label: String) -> StatusBadge {
        StatusBadge(label: label, color: AppColors.warning, bgColor: AppColors.warningBg)
    }

    static func info(_ label: String) -> StatusBadge {
        StatusBadge(label: label, color: AppColors.blue, bgColor: AppColors.infoBg)
    }

    static func neutral(_ label: String) -> StatusBadge {
        StatusBadge(label: label, color: AppColors.textGray, bgColor: AppColors.gray50)
    }

    /// Map security action strings to appropriate badge styles
    static func securityAction(_ action: String) -> StatusBadge {
        switch action {
        case "login_success":
            return .success("Login Success")
        case "login_failed":
            return .warning("Login Failed")
        case "account_locked":
            return .error("Account Locked")
        case "account_unlocked":
            return .info("Account Unlocked")
        case "logout":
            return .neutral("Logout")
        default:
            return .neutral(action.replacingOccurrences(of: "_", with: " ").capitalized)
        }
    }

    /// Map appointment status strings to appropriate badge styles
    static func appointmentStatus(_ status: String) -> StatusBadge {
        switch status.lowercased() {
        case "pending":
            return .warning("Pending")
        case "confirmed":
            return .info("Confirmed")
        case "completed":
            return .success("Completed")
        case "cancelled":
            return .error("Cancelled")
        case "no_show":
            return .error("No Show")
        case "needs_reschedule":
            return .warning("Needs Reschedule")
        default:
            return .neutral(status.capitalized)
        }
    }

    /// Map timeline phase status strings to appropriate badge styles
    static func phaseStatus(_ status: String) -> StatusBadge {
        switch status.lowercased() {
        case "pending":
            return .neutral("Pending")
        case "in_progress":
            return .info("In Progress")
        case "completed":
            return .success("Completed")
        default:
            return .neutral(status.capitalized)
        }
    }

    /// Map SMS delivery status
    static func smsStatus(_ status: String) -> StatusBadge {
        switch status.lowercased() {
        case "sent", "delivered":
            return .success(status.capitalized)
        case "failed":
            return .error("Failed")
        case "pending", "queued":
            return .warning(status.capitalized)
        default:
            return .neutral(status.capitalized)
        }
    }
}
