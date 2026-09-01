//
//  ClassMateWidget.swift
//  ClassMateWidget
//

import WidgetKit
import SwiftUI

// MARK: - Theme

private extension Color {
    static let brand = Color(red: 0.255, green: 0.412, blue: 0.882)   // #4169E1

    /// Parses "#RRGGBB". Falls back to the brand colour so a malformed value
    /// from the app can never blank out a row.
    init(hex: String?) {
        guard
            let hex,
            let value = Int(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16),
            hex.count >= 6
        else { self = .brand; return }

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

    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color(hex: course.colorHex))
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 1) {
                Text(course.code)
                    .font(.caption)
                    .fontWeight(.bold)
                    .lineLimit(1)

                Text(showsLocation && course.location != nil
                     ? "\(course.startLabel) · \(course.location!)"
                     : course.timeRangeLabel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .frame(height: 30)
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
            Text(current != nil ? "NOW" : "NEXT")
                .font(.caption2)
                .fontWeight(.heavy)
                .foregroundStyle(Color.brand)

            Spacer(minLength: 4)

            if let course = current ?? next?.course {
                Text(course.code)
                    .font(.system(size: 20, weight: .heavy))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text(course.timeRangeLabel)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
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

        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("TODAY")
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
                // Four rows is what fits; anything beyond that is summarised
                // rather than clipped mid-row.
                ForEach(today.prefix(4)) { ClassRow(course: $0) }
                if today.count > 4 {
                    Text("+\(today.count - 4) more")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Large — the week

struct WeekView: View {
    let entry: ScheduleEntry

    private let weekdays = [1, 2, 3, 4, 5]           // Mon–Fri
    private let labels = ["MON", "TUE", "WED", "THU", "FRI"]

    var body: some View {
        let payload = entry.payload
        let todayIndex = Calendar.current.component(.weekday, from: entry.date) - 1

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(payload?.termLabel.uppercased() ?? "CLASSMATE")
                    .font(.caption2)
                    .fontWeight(.heavy)
                    .foregroundStyle(Color.brand)
                Spacer()
            }

            if payload == nil || payload!.classes.isEmpty {
                EmptyStateView(payload: payload)
            } else {
                ForEach(Array(zip(weekdays, labels)), id: \.0) { weekday, label in
                    let classes = payload!.classes(onWeekday: weekday)

                    HStack(alignment: .top, spacing: 8) {
                        Text(label)
                            .font(.caption2)
                            .fontWeight(.bold)
                            // Today's column is highlighted so the eye lands on
                            // the row that matters without reading the labels.
                            .foregroundStyle(weekday == todayIndex ? Color.brand : .secondary)
                            .frame(width: 34, alignment: .leading)

                        if classes.isEmpty {
                            Text("—")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        } else {
                            // Codes only: the week view answers "what days am I
                            // busy", and times at this density are unreadable.
                            HStack(spacing: 4) {
                                ForEach(classes.prefix(4)) { course in
                                    Text(course.code)
                                        .font(.system(size: 10, weight: .bold))
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 2)
                                        .background(Color(hex: course.colorHex).opacity(0.18))
                                        .clipShape(RoundedRectangle(cornerRadius: 5))
                                        .lineLimit(1)
                                }
                            }
                        }
                        Spacer(minLength: 0)
                    }
                }
                Spacer(minLength: 0)
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
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Schedule")
        .description("Your next class, today's timetable, or the whole week.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
