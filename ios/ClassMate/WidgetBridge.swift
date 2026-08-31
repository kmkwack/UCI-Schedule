//
//  WidgetBridge.swift
//  ClassMate
//
//  Hands the schedule to the home-screen widget.
//
//  Widgets can't reach the network, so the app writes the term's weekly
//  pattern into the shared App Group and the widget reads it from there.
//  Everything here is best-effort: a failure to update the widget must never
//  surface to the user or interrupt what they were doing.
//
//  The payload shape is defined in ios/ClassMateWidget/ScheduleData.swift and
//  produced by src/lib/widgetSchedule.ts.
//

import Foundation
import WidgetKit

@objc(WidgetBridge)
class WidgetBridge: NSObject {

  private static let appGroupIdentifier = "group.com.parksihyun.classmate"
  private static let scheduleStorageKey = "widget_schedule_v1"

  /// Not on the main queue: this only touches UserDefaults and WidgetCenter.
  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Stores the JSON the JS side built and asks WidgetKit to redraw.
  ///
  /// The JSON is passed through as a string rather than a dictionary so the
  /// structure is defined in exactly one place (TypeScript) and decoded in
  /// exactly one place (Swift), instead of being reassembled at the bridge.
  @objc(setSchedule:resolver:rejecter:)
  func setSchedule(
    _ json: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: Self.appGroupIdentifier) else {
      // The App Group is missing from the entitlements. Report it rather than
      // failing silently — this is a build configuration error, not a runtime
      // condition, and it would otherwise look like "the widget never updates".
      reject("app_group_unavailable", "App Group \(Self.appGroupIdentifier) is not available", nil)
      return
    }

    defaults.set(json, forKey: Self.scheduleStorageKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  /// Clears the widget on sign-out, so the next person to pick up the device
  /// doesn't see the previous account's classes on the home screen.
  @objc(clearSchedule:rejecter:)
  func clearSchedule(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: Self.appGroupIdentifier) else {
      reject("app_group_unavailable", "App Group \(Self.appGroupIdentifier) is not available", nil)
      return
    }

    defaults.removeObject(forKey: Self.scheduleStorageKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }
}
