# HSC 公开上线准备交接

更新日期：2026-11-11（America/Toronto）。新会话先读本文件、仓库 `AGENTS.md`，再按需查 `docs/project-note.md`，无需重读整个旧聊天。

## 目前线上状态

### My Skaters首页赛事与报名（2026-11-11，V43已上线）

- 用户指定4b770f5基线的四项功能已实现：移除概览统计，正式/Interim名单匹配即可展示未来比赛，类别匹配的报名开放日前14天至截止日附SkateReg/Uplifter入口，Skate Ontario详情外链；顶部重复Starting Order链接移除。说明见docs/home-events.md。
- 运行源码8522f2c，V43于Toronto09:22 succeeded，env9/MCP ready。20/20回归、真实Worker/D1、36个Chrome/WebKit中英文视图、正式域名资源SHA检查通过。生产重新导入Niagara547条/23位关联选手，Bowmanville372条/0位关联选手，Paris公告读取无错误。
- 新APK及iOS构建资源、SHA与逐文件证明在本次会话outputs/home-events-release；iOS无IPA，未真机安装。此前公开GitHub推送被自动审批拒绝后，用户明确要求全部推送远端，已从4b770f5正常快进到5253e14；随后补同步文档并正常推送，最终HEAD以远端校验为准。没有强推、改可见性或绕过拒绝。用户目前没有Mac/Apple Developer账号。最终事实见docs/project-note.md。下列V42及此前记录为历史。


### 十位密码与密码重置（2026-11-11，V42已上线）

- 注册及重置密码统一10–128字符，Better Auth和Web/Capacitor表单共用password-policy；旧密码登录不变。登录页直接点击“忘记密码？”进入/reset-password，输入注册邮箱申请；无token的直接访问不再误报链接失效，明确失效链接仍提示重申。手机本地路由也支持，邮件保持受信任HTTPS回跳，不扩大原生deep-link令牌能力。
- 31组核心权限/认证回归、Web类型/语言、13项member-client、10项native、手机生产构建/sync及真实Worker/D1均通过；9位注册/重置被拒、10位成功、旧密码和会话失效。390px样本UI实际走通申请/重置成功与10位注册验证页；没有真实新测试邮件、真实密码修改、生产测试账号或schema变更。
- 运行源码3dd9233bf4c1b351f7067dd22621348e5ff653b3；V42 saved version appgprj_6ad76ca2dba481919ba883865cbd5a0d~appgver_bd98d427a5ac8191bb3284a0f97af0c8，部署appgdep_6af469da646881919b9bdc3b6f6cf543于Toronto 11月11日08:13 succeeded，env9/MCP ready。正式域名页面200、匿名club401、邮件和注册配置true，10位资源SHA匹配，线上实际输入框minlength=10。未改环境变量、访问范围、域名或现有小时任务。
- 最新交付为outputs/2026-11-11/password-review：Android debug APK编译/Lint/签名通过，SHA256=789E93A901A41C8BCCA9D0F05EAFD7DFF6882EE39992F2F79C9865A67372C877；iOS仅sync与57文件ZIP，SHA256=FE749B57F3BC982B4FF6223367BD0AAB4BEC61C1989C0A6F362D94585165303B。13份静态资源在dist/APK/iOS一致。未装真机/产出IPA/上架。网站刷新；旧Android需更新新包才解除12位前端限制。证据和截图在同目录；临时服务器/页面已关闭。
- 本轮已按官方助手同步运行源码至Sites，最后仅补文档并按既有授权正常推送原GitHub。原GitHub上次7a44999可正常快进，最终文档HEAD以本轮Git结果为准；Sites远端仍为3dd9233，不为文档再次部署。下列V39–V41及此前GitHub记录为历史状态，以本节为准。

### GitHub已同步（2026-11-11）

- 用户明确要求提交推送后，原GitHub main从508f4cf正常快进到9afd322199dc028e0125b1891fff1bd8a82807a4，包含下列V39–V41全部功能和验收记录；ls-remote确认，未强推。随后仅补本交接记录，最终文档提交以Git为准。
- 未重部署、发信或修改生产资料；线上保持V41。以下“GitHub未另推”是11月10日历史状态，已由本次同步覆盖。本次文档提交未另推Sites源码远端，后续站点工作用官方助手对齐；工作副本仍为work/release-20261109。

