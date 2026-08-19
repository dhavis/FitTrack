# Device matrix

Execute every **web** row. Execute Android/iOS rows only when a runtime exists (see SKILL.md).

| ID | Surface | Width | Height | Orientation | Notes |
| --- | --- | --- | --- | --- | --- |
| W-PHONE | Web | 390 | 844 | portrait | iPhone 14-class; six-tab squeeze |
| W-PHONE-LAND | Web | 844 | 390 | landscape | Web ignores `orientation: portrait`; must still work |
| W-ANDROID | Web | 412 | 915 | portrait | Pixel-class |
| W-TABLET | Web | 768 | 1024 | portrait | iPad-class; `supportsTablet` |
| W-TABLET-LAND | Web | 1024 | 768 | landscape | Tablet landscape |
| W-DESKTOP | Web | 1280 | 800 | landscape | Cursor browser default-ish |
| N-ANDROID | Android emulator/device | device | device | portrait, then attempt landscape | Expo against this repo's port |
| N-IOS | iOS Simulator or Expo Go | device | device | portrait; landscape should stay locked | Blocked on Windows without a phone |

## Extra checks (once per surface, not every width)

- Tab bar: all six destinations (Dashboard, Weight, Workouts, Nutrition, Goals, Settings)
- Weight `LineChart` after a resize
- Modal: Exercise picker / How-to does not overflow the viewport
- Long forms (Goals, Nutrition preferences, Nutrition plan) scroll to the save button
- Stack headers (Routine, Active Workout, Add food) remain tappable for Back
