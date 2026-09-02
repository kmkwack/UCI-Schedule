//
//  ScheduleData.swift
//  ClassMateWidget
//
//  The contract between the app and the widget.
//
//  Widgets get no network access, so the app writes the term's *recurring
//  weekly pattern* into the shared App Group and the widget derives everything
//  from that. Storing the pattern rather than "today's classes" means the
//  widget stays correct for the whole term even if the user doesn't reopen the
//  app for weeks — the alternative goes stale the moment it is written.
//
//  The JS side that produces this lives in src/lib/widgetSchedule.ts. Any
//  change here has to be made there too.
//

import Foundation

let appGroupIdentifier = "group.com.parksihyun.classmate"
let scheduleStorageKey = "widget_schedule_v1"

/// One class meeting in the weekly pattern.
struct ScheduleClass: Codable, Identifiable {
    let id: String
    let code: String          // "ECON 100A"
    let title: String         // "Intermediate Economics"
    let weekday: Int          // 0 = Sunday, matching Calendar.component(.weekday) - 1
    let startMinutes: Int     // minutes past local midnight
    let endMinutes: Int
    let location: String?
    // The app's pastel triple (background / text / border), sent verbatim so the
    // widget renders the same colours the timetable does. Deriving a tint from a
    // single solid hex here produced neon blocks that fought for attention.
    let bgHex: String?
    let textHex: String?
    let borderHex: String?
}

struct SchedulePayload: Codable {
    let version: Int
    let updatedAt: String     // ISO 8601, for staleness display only
    let school: String        // "UC Irvine"
    let termLabel: String     // "Fall 2026"
    /// End of the term (ISO date, "2026-12-12"). Past this the widget stops
    /// showing classes rather than advertising a schedule that has ended.
    let termEndDate: String?
    let classes: [ScheduleClass]
}

enum ScheduleStore {
    /// Reads the payload the app last wrote. Returns nil when the user hasn't
    /// signed in yet, has no timetable, or the stored data can't be parsed —
    /// every caller must handle that by showing the empty state.
    static func load() -> SchedulePayload? {
        guard
            let defaults = UserDefaults(suiteName: appGroupIdentifier),
            let raw = defaults.string(forKey: scheduleStorageKey),
            let data = raw.data(using: .utf8)
        else { return nil }

        return try? JSONDecoder().decode(SchedulePayload.self, from: data)
    }
}

// MARK: - Deriving what to show

extension SchedulePayload {
    /// True once the term's last day has passed. Dates are compared as plain
    /// calendar days, so a class on the final day still shows all day.
    var isTermOver: Bool {
        guard let termEndDate else { return false }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        guard let end = formatter.date(from: termEndDate) else { return false }
        return Calendar.current.startOfDay(for: Date()) > Calendar.current.startOfDay(for: end)
    }

    func classes(onWeekday weekday: Int) -> [ScheduleClass] {
        guard !isTermOver else { return [] }
        return classes
            .filter { $0.weekday == weekday }
            .sorted { $0.startMinutes < $1.startMinutes }
    }

    func classesToday(now: Date = Date()) -> [ScheduleClass] {
        classes(onWeekday: Calendar.current.component(.weekday, from: now) - 1)
    }

    /// The next class starting from `now`, searching forward up to a week so
    /// Friday afternoon correctly rolls over to Monday morning.
    func nextClass(now: Date = Date()) -> (course: ScheduleClass, date: Date)? {
        guard !isTermOver else { return nil }

        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let minutesNow = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)

        for dayOffset in 0...7 {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: startOfToday) else { continue }
            let weekday = calendar.component(.weekday, from: day) - 1

            for course in classes(onWeekday: weekday) {
                // A class already under way is not "next" — skip to the one after.
                if dayOffset == 0 && course.endMinutes <= minutesNow { continue }
                if dayOffset == 0 && course.startMinutes <= minutesNow { continue }

                if let date = calendar.date(byAdding: .minute, value: course.startMinutes, to: day) {
                    return (course, date)
                }
            }
        }
        return nil
    }

    /// The class happening right now, if any.
    func currentClass(now: Date = Date()) -> ScheduleClass? {
        let calendar = Calendar.current
        let minutesNow = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)
        return classesToday(now: now).first { $0.startMinutes <= minutesNow && minutesNow < $0.endMinutes }
    }
}

// MARK: - Formatting

extension ScheduleClass {
    static func formatMinutes(_ minutes: Int) -> String {
        let hour24 = (minutes / 60) % 24
        let minute = minutes % 60
        let hour12 = hour24 % 12 == 0 ? 12 : hour24 % 12
        let suffix = hour24 < 12 ? "AM" : "PM"
        return minute == 0
            ? "\(hour12) \(suffix)"
            : String(format: "%d:%02d %@", hour12, minute, suffix)
    }

    var startLabel: String { Self.formatMinutes(startMinutes) }
    var endLabel: String { Self.formatMinutes(endMinutes) }
    var timeRangeLabel: String { "\(startLabel) – \(endLabel)" }
}
