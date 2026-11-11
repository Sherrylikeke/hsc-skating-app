# HSC 项目约定

## 开始工作

- 本文件适用于整个仓库。先核对 Git、源码、当前部署及本轮用户要求，按需读取交接；不要导入旧会话完整历史。
- 使用中文简洁沟通，直接完成已授权的实施与验证。讨论、估算或询价本身不等于授权重构、迁移、购买或公开。
- README 含早期阶段描述，不能据此断言当前尚无账号权限或偏好仅存本机；以实际源码、部署和本轮要求为准。
- 项目长期 Note 为 `docs/project-note.md`。后续每次完成实质修改、验收或部署时更新其已完成、待办、线上状态和验证日期；实时 Worker/同步状态必须重新查询后再写，不沿用旧快照冒充当前。不为更新 Note 新建定时任务，不记录密钥或原始私人日志。

## 架构与位置

- Web：TypeScript、React、Next 路由体系、Vinext/Vite、Tailwind。页面在 `app/`，业务逻辑在 `lib/`。
- 后端：由 Sites 管理部署的 Cloudflare Worker；`app/api/`、`app/mcp/route.ts` 为服务端入口。
- 数据库：Cloudflare D1，采用 SQLite SQL 语义；Drizzle schema 在 `db/schema.ts`，增量迁移在 `drizzle/`。
- `.openai/hosting.json` 的 D1 绑定为 `DB`，R2 未启用。构建配置中的全零 database_id 是本地占位值，不是生产数据库标识。
- 手机端：`capacitor/` 为本地静态打包的 Capacitor 8 客户端，复用 Web 组件；`mobile/` 原 Expo 工程保留对照。原生端令牌存系统安全存储，Worker/D1 不打入手机；配置见 `docs/capacitor.md`。
- 原私人站点：https://hsc-coach-roster.sherrylikeke.chatgpt.site/
- 自定义域名：`hamiltonskatingclub.memberportal.dev`，用户于 2026-11-03 购买父域并授权绑定；Sites 已于 2026-11-03 接通，域名／SSL active，新网址 HTTPS 200；后续状态以原生工具重新读取为准。应用密码登录仅允许该确切 HTTPS origin 与既有域名／开发入口，不使用任意 Host 放宽校验。
- Sites project：`appgprj_6ad76ca2dba481919ba883865cbd5a0d`。复用既有项目、数据库和访问范围，不新建替代站点或云账号。
- 原私人 GitHub：`https://github.com/Sherrylikeke/hsc-skating-app.git`，remote 为 `github`。Sites 源仓库与 GitHub 是两个远端，不要混称。
- 当前由 Sites 管理托管；不能断言已迁入用户个人 Cloudflare 账号，也不能从公开价推断用户实际账单或数据库固定地域。

## 数据与权限

- 保留原 108 位选手候选名单、用户填写的教练文本、历史资料、官方来源、集合时间及私人备注，不用静态种子覆盖云端数据。
- 原教练拼写 `Jen Jackson/Bryce Davidson` 按用户原文保留。Breken 的训练俱乐部与比赛代表俱乐部分开记录。
- Nathaniel 全名待确认时，不凭名字自动关联公开比赛记录。
- 名单内姓名仅是候选匹配。会员实际角色、私人关系、教练与管理员权限均由服务端已批准记录决定。
- 所有可访问赛程的账号可查看全队共享官方赛程；私人备注、消息、要求、回执、通知与写权限继续按角色和批准关系隔离。
- 一个账号可自行添加多个名单内选手到主页。偏好保存在 `hsc_home_skaters`，按 member_id 隔离；主页偏好不能用于私人授权。
- 登录默认查看“我的全部”，支持单人和全队；浏览他人不改变自己的主页选手，提供清晰返回入口。
- 从主页移除选手仅改变偏好，不自动解除管理员批准的私人关系。禁止不同账号串用本机选手偏好。
- 用户于2026-11-10新增授权：家长主页最多4位选手，可直接更换；已批准亲子关系且仍在本人列表的孩子，家长可从教练下拉列表修改教练标签，不能编辑其他孩子或全局姓名。管理员代选列表也执行四人上限。
- 教练注册可选择本人教练姓名，无需选手关联即可读取全队官方赛程；按姓名标签匹配的选手优先，支持隐藏其他选手和勾选其他教练。教练可用下拉框给任意选手添加自己的姓名，须保留已有教练；这只更新共享赛程标签，不授予私人关系、通知或教练安排写权限。私有权限继续由已批准角色/关系决定。
- 家长多孩子、多教练关系、解绑撤权、停用与会话撤销须继续由服务端即时执行；不能通过前端参数升级权限。

