# 官网报名 PDF 与多日期赛程导入

## 本轮根因与实现

2026-10-23 核对 Skate Ontario 原始文件后发现：Adult Event 2 与 Keswick 的 Entry Lists 链接是分类 PDF 目录，不是原先支持的 DSTools HTML 表格；Keswick 同一页同时排了周五、周六两个日期区及两个冰场，原先整页取一个日期会漏读或错配。

- `lib/entry-pdf.ts`：按官方 Category、Name、Club、Section 表头与页面坐标读取报名行，校验 Number Entries 总人数。名单姓名仅做唯一完整姓名的候选关联，待确认身份和重名不关联，不授予私人权限。
- `lib/entry-import.ts`：保留 HTML 支持，增加直接 PDF 及同源 PDF 目录。目录最多 160 个文件，每场每轮最多处理四份，按最近尝试时间轮转。文件 hash、解析器版本和候选名单 hash 共同决定是否重读；单文件失败或目录移除链接保留上次记录并警告。
- `lib/official-parser.ts`：按页面纵向日期区和横向冰场分别读取完整 START/END 行。未明确日期、冰场、完整时间或类别时跳过并提示，不推算。U12/O12、Class、Short/Free 的明确差异不能串配；年龄缺失的候选时段标待确认。
- `lib/official-sync.ts`：`entry-pdf-1`、`entry-index-1`、`schedule-bands-2` 是格式版本。升级解析器时即使文件 hash 未变也重新解析，修复旧解析结果。全文件读取/解析失败保留原有效资料；可部分解析的赛程仅采用本轮明确识别行并显示部分导入，不冒称全表成功。
- `app/entry-import-status.tsx`：网页比赛详情显示已核对/总数及逐文件官方链接、等待和错误。接口同步状态也返回进度与赛程状态。
- `lib/change-notifications.ts`：已成功校验的目录子 PDF 也写入原 `source_revisions`；沿用原事件/变更/outbox 原子事务和去重。教练文字、集合时间、私人备注与会员关系不在导入写入范围内。没有数据库迁移。

## 已验证范围与限制

- Keswick 实际赛程样本：明确支持的 40 条组别/练习时段，2026-11-20 有 20 条、11-21 有 16 条、11-22 有 4 条。不是 40 名选手，也不是整张 PDF 的全部类别；Artistic、特殊奥运等未支持类别与不完整时间仍待核对。
- Adult 实际赛程缺少本解析器要求的 RINK 表头，续页又缺少日期/START，仍待人工核对，不能填造冰场、个人时间、出场顺序或 Warm-up Group。
- 报名目录检查时 Adult 有 67 份、Keswick 有 58 份 PDF，数量会随官网修订。每场每轮四份，首次执行不等于全量完成；既有每小时同步继续轮转，不新增自动任务。格式失败的文件会重试但不永久挡住其他文件。
- 支持有文字层、标准分列、表头和人数可核对的报名 PDF。扫描件、无法可靠对齐的换行姓名、缺少人数或不同类别混排等，宁可失败保留旧资料。不使用 OCR 猜测。
- 沿用官方域名 allowlist、HTTPS、20 秒请求超时、重定向检查、单文件 8 MB、PDF 20 页上限。仍非 Skate Canada 同步，亦不保证实时。

## 可复现验收

2026-10-29 赛程匹配修复：普通组与 Non-Qualifying/NQ 必须分开匹配，Artistic 报名不能匹配省略 Free 字样的普通滑行时段。官网明确用完整类别加 `/` 表示共用时段时，两类报名仍可使用该时段；`U12/O12 Non Qualifying` 只是共享年龄范围，NQ 限定仍作用于两种年龄。Starting Order 同样检查资格、年龄与项目，不能借用其他类别的出场信息。历史成绩图表的类别归并规则没有修改。

运行 `node scripts/check-category-matching.mjs`：7 组类别隔离、共用时段、Artistic、出场信息与官方快照回归。`tests/fixtures/keswick-2026-category-matching.json` 来自 2026-10-29 对官网当前 61 份报名 PDF 和 Oct 28 赛程的只读解析，保留当前历史候选名单匹配的报名与可解析时段，仅作离线回归，不用于覆盖生产资料。公开报名目录为 `https://skateontario.org/results/27KES/`，赛程为 `https://skateontario.org/wp-content/uploads/2026/07/Keswick-schedule-OCT-28-1.pdf`。

运行 `node scripts/check-official-import.mjs`：11 项真实 PDF / 目录状态回归，覆盖人数不符、扫描/错行拒绝、日期分区、双冰场、年龄差异、四份批次、失败保留、同链接修订、候选名单变化与移除链接。

运行 `node scripts/check-members.mjs`：隔离内存 D1 中验证原权限/登录/提醒以及 PDF 批次持久化、嵌套来源修订、解析器升级、失败保留和重复同步无额外变更/outbox。测试 fetch 使用捕获适配器，不连接生产数据库、不发真实邮件。其余原官网、Starting Order、客户端、语言及类型检查也须重跑。

## 公开样本来源

以下文件于 2026-10-23 从官方链接原样下载，保存于 `tests/fixtures/`，仅作解析回归；不是用户私人联系人或教练备注。生产始终重新读取官网，不能用测试样本覆盖生产资料。

| 本地文件 | 官方 URL | SHA-256 |
| --- | --- | --- |
| adult-2026-masters-entry.pdf | https://skateontario.org/results/26PSAdults/PSADULTMastersMenFreeYAEL.pdf | 61a5096339c8bca59e200a21a4421356339bac40ee61862a0f36211fb99752c3 |
| adult-2026-gold-entry.pdf | https://skateontario.org/results/26PSAdults/PSADULTGoldWomenFreeYAEL.pdf | 221960358baad5aae29c0f2b13084510fdd51b42f30c77deca8fd525faef8972 |
| keswick-2026-gold-entry.pdf | https://skateontario.org/results/27KES/27KesGoldMenEL.pdf | 7b49b7b255a929ac2121097cdca5fe5d9f41a1534fbd6ad59e815a7472c1fdc8 |
| keswick-2026-schedule.pdf | https://skateontario.org/wp-content/uploads/2026/07/Keswick-schedule-for-posting-1.pdf | 33cfbe40cac5590865c6efd6e0bc9419fca204e8b20ec5029161d76fc47f8ccd |
| adult-2026-schedule.pdf | https://skateontario.org/wp-content/uploads/2026/07/Schedule-6.pdf | 095b744df2ef481599d5fcb0876e39e7d4677cc9cecadb7b6359f46d26831637 |

赛事入口：
- Adult：https://skateontario.org/event/provincial-series-2-adult-event-2/
- Keswick：https://skateontario.org/event/provincial-series-3-keswick-k-i-s/

继续使用原私人 Sites 项目与 D1，保留 `mobile/capacitor`；没有开放站点访问范围、启用付费/邮件、创建新云资源或升级依赖。
