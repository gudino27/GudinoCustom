//
//  CalendarView.swift
//  GCWadmin
//
//  Full-screen calendar view for time entries
//

import SwiftUI

struct CalendarView: View {
    @ObservedObject var viewModel: TimeClockViewModel
    @Environment(\.dismiss) var dismiss

    @State private var showEnterTimeModal = false
    @State private var selectedDateForEntry: Date?

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Summary Section
                summarySection
                    .padding(AppSpacing.base)
                    .background(Color(hex: "F8F9FA"))

                Divider()

                // Calendar Controls
                calendarControls
                    .padding(AppSpacing.base)

                // Calendar Grid
                ScrollView {
                    calendarGrid
                        .padding(AppSpacing.base)
                }

                Spacer()
            }
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Back to Dashboard") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showEnterTimeModal) {
                if let date = selectedDateForEntry {
                    EmployeeManualEntryModal(
                        viewModel: viewModel,
                        isPresented: $showEnterTimeModal,
                        preselectedDate: date
                    )
                }
            }
            .sheet(isPresented: $viewModel.showDateEntries) {
                DateEntriesSheet(viewModel: viewModel)
            }
        }
    }

    // MARK: - Summary Section

    private var summarySection: some View {
        HStack(spacing: AppSpacing.xl) {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("Days Worked")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                Text("\(daysWorked)")
                    .font(AppTypography.title2())
                    .fontWeight(.bold)
                    .foregroundColor(AppColors.text)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: AppSpacing.xs) {
                Text("Total Hours")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                Text(String(format: "%.2f", totalHours))
                    .font(AppTypography.title2())
                    .fontWeight(.bold)
                    .foregroundColor(AppColors.success)
            }
        }
    }

    // MARK: - Calendar Controls

    private var calendarControls: some View {
        VStack(spacing: AppSpacing.md) {
            // Month/Week navigation
            HStack {
                Button(action: {
                    viewModel.previousMonth()
                }) {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: "chevron.left")
                        Text(viewModel.calendarViewType == .month ? "Previous" : "Prev Week")
                    }
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.blue)
                }

                Spacer()

                Text(viewModel.selectedMonthString)
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                Spacer()

                Button(action: {
                    viewModel.nextMonth()
                }) {
                    HStack(spacing: AppSpacing.xs) {
                        Text(viewModel.calendarViewType == .month ? "Next" : "Next Week")
                        Image(systemName: "chevron.right")
                    }
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.blue)
                }
            }

            // View toggle and Today button
            HStack {
                // Week/Month toggle
                HStack(spacing: 0) {
                    Button(action: {
                        withAnimation {
                            viewModel.calendarViewType = .week
                            viewModel.updateCalendarDays()
                        }
                    }) {
                        Text("Week View")
                            .font(AppTypography.small())
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, AppSpacing.sm)
                            .background(viewModel.calendarViewType == .week ? AppColors.blue : Color.clear)
                            .foregroundColor(viewModel.calendarViewType == .week ? .white : AppColors.text)
                    }
                    .cornerRadius(AppRadius.sm, corners: [.topLeft, .bottomLeft])

                    Button(action: {
                        withAnimation {
                            viewModel.calendarViewType = .month
                            viewModel.updateCalendarDays()
                        }
                    }) {
                        Text("Month View")
                            .font(AppTypography.small())
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, AppSpacing.sm)
                            .background(viewModel.calendarViewType == .month ? AppColors.blue : Color.clear)
                            .foregroundColor(viewModel.calendarViewType == .month ? .white : AppColors.text)
                    }
                    .cornerRadius(AppRadius.sm, corners: [.topRight, .bottomRight])
                }
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.sm)
                        .stroke(AppColors.blue, lineWidth: 1)
                )

                Spacer()

                Button(action: {
                    viewModel.goToToday()
                }) {
                    Text("Today")
                        .font(AppTypography.bodyBold())
                        .foregroundColor(AppColors.blue)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, AppSpacing.sm)
                        .background(Color(hex: "E3F2FD"))
                        .cornerRadius(AppRadius.sm)
                }
            }
        }
    }

    // MARK: - Calendar Grid

    private var calendarGrid: some View {
        VStack(spacing: AppSpacing.sm) {
            // Day names
            HStack(spacing: 0) {
                ForEach(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], id: \.self) { day in
                    Text(day)
                        .font(AppTypography.small())
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.textGray)
                        .frame(maxWidth: .infinity)
                }
            }

            // Calendar days
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                ForEach(Array(viewModel.calendarDays.enumerated()), id: \.offset) { index, date in
                    if let date = date {
                        dayCell(for: date)
                    } else {
                        // Empty cell
                        Color.clear
                            .frame(height: 80)
                    }
                }
            }
        }
    }

    private func dayCell(for date: Date) -> some View {
        let isToday = Calendar.current.isDateInToday(date)
        let hasEntries = viewModel.hasEntry(for: date)
        let hours = getHoursForDate(date)

        return VStack(spacing: 2) {
            Text("\(Calendar.current.component(.day, from: date))")
                .font(AppTypography.body())
                .fontWeight(isToday ? .bold : .regular)
                .foregroundColor(isToday ? AppColors.blue : AppColors.text)

            if hasEntries {
                Text(String(format: "%.2fh", hours))
                    .font(.system(size: 10))
                    .foregroundColor(AppColors.success)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 80)
        .background(
            RoundedRectangle(cornerRadius: AppRadius.sm)
                .fill(isToday ? Color(hex: "E3F2FD") : (hasEntries ? Color(hex: "F0F9FF") : Color.clear))
        )
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.sm)
                .stroke(isToday ? AppColors.blue : Color.clear, lineWidth: 2)
        )
        .onTapGesture {
            viewModel.showEntriesForDate(date)
        }
        .onLongPressGesture {
            selectedDateForEntry = date
            showEnterTimeModal = true
        }
    }

    // MARK: - Helpers

    private var daysWorked: Int {
        let uniqueDates = Set(viewModel.currentMonthEntries.map { $0.displayDate })
        return uniqueDates.count
    }

    private var totalHours: Double {
        viewModel.currentMonthEntries.reduce(0) { sum, entry in
            sum + (entry.totalHours ?? 0)
        }
    }

    private func getHoursForDate(_ date: Date) -> Double {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)

        let entries = viewModel.currentMonthEntries.filter { entry in
            entry.clockInTime.starts(with: dateString)
        }

        return entries.reduce(0) { sum, entry in
            sum + (entry.totalHours ?? 0)
        }
    }
}

// MARK: - Corner Radius Extension

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