## 登录与邮件

- 保留 Better Auth、自有邮箱/用户名与密码登录，以及原所有者的管理员恢复路径；不自创密码算法。
- 公开自助注册要求名单内姓名及邮箱验证。真实邮件服务未配置时暂停普通新注册，现有登录继续可用；不得伪标记已验证或锁死原管理员。用户于 2026-10-29 明确要求切换公开登录入口，指定 4 位测试者通过各自专属邀请链接自行注册，免 ChatGPT/Sites 登录及 HSC 邮箱验证。仅允许 `HSC_PILOT_REGISTRATIONS` 中绑定邮箱、角色和有效期的邀请；运行配置只存令牌哈希，成功注册后标记已使用。保持 `email_verified=false`、仅共享官方赛程，不自动授予私人关系/教练写权限；不得扩大为任意邮箱免验证注册。公开的是登录/受邀注册页，会员数据与写入 API 仍受应用认证授权保护。
- 已有一小时验证链接、待验证/重发/过期界面与服务端 Resend API 适配。配置说明见 `docs/email-verification.md`。
- 运行时配置键：`RESEND_API_KEY`、`HSC_EMAIL_FROM`、`HSC_EMAIL_VERIFICATION_ENABLED`。密钥只通过安全配置入口，不进入聊天、源码、Git 或交接。
- 邮箱验证和姓名、偏好选择都不自动授予私人角色或选手关系。
- 注册邮件服务、订阅付费、购买域名与发送真实邮件由用户操作或另行明确授权。开发验收使用隔离数据库与捕获式邮件适配器。

## 赛程与同步

- 保留现有官网每小时同步任务 `Automation_a2b3ae8946b48191937bd484365e1ec2`，不要重复创建。
- 已删除的会话续做 heartbeat `hsc` 不得恢复、复制或另建周期检查；正常完成交付即可。
- Skate Ontario 同步读取未来约 183 天日历，详细检查未来 45 天每轮最多三场：最近两场优先，第三场按上次检查时间轮换，避免 STAR 1–4 等较远赛事长期遗漏；同链接修订以哈希识别，失败保留最后有效资料。
- 未支持的 PDF/扫描件和失败来源须标待核对，不承诺实时或全量成功。Skate Canada 自动同步尚未实施。
- 普通用户页面不显示 PDF 文件名、批次进度和原始解析错误；保留简短不确定提示及官方来源链接。详细诊断仅有效管理员在页面末尾默认收起的 Reference 查看，回归 `node scripts/check-source-reference.mjs`。
- Carson 的 SHORT/FREE 是两项；序号区间为候选时段，不能显示成四项。没有对应官方 Starting Order 时显示待定。
- 官方动态 Starting Order 支持赛事页链接的 skatingresults.ca 同源公开接口，只读取关联类别；比赛赛程选择排除 Awards Schedule。已公布序号可匹配官方编号区间，教练综合表直接显示序号／热身组链接；自由滑顺序缺失时不可沿用短节目序号。
- 个人时间、出场顺序与 Warm-up Group 只取官方明确资料，不由名单顺序或人数推算。
- 到场至少提前 60 分钟；未确认时段不生成确定提醒。官网修订、消息与提醒保留持久 outbox、去重、版本和重试机制。

## 修改、验证与发布