### 家长审批与教练工作流（2026-11-10，V41已上线）

- 旧审批拒绝active家长的pending申请；改为身份一致即可完成申请和关系审批，身份冲突/停用仍拒绝。必须先确认申请选手准入，页面显示具体名单并定位预填准入表；未自动批准真实申请。
- 家长主页最多4位，支持满额原子更换；管理员代改也限4位。已核准关系且列在本人主页的孩子，家长可从下拉列表更改教练；私人授权、全局档案仍单独管理。
- 教练注册选择本人教练姓名，无需选手关联即可查看全队官方赛程，默认进入coach页；本人标签选手置顶，支持隐藏其他选手并多选其他教练。Jen/Bryce联合标签两人均匹配。skater页可下拉添加本人，保留原教练；管理员也用可first name搜索的教练下拉。标签变更不授予私人安排权限，未新增schema。
- V41运行源码43a7cdf43060c351b8747dea173008180648bda7、部署appgdep_6af3f2ce7bb48191b1699d92b3e39bda于Toronto11月10日23:45成功，env9/MCP ready。正式域名教练名单含Jen/Bryce，新注册/本人分配/下拉/更换资源SHA匹配；匿名相关API仍401，跨域403。19项功能、增量会员权限及真实Worker、390px中英样本浏览器验收通过；没有生产测试账号、真实邮件、迁移或新自动任务。
- 家庭偏好读取时也最多4位并优先明确选择，不删除已批准关系。已注册但没有任何已分配选手的教练仍在姓名下拉中。教练登录默认进入执教总表，显式赛程链接/账号页回跳保持。
- 最终APK及iOS构建资源位于本会话outputs/2026-11-10/coach-review，客户端基线b2f63d3，后续43a7cdf只含服务端上限及其测试。13份dist/APK/iOS资源一致，APK编译/Lint/签名通过，iOS仅sync和57文件ZIP；未装真机/生成IPA/上架。详情及SHA见project-note和coach-client-checks.json。源码同步Sites，GitHub未另推；最终文档不单独部署。

### 注册姓名联想与家长管理（2026-11-10，V40已上线）

- 新姓名输入支持 first name 和错拼建议，必须选择名单标准姓名；姓名查询、拼写检查和注册额度独立，429显示等待时间。标准姓名 Mike Pochaev；生产早期8次403后429，随后21:49已有Mike候选关联家长注册并验证邮箱。日志无输入正文，不能确认实际输入或亲子身份；未修改真实账号。
- 管理员新增已注册家长列表、主页选手增删、选手/教练资料编辑。家长自己添加/移除主页选手仍可用；偏好不授予私人关系或角色。管理员写入需版本一致，防止覆盖其他窗口/家长刚保存的选择。
- V40源码c90f3ff7df855477c0aa4ef1342fa135efd50d98、部署appgdep_6af3e570c6b88191a01f897e0a3cbce2于Toronto11月10日22:48成功，env9/MCP ready。正式域名联想Mike及mike procheav均返回Mike Pochaev，新资源SHA匹配；注册/邮箱验证仍开，匿名admin/club401，跨域写入403。19项功能、最终类型/构建、真实Worker和390px隔离浏览器验收通过；没有真实邮件、生产测试账号、迁移或新自动任务。
- 最终APK/57文件iOS构建资源在本会话outputs/2026-11-10/registration-review，13份资源与dist逐字节一致，详情及SHA见project-note和registration-client-checks.json。未装真机/生成IPA/上架；旧Android包需重新安装。管理员入口 /?tab=admin#registered-parents；未代登真实家长或管理员，入口打开返回queued。源码同步Sites，GitHub未另推；不为最终文档单独部署。

### 手机关注与个人预计时间修复（2026-11-10，V39已上线）

