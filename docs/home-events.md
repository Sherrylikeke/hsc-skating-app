# 我的选手：首页赛事与报名

2026-11-11：在 `4b770f5` 的 V42 基线上增加本轮功能。

- 会员首页、俱乐部概览和默认个人赛程共用 `app/home-events.tsx`。移除概览的选手／教练／历史总数模块；已在官方或 Interim 名单匹配 My Skaters 的未来赛事，即使没有赛程，也展示日期、地点、相关选手和详情入口。没有时间时不生成个人时间。
- 名单链接识别包括 Interim List / Interim Entry Lists。保留既有最终 HTML/PDF 导入；同时存在时优先最终名单。新支持两种已核验的 Interim PDF：Niagara 的居中类别＋三列姓名/俱乐部，以及 Bowmanville 的类别＋名字/姓氏/俱乐部四列。跨页沿用明确类别，每行检查列位置；异常保留上次有效版本。完整姓名、重复姓名和 identityPending 规则保持不变，匹配不授予私人关系。
- 报名日期从日历描述、赛事网页和最多两份同源 Announcement PDF 读取。网页日期优先，PDF 补缺；区分 assigned / public，排除音乐截止日，没有明确年份／有效日期不猜测。官方事件专属 SkateReg/Uplifter 链接优先，无专属链接时使用官网当前指向的 `https://uplifterfigureskating.com/`。不自动报名或提交支付。
- 每个报名阶段在开放日期前14个 Toronto 日历日开始展示，截止日当天仍展示，次日隐藏。只有 My Skaters 与公告开放类别匹配时展示；有未来官方名单时优先用该选手的近期类别，否则回退档案类别。报名卡表示类别相关信息，assigned 阶段仍须官方邀请，不把历史类别匹配当作最终参赛资格。
- 详细同步仍每轮最多三场，最近两场优先，第三场在183天日历范围按上次读取时间轮换，使一月赛事提前开放的报名不被原45天限制遗漏。原每小时自动任务继续使用，不创建新任务。未知格式及长于已验证20页范围的PDF继续待核对，不声称所有赛事均已完整解析。
- Entry List 详情顶部移除逐份 Starting Order 链接；下面官方顺序表继续按参赛者／类别显示来源。首页和比赛详情提供明确的 Skate Ontario event details 外链。
- Capacitor 入口补载已有的手机布局样式，修复实际 WebKit 320px 头部溢出。静态客户端需重打包，网站刷新后读取新资源。

验证：`npm test` 包含 `scripts/check-home-events.mjs`，覆盖日期边界、类别、账号偏好、无赛程名单、同名和异常列位置。两份真实官方 Interim PDF 样本为 `tests/fixtures/niagara-2026-interim-entry.pdf`（547条）及 `bowmanville-2026-interim-entry.pdf`（372条）；来源分别为 Skate Ontario 的 `/wp-content/uploads/2026/08/interim-entry-lists.pdf` 和 `/wp-content/uploads/2026/08/Interim-Entry-list-Bowmanville.pdf`，读取日期2026-11-11。

浏览器：`scripts/check-home-events-browser.mjs` 使用隔离API样本，Chrome/WebKit、320/390/1280px、中英文、会员首页/概览/个人赛程共36个视图；检查报名及官方链接、名单详情导航、截止后隐藏与页面溢出。不能将样本验收视为真实用户登录或真机安装。生产构建、Worker、部署与安装包最终结果记入 `docs/project-note.md`。
