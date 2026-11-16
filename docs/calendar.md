# 赛程日历

日历继续使用 FullCalendar Standard React 7.1.4。只加载 dayGrid、timeGrid、Monarch 主题及中文 locale，不使用 Premium/Scheduler，不需要商业许可密钥。

## 查看与筛选

- 月视图、日视图及从所选日期开始的7天列表共享同一份已保存官方赛程。点“今天”回到 Toronto 当天；列表左右按钮每次翻7天。
- 可看我的全部选手和朋友、仅我的选手、某位主页选手或仅本场关注朋友。筛选及日期写入 URL，刷新／前进／后退可恢复；不改变主页偏好或私人关系。
- 日视图继续按比赛当地时区显示官方组别时段，支持冰面筛选、当前时间线。下一未结束组在当前视图和筛选范围内查找，优先包含正在进行的组；待定安排不参与。
- 卡片复用 SessionTiming，官方个人时间优先。小时间格使用简短的“预计”标签，列表与展开详情保留完整说明。热身／开滑仍为估算，缺少可靠来源时不生成。
- 日视图每15分钟网格至少60px，为窄屏并排卡片的英文换行及两个预计时间留出高度；统一缩放时间轴，卡片起止位置与官方组别时长仍成比例。

## 单次 .ics 导出

导出当前月份／当天（含冰面筛选）／所选7天内、符合选手筛选的已确认官方组别时段。未确定日期／时段、DST重叠或缺口中的模糊时间均排除；不把预计个人时间或私人教练备注写入文件，不附带闹钟。

文件采用 RFC 5545：UTC 起止时间、稳定事件 UID、CRLF、文本转义及按 UTF-8 75 字节折行。浏览器下载使用 text/calendar；Capacitor 复用缓存文件＋系统分享通道。它是一次性副本，不是订阅，后续官网修订不会自动更新；实际 Apple/Google 日历导入和手机系统分享仍需真机验收。

## 可更新的个人订阅

日历底部“订阅我的选手日历”可创建个人网址，添加到日历应用的“订阅／通过网址添加”。订阅范围始终是服务端当前My Skaters，不包含浏览器临时关注的朋友。每次读取重新检查账号状态、认证版本及邮箱条件；停用、撤销全部会话、替换网址或撤销订阅会使旧网址失效。

网址使用32字节随机令牌，D1 `hsc_calendar_subscriptions` 只存SHA-256哈希。原始网址只在创建／更换当次显示，普通读取不能找回；持有网址即可读取这份官方日程，因此应妥善保存。撤销无法远程删除第三方日历已缓存的事件。

订阅沿用确定官方组别时段过滤，不含私人备注、教练安排、估算或闹钟。UID由赛事、选手、练习／比赛和既有类别时段身份组成，正常时间修订不新增重复事件。日历应用自行决定刷新频率，网站不能保证即时更新；出发前仍应核对HSC。原一次性导出保留。

管理接口为已登录同源 `GET/POST /api/calendar/subscription`，订阅读取为令牌授权的 `GET /api/calendar/feed?token=…`。它不建立应用会话，也不授予其他API权限。新迁移和验收说明见 [planning.md](planning.md)。

## MIT 声明随构建分发

`scripts/fullcalendar-notice.ts` 为 Web 和 Capacitor 共用的 Vite 插件，从当前安装版本读取 FullCalendar React/Core、headless-calendar 和 temporal-polyfill 的完整 MIT 许可，生成 `third-party/fullcalendar.txt`，包含包名、版本及上游版权。许可改变或文件缺失会阻止构建，防止静默遗漏。

日历末尾的“日历开源许可声明”在页面内展开读取该文件，原生包无需跳出本地应用。Android/iOS 静态资源同步也携带原文；这不等于重新生成了 APK/IPA。

## 验证入口

```text
node scripts/check-family-calendar.mjs
node scripts/check-family-calendar-browser.mjs
node scripts/check-calendar-notice.mjs dist/client capacitor/dist capacitor/android/app/src/main/assets/public capacitor/ios/App/App/public
```

浏览器脚本复用 `work/browser-qa` 的 Chromium/WebKit，使用隔离 API 和固定时钟，覆盖三款手机、中英文及横竖屏，另加320px中英文竖屏，共14组。逐项验证预计热身／开滑标签与时间值，并检查卡片内每段文字的实际渲染边界，防止文字存在于DOM却被裁切。CI 在生产构建后核对许可原文，并通过既有日历浏览器任务验证新交互。

参考：[FullCalendar 授权](https://fullcalendar.io/license)、[RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html)。
