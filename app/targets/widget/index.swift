// 팔자 위젯(WidgetKit) — '오늘의 운세' 홈스크린 위젯.
// 앱이 App Group(group.com.syncfortune.app) UserDefaults 에 today_headline/today_line 을 쓰면 위젯이 읽어 표시.
// 데이터 없으면 안내 문구 폴백. 매일 자정 이후 타임라인 갱신.
import WidgetKit
import SwiftUI
import UIKit

private let APP_GROUP = "group.com.syncfortune.app"

struct FortuneEntry: TimelineEntry {
  let date: Date
  let headline: String
  let line: String
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> FortuneEntry {
    FortuneEntry(date: Date(), headline: "오늘의 운세", line: "팔자에서 확인하세요")
  }
  func getSnapshot(in context: Context, completion: @escaping (FortuneEntry) -> ()) {
    completion(readEntry())
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<FortuneEntry>) -> ()) {
    // 다음 자정 직후 갱신(하루 1회 새 운세).
    let cal = Calendar.current
    let next = cal.nextDate(after: Date(), matching: DateComponents(hour: 0, minute: 5),
                            matchingPolicy: .nextTime) ?? Date().addingTimeInterval(6 * 3600)
    completion(Timeline(entries: [readEntry()], policy: .after(next)))
  }
  private func readEntry() -> FortuneEntry {
    let ud = UserDefaults(suiteName: APP_GROUP)
    let headline = ud?.string(forKey: "today_headline") ?? "오늘의 운세"
    let line = ud?.string(forKey: "today_line") ?? "팔자 앱에서 오늘의 운세를 확인하세요"
    return FortuneEntry(date: Date(), headline: headline, line: line)
  }
}

struct PaljaWidgetEntryView: View {
  var entry: Provider.Entry
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("오늘의 운세")
        .font(.caption2).fontWeight(.semibold)
        .foregroundColor(.orange)
      Text(entry.headline)
        .font(.headline).bold()
        .lineLimit(2).minimumScaleFactor(0.8)
      Text(entry.line)
        .font(.caption)
        .foregroundColor(.secondary)
        .lineLimit(3)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetBackground()
  }
}

// iOS 17 containerBackground 필수 / iOS 16 이하 폴백.
extension View {
  @ViewBuilder func widgetBackground() -> some View {
    if #available(iOS 17.0, *) {
      self.padding(14).containerBackground(for: .widget) { Color(.systemBackground) }
    } else {
      self.padding(14).background(Color(.systemBackground))
    }
  }
}

@main
struct PaljaWidget: Widget {
  let kind: String = "PaljaWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      PaljaWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("오늘의 운세")
    .description("매일의 운세를 홈 화면에서 한눈에")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