- V39源码d4ebc3c12952e37d7448fc8965b349ab646cf749，部署appgdep_6af37c63b3a08191bbe0865f8b952c5a于2026-11-10T20:19:58.502841Z成功，env9/MCP ready；正式CEP_rxp_.js按SHA与本地构建核对一致，匿名club/results仍401。标题手机全宽，默认关注本场俱乐部选手、用户取消/增选保留，已选置顶并按姓名排序；From now改为“当天未结束”并解释当天/赛前首日。个人、选手档案、关注和日历详情共用Coach估算，缺条件按具体原因提示，不能把已公布资料写成官方未公布。Coach默认包括未分配选手，筛选可见且可清除。
- Max已有Jen Jackson/Bryce Davidson。真实原因是线上已换Nov10赛程，STAR 5 Men U10 / STAR 5 U10 Non-Qualifying省略第二段Men；同等级/年龄/节目口径继承明确性别后已恢复。2026-11-10T20:20:33.041Z线上确认11月20日17:35–18:10 BLUE RINK、#2/热身1、uncertain=false，共用正规/NQ时段不估算独占个人分钟。651参赛记录、40时段、57/61顺序仍保留，4特殊格式待核对。最新Nov10原件复算Annie13:48、Shirley14:12、Sydney17:00预计开滑（11月21日当地），不是官方精确分钟。
- 最终18项功能、类型、生产构建、新原件Worker及Android编译/Lint/签名验证通过；320px中文/390px英文隔离UI检查通过。交付本会话outputs/2026-11-10/mobile-review；未装真机、未构建IPA/上架。Sites源码已同步，公开GitHub仍508f4cf；详细最终手机资源证明及部署ID见project-note，本轮最终记录不单独重部署。

### PDF视觉分组与退赛估算已修复（V36，2026-11-10）

- 当前V36，运行源码0db04f7ec9d19b69fac0005d1f2246914eaee733；部署appgdep_6af2bc93d10c8191b7f8dbebad2a9a60于2026-11-10T06:41:34.137147Z成功，env revision9/MCP ready。注册和邮箱验证继续开启，账号兼容、域名、权限和原自动任务未改。
- PDF的明显空白分块是热身分组，不能因没有文字组号列就认定无分组。新解析器starting-draw-3读取已验证单页版面，保留完整性/明确WD数量；退赛跳号按实际活跃位置估算，未知漏人及异常/跨页仍保守待核对。官方个人时间不填估算。
- 15轮补同步后57/61份按新版本核对，4份特殊Level3/4格式仍待核对；604顺序、651参赛记录、40组别时段保留。线上确认Fiora #1热身1、Sydney #2热身1、Annie #7热身2、Shirley #11热身3。Coach展开详情显示标明预计的热身/开滑，个人/赛事官方时间字段仍只显示官方值。
- 新客户端资源已在正式域名按SHA核对；18项功能、类型、生产构建和Worker旧档重解析回归通过。Android新测试APK编译/Lint/签名通过，iOS资源sync通过，13份资源与dist相同，交付本会话outputs/2026-11-10。未装真机、未生成IPA或上架；旧APK需安装新包才能更新退赛估算逻辑。
- 新运行源码在Sites；用户随后明确要求“提交并推送”，已正常快进推送原GitHub main至d7240c05686c8c1a1af0d294ff9f3d992e0bed4c，ls-remote确认一致，包含本轮全部修复及验收记录。随后只补同步状态文档，不单独重部署；最新记录提交以Git为准。详细部署ID、SHA及复算/补同步/线上证明见project-note最新条目。

### GitHub 同步完成（2026-11-10）

- 用户本轮明确授权后，Keswick修复、注册兼容代码、官方公开测试夹具及验收记录三项提交已正常推送原GitHub main至85b106bce774a202538ac58ea50eb54f203e917b，并用ls-remote确认。此前GitHub待授权状态已解除；没有强推、可见性变更或运行密钥上传。
- 本轮只做GitHub同步及本地交接记账，不改运行代码、不重新部署、不发信；线上状态与测试仍以以下带时间的上轮验收为准，不把旧快照冒称本轮实时查询。随后仅提交本条及项目Note状态更新。

### 公开注册已启用（2026-11-09 23:49 Toronto，覆盖下方准备状态）

