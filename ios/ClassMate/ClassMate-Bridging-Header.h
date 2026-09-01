//
// Use this file to import your target's public headers that you would like to expose to Swift.
//

// React Native's promise block typedefs (RCTPromiseResolveBlock /
// RCTPromiseRejectBlock) live in Objective-C headers. Swift native modules —
// WidgetBridge.swift — can't see them without this import.
#import <React/RCTBridgeModule.h>
