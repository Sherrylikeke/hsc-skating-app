# 我的选手：首页赛事与报名

2026-11-11：在 `4b770f5` 的 V42 基线上增加本轮功能。

- 会员首页、俱乐部概览和默认个人赛程共用 `app/home-events.tsx`。移除概览的选手／教练／历史总数模块；已在官方或 Interim 名单匹配 My Skaters 的未来赛事，即使没有赛程，也展示日期、地点、相关选手和详情入口。没有时间时不生成个人时间。
- 名单链接识别包括 Interim List / Interim Entry Lists。保留既有最终 HTML/PDF 导入；同时存在时优先最终名单。新支持两种已核验的 Interim PDF：Niagara 的居中类别＋三列姓名/俱乐部，以及 Bowmanville 的类别＋名字/姓氏/俱乐部四列。跨页沿用明确类别，每行检查列位置；异常保留上次有效版本。完整姓名、重复姓名和 identityPending 规则保持不变，匹配不授予私人关系。
- 报名日期从日历描述、赛事网页和最多两份同源 Announcement PDF 读取。网页日期优先，PDF 补缺；区分 assigned / public，排除音乐截止日，没有明确年份／有效日期不猜测。官方事件专属 SkateReg/Uplifter 链接优先，无专属链接时使用官网当前指向的 `https://uplifterfigureskating.com/`。不自动报名或提交支付。
- 首页为尚未列入该赛事名单的My Skaters按近一年各项目最新类别匹配，从最早Assigned/Public阶段开放前7个Toronto日历日显示提醒，直到Public截止。卡片分别列出Assigned与Public的开放/关闭日期和具体时间（ET），缺少时分明确提示未公布，不能猜测；已知关闭时分按America/Toronto计算，Public关闭后不被Assigned延长。Assigned资格由官方分配/邀请决定，首页类别匹配不等于已获分配。缺少Public截止不回退比赛日；已在Interim/正式名单者保留赛事但不重复提示报名，家庭内其他未报名选手仍可匹配。
- 首页及比赛中心均按比赛开始日期由近到远排序，不按报名开放日期排序。已报名赛事在类别和分组可确认时直接显示官方日期、组别起止时间、冰场及来源；无法确定组别时仍标待确认，不把候选时段当作确定时间。完整名单与赛程可从赛事详情继续查看。
- 详细同步每轮最多三场，最近两场优先，第三场优先核对即将报名/仍开放且类别或时分不完整的赛事，再按上次检查时间轮换。当天已尝试者冷却，避免失败来源独占名额；范围183天，原每小时任务继续使用。网页更新优先，Announcement只在相同日期端点补缺少时间，不能用旧PDF覆盖新网页关闭日或开放时间；未知格式及超出20页的PDF继续待核对。
- Entry List 详情顶部移除逐份 Starting Order 链接；下面官方顺序表继续按参赛者／类别显示来源。首页和比赛详情提供明确的 Skate Ontario event details 外链。
- Capacitor 入口补载已有的手机布局样式，修复实际 WebKit 320px 头部溢出。静态客户端需重打包，网站刷新后读取新资源。

验证：`npm test` 包含 `scripts/check-home-events.mjs`，覆盖日期边界、类别、账号偏好、无赛程名单、同名和异常列位置。两份真实官方 Interim PDF 样本为 `tests/fixtures/niagara-2026-interim-entry.pdf`（547条）及 `bowmanville-2026-interim-entry.pdf`（372条）；来源分别为 Skate Ontario 的 `/wp-content/uploads/2026/08/interim-entry-lists.pdf` 和 `/wp-content/uploads/2026/08/Interim-Entry-list-Bowmanville.pdf`，读取日期2026-11-11。

浏览器：`scripts/check-home-events-browser.mjs` 使用隔离API样本，Chrome/WebKit、320/390/1280px、中英文、会员首页/概览/个人赛程共36个视图；检查公开报名关闭／截止缺失时隐藏、已报名不重复提醒、赛程显示、组别不确定提示、按比赛日期排序、报名及官方链接、名单详情导航与页面溢出。不能将样本验收视为真实用户登录或真机安装。生产构建、Worker、部署与安装包最终结果记入 `docs/project-note.md`。