- 当前V35，源码42d4679f414518346806df26d48490caed42fb9d，保存版本appgprj_6ad76ca2dba481919ba883865cbd5a0d~appgver_0ad2997999ec8191a75c369d746ed1ea；最终部署appgdep_6af2a22cf9d081919c14b3870f46e467于2026-11-10T04:48:52.446969Z成功，env revision9、MCP ready，原public及域名保留。
- Resend域名和三条DNS均Verified；邮件及普通注册均true。精确一个既有未验证家长ID已存秘密配置HSC_EMAIL_VERIFICATION_GRACE_USERS，不写此文档；仅保留共享赛程登录，不伪验证或恢复私人访问。两个已消费内测邀请账号沿用原规则。
- 获授权仅发送一封应用密码找回测试邮件，Gmail确认实际INBOX。没有点击重设链接、更改密码或新建生产测试账号。正式域名config的deliveryConfigured/registrationConfigured/emailVerificationRequired均true；首页、验证及找回页200，匿名club/results仍401。
- 27组核心、类型、构建、Worker隔离检查均通过，未代登真实旧用户或创建新用户冒称全流程验收。原客户端刷新读取同一服务端开关，无新APK/IPA或上架。Sites源码已同步；公开GitHub新增内容仍待独立授权，未绕过此前拒绝。最终验收文档为部署后记账，不为文档更新重部署。

### DNS与旧账号兼容（2026-11-09 最新）

- 用户已添加三条Resend实际记录，Google公共DNS解析已核对正确；后续Chrome连接恢复，已独立读取原域名详情，域名及三条记录均Verified，Enable Sending开启、Receiving关闭，验证事件Nov09 23:09。发件地址已保存并通过同V34配置部署应用，最新Sites只读重查仍V34/public、env revision7；邮件及普通注册仍关闭，未真实发信。
- 只读账号审查发现一个非内测、未验证的既有有效家长。启用邮件前需部署本地兼容修复，并安全配置仅该账号ID的HSC_EMAIL_VERIFICATION_GRACE_USERS。它只保留旧账号登录及共享赛程，不能伪验证、恢复私人角色或覆盖停用；账号ID不写此文档。
- 本地核心27组、Web类型、官方生产构建和Worker/D1隔离回归均通过，零真实发信。新兼容代码未部署，新的秘密运行键未保存。
- 官方Sites源码助手的隐藏stdin凭据传递被自动审批拒绝，即使已核实接收进程和原项目范围。不得绕过，需用户明确授权后继续原站源码同步/发布。原先开放注册的意图有效，不重复询问是否开放；公开GitHub新payload授权仍另待确认。

### Keswick修复与注册请求（2026-11-09 16:18 Toronto）

- 当前网站V34，运行源码5a3b09a4a5e7b7166b7efe0db922ebb4c0900c95，部署appgdep_6af237a8eca881918e53577b70954462成功，env revision6。修复Start Orders/Results汇总页被误当单份顺序的发现流程及失败队列轮转。
- Keswick SO-325449已补同步604条官方出场信息，57/61份文件核对通过，4份特殊Level3/4类别仍待核对；Fiora #1、Sydney #2、Annie #7、Shirley #11已返回。原赛程的少数未支持行仍待核对，不推算热身组或个人时间。服务端修复，原客户端刷新API即可读取，无需新APK。
- 用户已要求开放普通注册，当前外部阻碍是Resend停在登录页、缺HSC_EMAIL_FROM及实际发信域名验证。已保留Chrome Resend页供用户登录；完成后按原邮件验证与受控送达流程开放，无需再问是否要开放，不能伪标已验证或用公开邀请绕过。
- 新修复已在Sites源码，公开GitHub推送因自动审批要求针对本次新payload另行明确确认而未完成；不要用其他通道绕过。此前7b4db81发布记录已在GitHub，本轮提交待用户确认。

### 最新续做（2026-11-09）

- 网站已部署V33，源码cd62767d310750738b98fd60e89634f44877bf66，包含原GitHub main的PR #1–#7；保存版本appgprj_6ad76ca2dba481919ba883865cbd5a0d~appgver_926e1591a8dc819197a68184004f646d，部署appgdep_6af22ecad9508191b07b3a9a18b2a66a succeeded、env revision6、MCP ready，15:36:40 Toronto完成。原Sites项目访问已恢复，沿用域名/Worker/D1/public范围，邮件及普通注册保持关闭。
- 本轮发布副本为本会话work/release-20261109；两个旧副本各有13项未提交PDF删除，继续保留。原GitHub现为public，未在本轮改可见性。详细验证和客户端边界见docs/project-note.md最新条目。
- Android调试APK已编译、Lint及签名校验，iOS预构建工程已同步打包，交付在本会话outputs/2026-11-09。未安装真机、未生成IPA或发布商店。客户端和网站使用同一远端源码；邮件域名和真实送达仍待原授权流程。

