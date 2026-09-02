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

/// Location as it should read on a widget. The app's data carries "TBA" and
/// online-course placeholders that are noise in a two-word slot, so they become
/// a short word or nothing rather than shouting "TBA".
extension ScheduleClass {
    var displayLocation: String? {
        guard let raw = location?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        let lowered = raw.lowercased()
        if lowered.contains("online") || lowered.contains("remote") { return "Online" }
        if lowered == "tba" || lowered == "n/a" { return nil }
        return raw
    }
}

/// The design's dark-mode rule: pastel backgrounds don't survive on near-black,
/// so each triple is remapped rather than dimmed. Text becomes the triple's
/// *border* colour — enough chroma to identify the course without going neon —
/// and the card becomes a 12%-toward-black mix of the pastel.
private struct CoursePalette {
    let background: Color
    let ink: Color
    let edge: Color

    init(_ course: ScheduleClass, dark: Bool, insideGrid: Bool = false) {
        if dark {
            background = insideGrid
                ? Color(hex: course.bgHex, fallback: .black).mix(toward: .black, amount: 0.88)
                : Color(red: 0.067, green: 0.094, blue: 0.153)   // #111827
            ink = Color(hex: course.borderHex, fallback: .white)
            edge = Color(hex: course.borderHex, fallback: .white).opacity(0.55)
        } else {
            background = Color(hex: course.bgHex, fallback: Color(uiColor: .secondarySystemBackground))
            ink = Color(hex: course.textHex, fallback: .primary)
            edge = Color(hex: course.borderHex)
        }
    }
}

