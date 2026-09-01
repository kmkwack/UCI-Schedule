//
//  ClassMateWidgetBundle.swift
//  ClassMateWidget
//

import WidgetKit
import SwiftUI

@main
struct ClassMateWidgetBundle: WidgetBundle {
    var body: some Widget {
        // ClassMateWidgetControl (the Xcode template's Control Center widget)
        // is deliberately not registered — there is no ClassMate action worth
        // putting in Control Center, and shipping an empty one would just add
        // clutter to the widget gallery. The file is left in place rather than
        // deleted so the Xcode project reference stays valid.
        ClassMateWidget()
    }
}
