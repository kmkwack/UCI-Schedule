//
//  WidgetBridge.m
//  ClassMate
//
//  Exposes WidgetBridge.swift to React Native. React Native's module registry
//  is Objective-C, so a Swift module needs this macro block to be visible from
//  JS — the Swift file alone is not enough.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (WidgetBridge, NSObject)

RCT_EXTERN_METHOD(setSchedule:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearSchedule:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
