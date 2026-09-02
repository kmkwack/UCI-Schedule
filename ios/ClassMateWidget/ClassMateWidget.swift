//
//  ClassMateWidget.swift
//  ClassMateWidget
//

import WidgetKit
import SwiftUI

// MARK: - Theme

private extension Color {
    static let brand = Color(red: 0.255, green: 0.412, blue: 0.882)   // #4169E1

    /// Parses "#RRGGBB". Falls back to the supplied colour so a malformed value
    /// from the app can never blank out a row.
    init(hex: String?, fallback: Color = .brand) {
        guard
            let hex,
            let value = Int(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16),
            hex.count >= 6
        else { self = fallback; return }

        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

// MARK: - Timeline

struct ScheduleEntry: TimelineEntry {
    let date: Date
    let payload: SchedulePayload?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> ScheduleEntry {
        ScheduleEntry(date: Date(), payload: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (ScheduleEntry) -> Void) {
        completion(ScheduleEntry(date: Date(), payload: ScheduleStore.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ScheduleEntry>) -> Void) {
        let payload = ScheduleStore.load()
        let now = Date()
        let calendar = Calendar.current

        // Refresh when the displayed information actually changes — at each
        // class boundary today, and at midnight — rather than on a fixed
        // interval. WidgetKit budgets refreshes, so spending them on moments
        // that change nothing means the widget is stale when it matters.
        var dates: [Date] = [now]
        let startOfToday = calendar.startOfDay(for: now)

        if let payload {
            for course in payload.classesToday(now: now) {
                for minutes in [course.startMinutes, course.endMinutes] {
                    if let date = calendar.date(byAdding: .minute, value: minutes, to: startOfToday), date > now {
                        dates.append(date)
                    }
                }
            }
        }

        if let midnight = calendar.date(byAdding: .day, value: 1, to: startOfToday) {
            dates.append(midnight)
        }

        let entries = dates.sorted().map { ScheduleEntry(date: $0, payload: payload) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Shared pieces

private struct EmptyStateView: View {
    let payload: SchedulePayload?
    var compact: Bool = false

    private var message: String {
        guard let payload else { return "Open ClassMate to set up your schedule" }
        if payload.isTermOver { return "Term's over 🎉" }
        return "No classes today"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(message)
                .font(compact ? .caption : .subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct ClassRow: View {
    let course: ScheduleClass
    var showsLocation: Bool = true
    /// Rows stretch to fill the widget rather than sitting at a fixed height:
    /// with two classes a fixed row leaves the bottom half of the widget empty.
    var height: CGFloat = 30

    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color(hex: course.borderHex))
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text(course.code)
                        .font(.caption)
                        .fontWeight(.bold)
                        .lineLimit(1)
                    Text(course.timeRangeLabel)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Text([course.title, course.location].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .frame(height: height)
    }
}

// MARK: - Small — the next class

struct NextClassView: View {
    let entry: ScheduleEntry

    var body: some View {
        let payload = entry.payload
        let current = payload?.currentClass(now: entry.date)
        let next = payload?.nextClass(now: entry.date)

        VStack(alignment: .leading, spacing: 0) {
            Text(current != nil ? "IN CLASS" : "NEXT CLASS")
                .font(.caption2)
                .fontWeight(.heavy)
                .foregroundStyle(Color.brand)

            Spacer(minLength: 4)

            if let course = current ?? next?.course {
                Text(course.code)
                    .font(.system(size: 20, weight: .heavy))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text(course.title)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                Text(course.timeRangeLabel)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                if let location = course.location {
                    Text(location)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }

                // Only meaningful for a future class; a class already running
                // would render as "in 0 minutes".
                if current == nil, let date = next?.date {
                    Spacer(minLength: 4)
                    Text(date, style: .relative)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.brand)
                        .lineLimit(1)
                }
            } else {
                EmptyStateView(payload: payload, compact: true)
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Medium — today

struct TodayView: View {
    let entry: ScheduleEntry

    var body: some View {
        let payload = entry.payload
        let today = payload?.classesToday(now: entry.date) ?? []
        let shown = Array(today.prefix(4))

        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("TODAY'S CLASSES")
                    .font(.caption2)
                    .fontWeight(.heavy)
                    .foregroundStyle(Color.brand)
                Spacer()
                if !today.isEmpty {
                    Text("\(today.count) class\(today.count == 1 ? "" : "es")")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                }
            }

            if today.isEmpty {
                EmptyStateView(payload: payload)
            } else {
                GeometryReader { geo in
                    // Divide the available height between the rows instead of
                    // stacking fixed-height ones, so two classes fill the widget
                    // the same way four do. Capped so a single class doesn't
                    // become one enormous row.
                    let spacing: CGFloat = 4
                    let total = geo.size.height - spacing * CGFloat(max(0, shown.count - 1))
                    let rowHeight = min(56, max(26, total / CGFloat(shown.count)))

                    VStack(alignment: .leading, spacing: spacing) {
                        ForEach(shown) { ClassRow(course: $0, height: rowHeight) }
                        if today.count > shown.count {
                            Text("+\(today.count - shown.count) more")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Large — the week as a timetable grid

/// Mirrors the app's timetable: a bordered, clipped frame with a tinted header
/// row, a time gutter, ruled columns, and pastel blocks. Matching that
/// structure is the point — a bare chart of floating rectangles doesn't read as
/// the same product.
struct WeekView: View {
    let entry: ScheduleEntry

    private let weekdays = [1, 2, 3, 4, 5]
    private let labels = ["MON", "TUE", "WED", "THU", "FRI"]
    private let timeGutter: CGFloat = 30
    private let headerHeight: CGFloat = 20

    private var line: Color { Color.secondary.opacity(0.18) }

    var body: some View {
        let payload = entry.payload
        let all = payload?.isTermOver == true ? [] : (payload?.classes ?? [])
        let weekClasses = all.filter { weekdays.contains($0.weekday) }
        let todayIndex = Calendar.current.component(.weekday, from: entry.date) - 1

        VStack(alignment: .leading, spacing: 6) {
            Text(payload?.termLabel.uppercased() ?? "CLASSMATE")
                .font(.caption2)
                .fontWeight(.heavy)
                .foregroundStyle(Color.brand)

            if weekClasses.isEmpty {
                EmptyStateView(payload: payload)
            } else {
                // Only the hours that actually contain class, so an
                // afternoon-only schedule fills the frame instead of floating in
                // a mostly empty 8am–10pm chart.
                let startHour = (weekClasses.map(\.startMinutes).min() ?? 480) / 60
                let endHour = Int(ceil(Double(weekClasses.map(\.endMinutes).max() ?? 1080) / 60))
                let hours = max(1, endHour - startHour)

                GeometryReader { geo in
                    let dayWidth = (geo.size.width - timeGutter) / CGFloat(weekdays.count)
                    let hourHeight = max(0, geo.size.height - headerHeight) / CGFloat(hours)

                    ZStack(alignment: .topLeading) {
                        // Header band
                        Rectangle()
                            .fill(Color(uiColor: .tertiarySystemFill))
                            .frame(height: headerHeight)

                        ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                            Text(label)
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(weekdays[index] == todayIndex ? Color.brand : .secondary)
                                .frame(width: dayWidth, height: headerHeight)
                                .offset(x: timeGutter + CGFloat(index) * dayWidth)
                        }

                        // Column rules
                        ForEach(0...weekdays.count, id: \.self) { index in
                            Rectangle()
                                .fill(line)
                                .frame(width: 0.5)
                                .offset(x: timeGutter + CGFloat(index) * dayWidth)
                        }

                        // Hour rules + gutter labels
                        ForEach(0...hours, id: \.self) { offset in
                            let y = headerHeight + CGFloat(offset) * hourHeight
                            Rectangle()
                                .fill(line)
                                .frame(height: 0.5)
                                .offset(y: y)

                            if offset < hours {
                                Text(ScheduleClass.formatMinutes((startHour + offset) * 60))
                                    .font(.system(size: 7, weight: .medium))
                                    .foregroundStyle(.tertiary)
                                    .frame(width: timeGutter - 4, alignment: .trailing)
                                    .offset(y: y + 2)
                            }
                        }

                        // Class blocks
                        ForEach(weekClasses) { course in
                            let dayIndex = weekdays.firstIndex(of: course.weekday) ?? 0
                            let top = CGFloat(course.startMinutes - startHour * 60) / 60 * hourHeight
                            let height = max(14, CGFloat(course.endMinutes - course.startMinutes) / 60 * hourHeight)
                            let background = Color(hex: course.bgHex, fallback: Color.brand.opacity(0.12))
                            let ink = Color(hex: course.textHex)
                            let edge = Color(hex: course.borderHex)

                            VStack(alignment: .leading, spacing: 0) {
                                Text(course.code)
                                    .font(.system(size: 8, weight: .heavy))
                                    .foregroundStyle(ink)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.65)
                                if height > 26, let location = course.location {
                                    Text(location)
                                        .font(.system(size: 6.5, weight: .semibold))
                                        .foregroundStyle(ink.opacity(0.72))
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 2)
                            .padding(.vertical, 2)
                            .frame(width: dayWidth - 3, height: height, alignment: .topLeading)
                            .background(background)
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(edge, lineWidth: 0.5)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                            .offset(
                                x: timeGutter + CGFloat(dayIndex) * dayWidth + 1.5,
                                y: headerHeight + top
                            )
                        }
                    }
                }
                .background(Color(uiColor: .secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(line, lineWidth: 0.5)
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Widget

struct ClassMateWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:  NextClassView(entry: entry)
        case .systemLarge:  WeekView(entry: entry)
        default:            TodayView(entry: entry)
        }
    }
}

struct ClassMateWidget: Widget {
    let kind: String = "ClassMateWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            ClassMateWidgetEntryView(entry: entry)
                // The template's .fill.tertiary is a translucent grey; the app's
                // timetable sits on a white card, and the pale pastel blocks are
                // designed for that. On grey they lose all contrast.
                .containerBackground(Color(uiColor: .systemBackground), for: .widget)
        }
        .configurationDisplayName("Schedule")
        .description("Your next class, today's timetable, or the whole week.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
