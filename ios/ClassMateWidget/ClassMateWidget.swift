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

/// The course's colours, taken straight from the app's pastel triple.
private struct CoursePalette {
    let background: Color
    let ink: Color
    let edge: Color

    init(_ course: ScheduleClass) {
        background = Color(hex: course.bgHex, fallback: Color(white: 0.96))
        ink = Color(hex: course.textHex, fallback: .black)
        edge = Color(hex: course.borderHex)
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

    /// The pastel the whole widget should be washed in, so the colour reaches
    /// the widget's own edges instead of a card inset within it.
    static func backgroundTint(for entry: ScheduleEntry) -> Color? {
        let course = entry.payload?.currentClass(now: entry.date) ?? entry.payload?.nextClass(now: entry.date)?.course
        guard let course else { return nil }
        return CoursePalette(course).background
    }

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
        let ink = CoursePalette(course).ink

        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                // fixedSize keeps the pill on one line: at 170pt wide it was
                // wrapping to "IN / CLASS" and the capsule grew into a blob.
                Text(isNow ? "IN CLASS" : "NEXT UP")
                    .font(.system(size: 8.5, weight: .heavy))
                    .tracking(0.7)
                    .lineLimit(1)
                    .fixedSize()
                    .foregroundStyle(isNow ? .white : ink)
                    .padding(.horizontal, isNow ? 6 : 0)
                    .padding(.vertical, isNow ? 2.5 : 0)
                    .background(isNow ? Color.brand : .clear)
                    .clipShape(Capsule())

                Spacer(minLength: 3)

                Text(isNow
                     ? "\(course.minutesRemaining(now: entry.date)) min left"
                     : (startsAt.map { ScheduleClass.countdownLabel(to: $0, now: entry.date) } ?? ""))
                    .font(.system(size: 9.5, weight: .bold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            Text(course.code)
                .font(.system(size: 17, weight: .black))
                .tracking(-0.3)
                .foregroundStyle(ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .padding(.top, 8)

            Text(course.title)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(ink)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .padding(.top, 1)

            Spacer(minLength: 4)

            // Time and room share a line rather than taking two: at 170pt square
            // this card has five things to say and room for about four lines, and
            // dropping the room outright would cost real information.
            Text([course.timeRangeLabel, course.displayLocation]
                    .compactMap { $0 }
                    .joined(separator: " · "))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)

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
        // No card here: the widget itself is already a rounded card, so drawing
        // another one inside it reads as a box in a box. The pastel goes on the
        // widget's own background instead (see .containerBackground below) and
        // the content simply fills the space.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func allDoneCard(payload: SchedulePayload?) -> some View {
        let upcoming = payload?.nextClass(now: entry.date)

        return VStack(alignment: .leading, spacing: 0) {
            Text(payload == nil ? "CLASSMATE"
                 : payload?.hasNotStarted == true ? (payload?.termLabel.uppercased() ?? "UPCOMING")
                 : payload?.isTermOver == true ? "TERM OVER" : "ALL DONE")
                .font(.system(size: 8.5, weight: .heavy))
                .tracking(0.85)
                .foregroundStyle(.secondary)

            Text(payload == nil ? "Open ClassMate to set up your schedule"
                 : payload?.hasNotStarted == true
                     ? (payload?.daysUntilStart).map { "Classes start in \($0) day\($0 == 1 ? "" : "s")" } ?? "Classes haven't started"
                 : payload?.isTermOver == true ? "Enjoy the break" : "No more classes today")
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
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Medium — today

/// Rows divide the available height rather than taking a fixed one, so two
/// classes give two tall rows and four give four compact ones — the widget is
/// always full. Taller rows spend the extra space on the title and location;
/// the four-class row drops the location line first, then truncates the title.
struct TodayView: View {
    let entry: ScheduleEntry

    private let timeGutter: CGFloat = 40

    var body: some View {
        let payload = entry.payload
        let today = payload?.classesToday(now: entry.date) ?? []
        let shown = Array(today.prefix(4))

        VStack(alignment: .leading, spacing: 9) {
            header(count: today.count)

            if shown.isEmpty {
                emptyCard(payload: payload)
            } else {
                VStack(spacing: shown.count >= 4 ? 6 : 9) {
                    ForEach(shown) { course in
                        row(course: course, tall: shown.count <= 3)
                    }
                    // One or two classes shouldn't stretch into slabs; cap the
                    // growth and let the leftover sit at the bottom instead.
                    if shown.count <= 2 { Spacer(minLength: 0) }
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
        let palette = CoursePalette(course)
        let isNow = course.startMinutes <= minutesNow && minutesNow < course.endMinutes

        return HStack(spacing: 0) {
            // Left-aligned and narrower than the spec's 52pt: right-aligning it
            // left a visible gap down the left edge and pushed every card
            // rightward, so the widget read as indented rather than full.
            VStack(alignment: .leading, spacing: 0) {
                Text(course.startLabel)
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(course.endLabel)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(width: timeGutter, alignment: .leading)
            .padding(.trailing, 6)
            .fixedSize(horizontal: true, vertical: false)

            // A colour bar rather than a filled card: on a white widget the
            // pastel fills read as stacked boxes, and the bar carries the same
            // course identity with far less weight.
            RoundedRectangle(cornerRadius: 1.5)
                .fill(palette.edge)
                .frame(width: 3)
                .padding(.vertical, 1)

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
            .padding(.leading, 7)
            .padding(.vertical, tall ? 5 : 3)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
        // min-height 0 lets the fixed widget frame govern: content never pushes
        // past 170pt, and rows share whatever is left equally — up to a cap, so
        // a single class doesn't become one enormous row.
        .frame(maxHeight: tall ? 46 : 32)
    }

    private var minutesNow: Int {
        let calendar = Calendar.current
        return calendar.component(.hour, from: entry.date) * 60 + calendar.component(.minute, from: entry.date)
    }

    private func emptyCard(payload: SchedulePayload?) -> some View {
        let upcoming = payload?.nextClass(now: entry.date)

        return VStack(alignment: .leading, spacing: 3) {
            Text(payload == nil ? "Open ClassMate to set up your schedule"
                 : payload?.hasNotStarted == true
                     ? (payload?.daysUntilStart).map { "Classes start in \($0) day\($0 == 1 ? "" : "s")" } ?? "Term hasn't started"
                 : "No classes today")
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
        .background(Color.brand.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 11))
    }
}

// MARK: - Large — the week

/// The app's bordered-card grammar: tinted header row, time gutter, ruled day
/// columns. The plot reads as *mass* rather than a wire grid — two-hour
/// background bands carry the time reference, so no horizontal hairlines are
/// needed inside it. Today gets a solid brand header cell and a tinted column.
struct WeekView: View {
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
        // Before the term starts the grid is still worth showing — planning next
        // quarter is exactly when people look — but it must not claim to be
        // "this week".
        let all = payload?.isTermOver == true ? [] : (payload?.classes ?? [])
        let upcoming = payload?.hasNotStarted == true
        let weekClasses = all
        // No "today" column highlight before the term begins.
        let today = (payload?.hasNotStarted == true) ? -1 : Calendar.current.component(.weekday, from: entry.date) - 1

        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(upcoming ? "UPCOMING" : "THIS WEEK")
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
        let hairline = Color.black.opacity(0.12)
        let band = Color(red: 0.976, green: 0.980, blue: 0.984)            // #f9fafb

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
                        .fill(Color.brand.opacity(0.06))
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
                    let palette = CoursePalette(course)
                    let top = CGFloat(course.startMinutes - plotStartHour * 60) * perMinute
                    // A 50-minute class should look like 50 minutes. The old
                    // floor of 18pt inflated short classes into chunky bricks.
                    let height = max(13, CGFloat(course.endMinutes - course.startMinutes) * perMinute)

                    VStack(alignment: .leading, spacing: 0) {
                        Text(course.code)
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)
                        // The start time only earns its place on a tall block.
                        if height >= 34 {
                            Text(course.startLabel.replacingOccurrences(of: " AM", with: "")
                                                   .replacingOccurrences(of: " PM", with: ""))
                                .font(.system(size: 7, weight: .semibold))
                                .foregroundStyle(palette.ink.opacity(0.7))
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 2.5)
                    .padding(.vertical, 1.5)
                    .frame(width: dayWidth - 3, height: height, alignment: .topLeading)
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
                 : (payload?.daysUntilStart).map { "Classes start in \($0) day\($0 == 1 ? "" : "s")" } ?? "No classes this week.")
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
        // containerBackground opts out of the default content margins, so the
        // inset is ours to supply. It scales with the widget instead of being a
        // fixed number: a small widget is 155pt wide on an SE and 170 on a Pro
        // Max, and the same 14pt that fits one crowds the other.
        GeometryReader { geo in
            let inset = min(max(min(geo.size.width, geo.size.height) * 0.055, 7), 12)
            content
                .padding(.horizontal, inset)
                .padding(.vertical, inset * 0.85)
                .frame(width: geo.size.width, height: geo.size.height)
        }
        .containerBackground(for: .widget) { background }
        // The widget is deliberately light-only — the pastels are built for a
        // white ground. The backgrounds were pinned light but .primary and
        // .secondary still followed the system, so in dark mode every label
        // turned white on white. Pin the scheme, not just the backgrounds.
        .environment(\.colorScheme, .light)
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .systemSmall:  NextClassView(entry: entry)
        case .systemLarge:  WeekView(entry: entry)
        default:            TodayView(entry: entry)
        }
    }

    /// Small washes the whole widget in the course's pastel — that is what
    /// removes the card-inside-a-card. The other sizes keep a white ground so
    /// their own content provides the colour.
    ///
    /// Light only, deliberately: the pastel triples are built for a white
    /// ground, and a second dark palette was more surface area than the widget
    /// warranted.
    private var background: Color {
        guard family == .systemSmall else { return .white }
        return NextClassView.backgroundTint(for: entry) ?? .white
    }
}

struct ClassMateWidget: Widget {
    let kind: String = "ClassMateWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            ClassMateWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Schedule")
        .description("Your next class, today's timetable, or the whole week.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