private extension Color {
    func mix(toward other: Color, amount: Double) -> Color {
        let a = UIColor(self), b = UIColor(other)
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let t = CGFloat(amount)
        return Color(red: Double(ar + (br - ar) * t),
                     green: Double(ag + (bg - ag) * t),
                     blue: Double(ab + (bb - ab) * t))
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

/// A pastel card filling the widget, per the design spec.
///
/// Colour roles are deliberate: the course's pastel triple carries the card and
/// the course identity (code + title), while time and location stay in system
/// text so they read as facts rather than branding. #4169E1 is reserved for the
/// "in class" pill and its progress fill — the one thing that is genuinely
/// happening now.
struct NextClassView: View {
    let entry: ScheduleEntry

    var body: some View {
        let payload = entry.payload
        let current = payload?.currentClass(now: entry.date)
        let next = payload?.nextClass(now: entry.date)

        if let course = current ?? next?.course {
            card(course: course, isNow: current != nil, startsAt: next?.date)
        } else {
            allDoneCard(payload: payload)
        }
    }

    private func card(course: ScheduleClass, isNow: Bool, startsAt: Date?) -> some View {
        let bg = Color(hex: course.bgHex, fallback: Color(uiColor: .secondarySystemBackground))
        let ink = Color(hex: course.textHex, fallback: .primary)
        let edge = Color(hex: course.borderHex)

        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Text(isNow ? "IN CLASS" : "NEXT UP")
                    .font(.system(size: 8.5, weight: .heavy))
                    .tracking(0.85)
                    .foregroundStyle(isNow ? .white : ink)
                    .padding(.horizontal, isNow ? 6 : 0)
                    .padding(.vertical, isNow ? 3 : 0)
                    .background(isNow ? Color.brand : .clear)
                    .clipShape(Capsule())

                Spacer(minLength: 2)

                Text(isNow
                     ? "\(course.minutesRemaining(now: entry.date)) min left"
                     : (startsAt.map { ScheduleClass.countdownLabel(to: $0, now: entry.date) } ?? ""))
                    .font(.system(size: 9.5, weight: .bold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            Text(course.code)
                .font(.system(size: 19, weight: .black))
                .tracking(-0.38)
                .foregroundStyle(ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .padding(.top, 8)

            Text(course.title)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(ink)
                .lineLimit(2)
                .padding(.top, 2)

            Spacer(minLength: 6)

            Text(course.timeRangeLabel)
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            if let location = course.displayLocation {
                Text(location)
                    .font(.system(size: 10.5, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .padding(.top, 1)
            }

            if isNow {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.brand.opacity(0.18))
                        Capsule()
                            .fill(Color.brand)
                            .frame(width: geo.size.width * course.progress(now: entry.date))
                    }
                }
                .frame(height: 3)
                .padding(.top, 7)
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(edge, lineWidth: 1))
    }

    private func allDoneCard(payload: SchedulePayload?) -> some View {
        let upcoming = payload?.nextClass(now: entry.date)

        return VStack(alignment: .leading, spacing: 0) {
            Text(payload == nil ? "CLASSMATE" : (payload?.isTermOver == true ? "TERM OVER" : "ALL DONE"))
                .font(.system(size: 8.5, weight: .heavy))
                .tracking(0.85)
                .foregroundStyle(.secondary)

            Text(payload == nil ? "Open ClassMate to set up your schedule"
                 : (payload?.isTermOver == true ? "Enjoy the break" : "No more classes today"))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.primary)
                .lineLimit(3)
                .padding(.top, 6)

            Spacer(minLength: 6)

            // The point of an empty widget is what comes next, not the emptiness.
            if let upcoming {
                Divider()
                Text(ScheduleClass.countdownLabel(to: upcoming.date, now: entry.date).uppercased())
                    .font(.system(size: 8.5, weight: .heavy))
                    .tracking(0.85)
                    .foregroundStyle(.secondary)
                    .padding(.top, 7)
                Text("\(upcoming.course.code) · \(upcoming.course.startLabel)")
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Color.brand)
                    .lineLimit(2)
                    .padding(.top, 1)
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(uiColor: .secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(uiColor: .separator).opacity(0.5), lineWidth: 1))
    }
}

// MARK: - Medium — today

/// Rows divide the available height rather than taking a fixed one, so two
/// classes give two tall rows and four give four compact ones — the widget is
/// always full. Taller rows spend the extra space on the title and location;
/// the four-class row drops the location line first, then truncates the title.
struct TodayView: View {
    @Environment(\.colorScheme) private var scheme
    let entry: ScheduleEntry

    private let timeGutter: CGFloat = 52

    var body: some View {
        let payload = entry.payload
        let today = payload?.classesToday(now: entry.date) ?? []
        let shown = Array(today.prefix(4))

        VStack(alignment: .leading, spacing: 8) {
            header(count: today.count)

            if shown.isEmpty {
                emptyCard(payload: payload)
            } else {
                VStack(spacing: shown.count >= 4 ? 5 : 6) {
                    ForEach(shown) { course in
                        row(course: course, tall: shown.count <= 3)
                    }
                    if today.count > shown.count {
                        Text("+\(today.count - shown.count) more")
                            .font(.system(size: 9.5, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func header(count: Int) -> some View {
        HStack(spacing: 6) {
            Text("TODAY")
                .font(.system(size: 10, weight: .heavy))
                .tracking(1.2)
                .foregroundStyle(Color.brand)
            Text(entry.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 2)
            if count > 0 {
                Text("\(count) class\(count == 1 ? "" : "es")")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func row(course: ScheduleClass, tall: Bool) -> some View {
        let palette = CoursePalette(course, dark: scheme == .dark)
        let isNow = course.startMinutes <= minutesNow && minutesNow < course.endMinutes

        return HStack(spacing: 0) {
            // Fixed, right-aligned time gutter so every start time lines up.
            VStack(alignment: .trailing, spacing: 0) {
                Text(course.startLabel)
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(.primary)
                Text(course.endLabel)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.tertiary)
            }
            .frame(width: timeGutter, alignment: .trailing)
            .padding(.trailing, 8)

            HStack(spacing: 6) {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 6) {
                        Text(course.code)
                            .font(.system(size: tall ? 14 : 12.5, weight: .black))
                            .foregroundStyle(palette.ink)
                            .lineLimit(1)
                        if !tall {
                            Text(course.title)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(palette.ink.opacity(0.85))
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    if tall {
                        Text(course.title)
                            .font(.system(size: 10.5, weight: .semibold))
                            .foregroundStyle(palette.ink.opacity(0.85))
                            .lineLimit(1)
                        if let location = course.displayLocation {
                            Text(isNow
                                 ? "\(location) · \(course.minutesRemaining(now: entry.date)) min left"
                                 : location)
                                .font(.system(size: 9.5, weight: .medium))
                                .foregroundStyle(palette.ink.opacity(0.65))
                                .lineLimit(1)
                        }
                    }
                }

                if isNow {
                    Text("NOW")
                        .font(.system(size: 8.5, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2.5)
                        .background(Color.brand)
                        .clipShape(Capsule())
                } else if !tall, let location = course.displayLocation {
                    Text(location)
                        .font(.system(size: 9.5, weight: .medium))
                        .foregroundStyle(palette.ink.opacity(0.65))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, tall ? 8 : 6)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(palette.background)
            .clipShape(RoundedRectangle(cornerRadius: tall ? 11 : 9))
            .overlay(RoundedRectangle(cornerRadius: tall ? 11 : 9).stroke(palette.edge, lineWidth: 1))
        }
        // min-height 0 lets the fixed widget frame govern: content never pushes
        // past 170pt, and rows share whatever is left equally.
        .frame(maxHeight: .infinity)
    }

    private var minutesNow: Int {
        let calendar = Calendar.current
        return calendar.component(.hour, from: entry.date) * 60 + calendar.component(.minute, from: entry.date)
    }

    private func emptyCard(payload: SchedulePayload?) -> some View {
        let upcoming = payload?.nextClass(now: entry.date)

        return VStack(alignment: .leading, spacing: 3) {
            Text(payload == nil ? "Open ClassMate to set up your schedule" : "No classes today")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.primary)
            if let upcoming {
                Text("Next: \(ScheduleClass.countdownLabel(to: upcoming.date, now: entry.date)) · \(upcoming.course.code)")
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Color.brand)
                    .lineLimit(2)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.brand.opacity(scheme == .dark ? 0.16 : 0.08))
        .clipShape(RoundedRectangle(cornerRadius: 11))
    }
}

// MARK: - Large — the week

/// The app's bordered-card grammar: tinted header row, time gutter, ruled day
/// columns. The plot reads as *mass* rather than a wire grid — two-hour
/// background bands carry the time reference, so no horizontal hairlines are
/// needed inside it. Today gets a solid brand header cell and a tinted column.
struct WeekView: View {
    @Environment(\.colorScheme) private var scheme
    let entry: ScheduleEntry

    private static let allLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

    /// Mon–Fri, plus a weekend column only when something actually meets then —
    /// matching how the app's grid decides its columns.
    private func visibleDays(_ classes: [ScheduleClass]) -> [Int] {
        var days = [1, 2, 3, 4, 5]
        let used = Set(classes.map(\.weekday))
        if used.contains(6) { days.append(6) }
        if used.contains(0) { days.insert(0, at: 0) }
        return days
    }
    private let timeGutter: CGFloat = 30
    private let headerHeight: CGFloat = 22

    // The app's timetable defaults to 8–17 but widens when a class falls
    // outside it (TimetableScreen's displayStartHour/displayEndHour). The
    // design's fixed 8 AM–6 PM window would silently drop a 7 PM class, so the
    // same rule is used here.
    private func plotRange(_ classes: [ScheduleClass]) -> (start: Int, end: Int) {
        guard !classes.isEmpty else { return (8, 17) }
        let earliest = classes.map { $0.startMinutes / 60 }.min() ?? 8
        let latest = classes.map { Int(ceil(Double($0.endMinutes) / 60)) }.max() ?? 17
        return (min(8, earliest), max(17, latest))
    }

    var body: some View {
        let payload = entry.payload
        let all = payload?.isTermOver == true ? [] : (payload?.classes ?? [])
        let weekClasses = all
        let today = Calendar.current.component(.weekday, from: entry.date) - 1

        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("THIS WEEK")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(1.2)
                    .foregroundStyle(Color.brand)
                Spacer()
                Text([payload?.termLabel, payload?.school].compactMap { $0 }.joined(separator: " · "))
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            if weekClasses.isEmpty {
                emptyPlot(payload: payload)
            } else {
                plot(weekClasses: weekClasses, today: today)
                footer(weekClasses: weekClasses)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func plot(weekClasses: [ScheduleClass], today: Int) -> some View {
        let weekdays = visibleDays(weekClasses)
        let labels = weekdays.map { Self.allLabels[$0] }
        let range = plotRange(weekClasses)
        let plotStartHour = range.start
        let plotEndHour = range.end
        let dark = scheme == .dark
        let hairline = Color(uiColor: .separator).opacity(dark ? 0.35 : 0.6)
        let band = dark ? Color(red: 0.067, green: 0.094, blue: 0.153)     // #111827
                        : Color(red: 0.976, green: 0.980, blue: 0.984)     // #f9fafb

        return GeometryReader { geo in
            let dayWidth = (geo.size.width - timeGutter) / CGFloat(weekdays.count)
            let plotHeight = geo.size.height - headerHeight
            let perMinute = plotHeight / CGFloat((plotEndHour - plotStartHour) * 60)

            ZStack(alignment: .topLeading) {
                // Two-hour bands replace horizontal rules, so the plot reads as
                // mass rather than a wire grid.
                let bandStep = (plotEndHour - plotStartHour) > 12 ? 3 : 2
                ForEach(Array(stride(from: plotStartHour, to: plotEndHour, by: bandStep)), id: \.self) { hour in
                    let index = (hour - plotStartHour) / bandStep
                    if index % 2 == 0 {
                        Rectangle()
                            .fill(band)
                            .frame(height: CGFloat(bandStep * 60) * perMinute)
                            .offset(y: headerHeight + CGFloat((hour - plotStartHour) * 60) * perMinute)
                    }
                }

                // Today's column wash
                if let todayIndex = weekdays.firstIndex(of: today) {
                    Rectangle()
                        .fill(Color.brand.opacity(dark ? 0.12 : 0.06))
                        .frame(width: dayWidth)
                        .offset(x: timeGutter + CGFloat(todayIndex) * dayWidth, y: headerHeight)
                }

                // Header cells
                ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                    let isToday = weekdays[index] == today
                    ZStack {
                        Rectangle().fill(isToday ? Color.brand : Color(uiColor: .tertiarySystemFill))
                        Text(label)
                            .font(.system(size: 9.5, weight: .heavy))
                            .tracking(0.55)
                            .foregroundStyle(isToday ? .white : Color.secondary)
                    }
                    .frame(width: dayWidth, height: headerHeight)
                    .offset(x: timeGutter + CGFloat(index) * dayWidth)
                }

                // Hour labels every two hours
                ForEach(Array(stride(from: plotStartHour, to: plotEndHour, by: bandStep)), id: \.self) { hour in
                    Text("\(hour % 12 == 0 ? 12 : hour % 12)")
                        .font(.system(size: 8.5, weight: .bold))
                        .foregroundStyle(.tertiary)
                        .frame(width: timeGutter - 5, alignment: .trailing)
                        .offset(y: headerHeight + CGFloat((hour - plotStartHour) * 60) * perMinute - 4)
                }

                // Column rules
                ForEach(0...weekdays.count, id: \.self) { index in
                    Rectangle()
                        .fill(hairline)
                        .frame(width: 1)
                        .offset(x: timeGutter + CGFloat(index) * dayWidth)
                }

                // Blocks
                ForEach(weekClasses) { course in
                    let dayIndex = weekdays.firstIndex(of: course.weekday) ?? 0
                    let isToday = course.weekday == today
                    let palette = CoursePalette(course, dark: dark, insideGrid: true)
                    let top = CGFloat(course.startMinutes - plotStartHour * 60) * perMinute
                    let height = max(18, CGFloat(course.endMinutes - course.startMinutes) * perMinute)

                    VStack(alignment: .leading, spacing: 0) {
                        Text(course.code)
                            .font(.system(size: 9, weight: .black))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .minimumScaleFactor(0.75)
                        // The start time only earns its place on a tall block.
                        if height >= 32 {
                            Text(course.startLabel.replacingOccurrences(of: " AM", with: "")
                                                   .replacingOccurrences(of: " PM", with: ""))
                                .font(.system(size: 8, weight: .semibold))
                                .foregroundStyle(palette.ink.opacity(0.7))
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 3)
                    .padding(.vertical, 2)
                    .frame(width: dayWidth - 4, height: height, alignment: .topLeading)
                    .background(palette.background)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(palette.edge, lineWidth: isToday ? 1.4 : 1)
                    )
                    .offset(x: timeGutter + CGFloat(dayIndex) * dayWidth + 2, y: headerHeight + top)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(hairline, lineWidth: 1))
        }
    }

    private func footer(weekClasses: [ScheduleClass]) -> some View {
        let weekdays = visibleDays(weekClasses)
        let labels = weekdays.map { Self.allLabels[$0] }
        let courses = Set(weekClasses.map(\.code)).count
        let busiest = weekdays
            .map { day in (day, weekClasses.filter { $0.weekday == day }.count) }
            .max { $0.1 < $1.1 }

        return HStack {
            Text("\(weekClasses.count) meetings · \(courses) course\(courses == 1 ? "" : "s")")
                .font(.system(size: 9.5, weight: .medium))
                .foregroundStyle(.secondary)
            Spacer()
            if let busiest, busiest.1 > 0, let index = weekdays.firstIndex(of: busiest.0) {
                Text("Busiest: \(labels[index].capitalized)")
                    .font(.system(size: 9.5, weight: .bold))
                    .foregroundStyle(Color.brand)
            }
        }
    }

    private func emptyPlot(payload: SchedulePayload?) -> some View {
        VStack(spacing: 5) {
            Spacer()
            Text(payload == nil ? "No schedule yet" : "Nothing scheduled")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.primary)
            Text(payload == nil
                 ? "Open ClassMate to add your classes"
                 : "No classes this week.")
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(uiColor: .separator).opacity(0.6), lineWidth: 1)
        )
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
                // Never translucent grey: the pale pastels need a solid ground.
                // White in light, the app's #0f172a in dark.
                .containerBackground(
                    Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
                        ? UIColor(red: 0.059, green: 0.090, blue: 0.165, alpha: 1)   // #0f172a
                        : .white }),
                    for: .widget
                )
        }
        .configurationDisplayName("Schedule")
        .description("Your next class, today's timetable, or the whole week.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