- 用户于 2026-10-23 要求主线先提交、手机端改用分支：已建立 `mobile/capacitor`，后续手机原生工作在该分支；当前 `main` 优先完成网页功能和私人上线。既有手机基线保留，不为分支隔离删除共享安全适配或重写历史。
- 只做本轮范围内的修改。schema 更改只追加迁移，不改已应用迁移，不重建生产数据库；保护备份与历史资料。
- Web 类型：`node node_modules/typescript/bin/tsc --noEmit`。
- 手机类型：`node mobile/node_modules/typescript/bin/tsc --noEmit --project mobile/tsconfig.json`。
- Capacitor：在 `capacitor/` 运行 `npm.cmd run build`、`node scripts/check.mjs`、`node node_modules/@capacitor/cli/bin/capacitor sync`；Android/iOS 原生编译与真机结果另外记录，不以 sync 冒充。
- Android 便携构建：`capacitor/scripts/build-android.ps1 -ToolchainRoot <工具目录> -OutputDirectory <交付目录>`；用户已于 2026-10-22 批准精简工具下载及 SDK 许可。只使用 `ANDROID_USER_HOME`，避免与旧目录变量冲突，不将 SDK、缓存和调试密钥提交 Git。配置见 `docs/android-build.md`。
- 手机网页布局用 `scripts/check-mobile-layout.mjs` 进行 Chromium／WebKit 手机浏览器模拟，复用忽略目录 `work/browser-qa` 的 Playwright 1.64.1 与 WebKit 缓存；说明见 `docs/mobile-web-install.md`。隔离 API 测试数据不能冒称生产账号登录或真机验收；当前可做实际浏览器渲染，不再仅以静态 CSS 检查替代手机复核。
- 核心回归：`node scripts/check-members.mjs`；语言：`node scripts/check-locales.mjs`。
- 相关解析/编辑回归：`check-paste.mjs`、`check-athlete-history.mjs`、`check-official-source.mjs`、`check-starting-order.mjs`，均位于 `scripts/`。
- 报名 PDF / 多日期赛程回归：`node scripts/check-official-import.mjs`；真实样本来源、人数校验、分批轮转和格式边界见 `docs/official-import-formats.md`。目录每轮最多四份，未完成不能报全量成功；同步后保留嵌套 PDF 来源修订。
- 网页官网同步客户端：`node scripts/check-official-sync-client.mjs`；逐场 HTTP/网络/解析失败必须展示部分失败，不得报全量成功。普通会员只重新读取存档，手动官网检查仍限管理员。
- 网页会员入口：`node scripts/check-member-client.mjs`；仅允许已知身份的真实 JSON 401 恢复一次会话，权限/网络/资料服务错误不得重建会话或被吞掉。主页搜索按姓名/编号过滤候选，偏好选择不授予私人关系。
- 手机导出在 `mobile/` 执行：`node node_modules/expo/bin/cli export --platform ios --platform android`。
- 网站代码变更遵循当前 Sites 技能：核对原项目及访问范围，官方助手打开源码、检查/构建、源提交同步、归档、保存版本并私人部署；归档与推送源码须一致。
- 原用户已明确授权同范围内提交推送原私人 GitHub；核对真实远端后正常推送，不强推；未经用户明确要求不新建仓库/分支，不改变仓库或站点可见性。
- 仅维护 AGENTS/项目说明且不修改运行代码时，不为文档更新单独重部署生产服务；按本轮指令处理源同步。
- Windows 如触发 Git 所有权校验，使用命令级 `-c safe.directory=<本仓库绝对路径>`，不要设置全局通配信任。
- 沙箱阻止网络或必要子进程时按工具规则申请明确范围的升级，不绕过审批拒绝；既有授权可按需从原用户记录核实。
- 如 Windows 官方构建助手触发 npm 启动器路径错误，只修正本次进程/被忽略的本地工具入口，不擅自改系统安装或依赖。
- 区分类型检查、Hermes 导出、浏览器验收、真机、签名安装包、上架及真实邮件送达；没有完成的不可宣称已验收。

## 评估与交付

- 用户于 2026-10-22 明确授权改用 Capacitor，并要求每一步解释实现方式与技术配置。直接推进实施；保留现有 Expo 工程作为对照和回退，待新端验收后再决定清理。
- 每阶段先说明目的、将修改的文件/配置及原因，完成后说明实际变更、验证结果和下一步；维护简洁的实施配置文档，不能只给计划或把未执行的步骤当成完成。
- 个人 Cloudflare 迁移、数据库替换、站点开放、付费服务与真实邮件发送尚未新增授权；Capacitor 改造继续复用现有 Worker、D1 和私人站点。
- Capacitor 本地打包不能装入服务端 Worker/D1；须评估静态客户端构建、API 地址、令牌、安全存储、Origin/CORS/CSRF、深链、提醒、下载及原生构建。
- 当前只允许同源写入，不能为套壳删除 Origin/CSRF 校验或把私人资料/写入服务改为匿名可用；平台外层访问与应用账号权限分别处理。用户已单独授权公开登录入口，不能再把此前仅所有者访问的阶段性状态当作当前永久限制；也不得把公开入口误解为公开会员数据。
- 费用比较查官方当期报价，区分免费额度、CPU/存储限制、实际用量、邮件/域名费用、迁移维护成本和 Sites 实际账单；估算标明假设。
- 已核验线上基线（2026-10-24）：V18，权限回归 20 组、相关网页回归、Web 类型、生产构建及线上返回入口/PreJu 归并验收通过。后续版本与验收更新在 `docs/project-note.md`；每次改动重新验证相关部分，不沿用旧验收冒称本次通过。手机构建、真机和邮件仍单独验收。
- 交付说明保持短，包含实际链接、提交、测试与外部服务待办；交接只记录可恢复事实，不复制冗长会话。