### 本轮续做更新（2026-11-04 16:44 Toronto）

- 当前已部署 V32：运行源码 `0570d3e395ae26c707365de5e583e529a2ef4646`，保存版本 `appgprj_6ad76ca2dba481919ba883865cbd5a0d~appgver_4183cc2af7d8819182bfa0d431eb03f2`，部署 `appgdep_6aeba744a65481919bc94f8a30e35e29` succeeded、env revision 6、MCP ready。下方 V31 内容是上一轮基线。
- 已补齐网页密码找回（1小时、一次性、撤销旧认证会话），已消费专属邀请的现有测试账号在开启邮件后保留未验证登录与共享赛程，私人权限仍按原规则控制。
- 新增 `HSC_PUBLIC_REGISTRATION_ENABLED`，缺失/false 默认关闭。邮件启用与开放普通注册已分开；线上 config 重新读取 deliveryConfigured=false、registrationConfigured=false，重设页 200、匿名 club 401。没有真实邮件、DNS或运行配置更改。
- 类型、生产构建、语言、会员入口11组通过。核心原脚本因既有解析器版本断言3/4失败；忽略目录内存断言覆盖后26组通过，包含实际 Better Auth 密码/过渡流程。浏览器预览调用超时，新界面未完成视觉验收。Resend 浏览器停在登录页，需用户登录后才能读真实发信域名记录；建议方案与后续双开关步骤见 `docs/email-verification.md`。
- 原私人 GitHub 推送首次被自动审批要求核验私人性/所有权；已用既有 Git 凭据只读确认 private、owner=Sherrylikeke、admin/push=true，重试正常推送 0570d3e 成功，Sites 源码已同步。不要把原主仓库七个 PDF 删除纳入任何提交。

- 正式网址：https://hamiltonskatingclub.memberportal.dev/ 。原 Sites 网址继续保留。
- 网站访问范围已为 public，登录页可公开访问；**普通自助注册仍未正式开放**。现有账号可登录，指定测试者通过邮箱绑定的专属邀请注册；不可把 public 误解为匿名读取会员资料或任意邮箱免验证注册。
- Sites 项目：`appgprj_6ad76ca2dba481919ba883865cbd5a0d`，复用原 Worker、D1 数据库与既有权限，不新建替代站点。
- V31 已部署成功，运行源码 `6477101f59dac15d96346aa4d3b619449416309b`；保存版本 `appgprj_6ad76ca2dba481919ba883865cbd5a0d~appgver_e9b59aa5da948191aa60f1e9554b1d7a`；部署 `appgdep_6aeb75dc2ab081919b16df063f9f7be2`，2026-11-04 13:13 Toronto succeeded、env revision 6、MCP ready。后续上线状态须重新查询。
- 本次交接重新核对：最新保存版本 V31、访问范围 public、运行配置 revision 6；`BETTER_AUTH_SECRET`、`RESEND_API_KEY`、`HSC_PILOT_REGISTRATIONS` 已配置，`HSC_EMAIL_VERIFICATION_ENABLED=false`，**没有 `HSC_EMAIL_FROM`**。此处仅记配置存在性，不记录密钥或邀请令牌。
- 程序／数据库由 Sites 管理的 Cloudflare Workers/D1 托管；用户个人 Cloudflare 账户目前管理 memberportal.dev 的域名与 DNS，没有迁移个人 Cloudflare 托管。D1 的实际国家／地域未确认。

## 已完成且应保留

- 自有邮箱／用户名密码登录、原管理员恢复路径、受邀测试注册；选择姓名、添加主页选手或教练文本都不自动授予私人关系和管理权限。
- 家长／赛程测试账号可以进入 Coach 总表，查看所有队友共享官方赛程；自己的选手主页偏好继续保留，私人备注、安排与写入按已批准关系隔离。
- 管理员在选手档案新增、修改选手及教练；批量教练页包含新增选手，保留粘贴／CSV。原 108 位名单、选手 ID、历史成绩、官方来源、教练文本和人工安排均保留。
- 历史图表选择 PreJu 会同步筛选下方赛事列表；排名姓名与评分细分不再压成窄列，支持横向滑动，实际 J 编号、Ref 及缺失裁判空格保持对应。
- STAR 1–4 混合组、PAD、旋转 PDF 与明确 shared warm-up 支持；详细同步每轮最多三场，最近两场优先，第三场按上次检查时间轮换，避免较远赛事被长期跳过。只显示官方已公布时间，不推算个人出场分钟。
- 现有每小时任务 `Automation_a2b3ae8946b48191937bd484365e1ec2` 保留；已删除的 `hsc` heartbeat 不得恢复或复制。
- Chromium/WebKit 的中英手机／桌面隔离场景、相关解析与真实 Worker／临时 D1 回归已通过；不冒称真实家长账号登录、iPhone 真机或邮件送达验收。PWA 支持主屏幕安装；没有已上架的原生 iOS 应用。

## 新会话从这里开始

1. 重新核对线上 V31、域名和运行配置，只输出配置状态，不输出密钥。先读 `docs/email-verification.md`，检查真实发信域名配置及验证／重发／过期／找回密码的现状。
2. 用户已拥有并可管理 memberportal.dev，可评估该域名下的独立发信子域，通过 Resend 验证实际要求的 DNS。官方 HSC 域名目前不能接管，无须把它作为唯一选项。只控制浏览器，不能接管整台电脑；无需用户提供账户密码。
3. 先完成发送域名、发件地址、回调网址和隔离验证，再安排真实受控发送。按用户明确授权处理真实邮件，禁止擅自向测试家长或其他会员群发。
4. **开启邮箱验证前，先处理现有测试账号 email_verified=false 的兼容流程。** 当前启用开关会影响未验证的非管理员登录；不能直接开启造成现有用户无法登录，也不能批量伪造已验证。原管理员恢复入口必须保留。
5. 验证普通注册从名单匹配、邮件验证、登录到共享赛程的完整流程；身份审核后才授予私人家长／教练关系。教练姓名 Jennifer Jackson 即 Jen Jackson，但填写姓名不能取代账号权限审批。
6. 核对公开运行所需的备份／恢复方法、错误可见性和实际资源用量，形成具体可审核的开放步骤。沿用现有域名／托管；域名购买、收费订阅、迁移或批量邮件不包含在例行修复授权中。后续正式开放依据新会话用户指令推进，本轮只做交接，不切换注册开关。

## 源码、提交与发布

- 原主仓库：`C:/Users/ITSupp/Documents/Codex/2026-10-19/xian/work/sites/hsc-coaches`。
- 干净发布工作副本：`C:/Users/ITSupp/Documents/Codex/2026-10-24/hsc-web-public-test/work/results-release`。其中 node_modules 为原主仓库依赖的 junction，浏览器 QA 缓存在忽略目录 work/browser-qa。
- 原私人 GitHub：`https://github.com/Sherrylikeke/hsc-skating-app.git`，主仓库 remote 为 `github`；正常提交推送已获授权，不强推、不新建替代仓库、不改变可见性。
- 主仓库有七个用户已有 PDF 删除项，须保留未提交；不要用该脏工作区打包或 `git add -A`。从干净副本发布，先与最新主线文档快进。不要恢复、清理或纳入这些删除。
- 网站代码改动遵循当期 Sites 技能，先确认原项目／访问范围，通过官方助手打开源码，再修改、验证、推送、归档、保存版本并部署。短期源码凭证会过期，发布前核对有效期；保留当前提交对应的打开结果，密钥仅走内存和隐藏 stdin。
- 本轮仅更新交接／Note，不为文档单独重部署。前次因 Codex 用量上限造成的自动审批中断已于 11-04 恢复，V31 发布成功，不是尚待解决的代码阻塞。

## 费用说明边界

2026-11-03 核对的官方 Sites 说明为：托管免费至 2026-12-31，2027-01-01 拟按用量、先抵套餐额度后计算超额；建站／修改计入 Codex，域名注册另付。正式说明费用前须重新浏览官方当期信息，不能把 Cloudflare 公开价或 credits 直接当作用户美元账单。现有工具未提供该账号实际账单和套餐托管额度，未替用户购买或升级任何收费项目。

参考：https://learn.chatgpt.com/docs/sites#pricing 。更多已验证事实及待办见 `docs/project-note.md`。
