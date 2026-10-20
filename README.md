# HSC Club Portal

Hamilton Skating Club 私人管理员 Web App。访问范围保留为 Site 所有者；目前尚未实现选手、家长和教练各自账号权限。个人赛程选择只保存在当前设备，不代表身份验证。

## 资料与功能

- 108 位选手候选资料，包含在 Hamilton 训练、代表 Skate Dauphin 的 Breken Brezden，以及 Nathaniel（全名待确认）。训练关系与代表俱乐部分开显示。
- 2023-10-19 至 2026-10-19 公开底稿中的 999 条历史记录、87 场赛事。成绩、报名、出场顺序和退赛分开；未公布成绩不补零。部分资料可能缺失，不能视为完整职业档案。
- 官方赛事日历、参赛名单、PDF 分组赛程、个人赛程、教练汇总表及 CSV。赛程是组别时间，不推算个人上冰时间。重叠提示仅是可能冲突。
- 集合时间和备注按选手、赛事、项目保存；官方时间修改后保留。类别改变后无法关联的备注另行显示。
- 既有 coach_assignments 不被历史资料导入覆盖。Jen Jackson/Bryce Davidson 按用户原文保存。原教练编辑功能位于 `/coaches`。

## 官方同步

Skate Ontario 官方日历 API 提供未来约六个月赛事。详情从官方页面发现文件链接，校验 HTTPS、主机白名单、重定向、响应体大小和超时。目前已验证 DSTools HTML 名单和含日期、起止时间、冰场列的日程 PDF；名单 PDF、图片扫描件及其他格式显示待核对，保留官网链接。

页面打开时检查日历新鲜度，也可手动同步。一次操作更新日历及未来 45 天内最近三场赛事。详情用 SHA256 比较，支持官网同一链接覆盖文件。失败时保留最后成功数据并显示错误；不会清除教练安排。带过期时间的全局锁避免并发覆盖。

MCP 端点 `/mcp` 提供 `get_hsc_sync_status`、`sync_hsc_calendar`、`sync_hsc_event`，均要求平台认证。无人值守更新须在已发布 Site 上另建并验证云端任务，以 Sites 实际任务状态为准。

云端任务先同步日历，再选择未来 45 天最近三场赛事逐一同步。使用固定官方来源，不猜测选手身份；Nathaniel 全名确认前不关联。失败保留有效快照，标示待核对；不得改写教练资料、集合安排或访问范围。

## 开发与验证

data/ 保存原始资料，lib/ 保存共享类型及解析器，db/schema.ts 定义 D1。历史导入按 app_meta 版本键保证幂等。schema 只追加迁移，不修改已应用迁移。

类型检查：`npx tsc --noEmit`。真实官方样本解析回归：`node scripts/check-official-source.mjs`。教练粘贴检查：`node scripts/check-paste.mjs`。Sites 构建与打包使用插件 build-site.mjs、site-workflow.mjs，源码推送必须与部署归档一致。

浏览器验收包含实际官方数据、备注保存并刷新、同步后备注保留，以及发布前后逐行比较原有教练资料。页面修改不会自动回写原始 Excel。

## 原教练编辑功能说明

## 2026-10-20 更新

全站采用柔和蓝色，包括原教练编辑页。选手档案增加成绩趋势与记录状态分布，赛季、项目、成绩口径、比赛、状态、文字搜索和重置筛选共用同一份筛选结果。图表按项目与类别/分项口径分别查看，使用实际日期间距；退赛、缺分和队伍记录不画为个人成绩。原始记录仍可点击核对。参考用户已建的 Glissade 数据库的 Progress over time 与清除筛选交互。

新增 Starting Order 读取：从赛事官网和最多两个官方结果页面发现文件，识别文字型 Starting Order PDF 与有明确列名的 HTML 表。保存出场序号、官方明确标示的 Warm-up Group 和个人时间；未列出就留空，赛事 Group 不被当成 warm-up group。比赛详情、个人/教练赛程及 CSV 都显示这些字段。出场序号可用于定位官网已经列明的序号区间，但不按人数计算热身组。每次详情同步最多复核四份出场文件，其余明确标记待核对并在下次继续；失败保留有效快照。扫描件及其他版式尚需适配。

默认负责教练直接读取 D1 的 coach_assignments，多教练保留；仅空值显示待分配。docs/coach-assignments-backup-20261020.json 是所有者已保存资料的独立恢复备份，不用于覆盖现有数据库。原基线 ef837ff 的完整 Git 历史已推送到私人 GitHub 仓库 Sherrylikeke/hsc-skating-app，Site 托管源码仍按 Sites 工作流保存。

新增检查：`node scripts/check-athlete-history.mjs`、`node scripts/check-starting-order.mjs`。出场测试包含真实官方PDF（五行，无热身组列）和明确标为 synthetic 的 HTML 热身组样本，不能把后者当作官网已公布的数据。下一阶段需求与安全验收见 docs/PHASE2_PROMPT.zh-CN.md。

108 位选手名单取自既有 HSC 公开比赛底稿，包含 Breken Brezden。Sydney Mitchell 的教练按用户填写保留为 Jen Jackson/Bryce Davidson。名单是历史关联候选资料，未经俱乐部现役会员确认。

- 点击负责教练格输入，或从 Excel 直接粘贴一列、多行。
- 两列姓名与教练按姓名匹配，找不到或重复的姓名会阻止整次粘贴。
- 单列按筛选后可见名单，从所选选手开始；空行清空相应教练。
- 按 Enter / 上下方向键移动。批量粘贴可撤销。
- 云端 D1 自动保存，保存失败显示重试；刷新可恢复本机未保存草稿。
- 每行版本检查防止其他标签页静默覆盖。发生冲突后，用户点击重试才按本页内容覆盖。
- CSV 导出只导出本页姓名与教练；本页不会自动改写原始比赛 Excel。
- 默认私人 Site，仅当前所有者可访问。API 要求 ChatGPT 登录身份。

源代码在 app/；数据库 schema 在 db/schema.ts；初始名单在 data/roster.json。
用 Sites 插件构建和发布。schema 更改后先生成并检查 drizzle 迁移。

用户补充 Nathaniel（全名待确认），教练 Jen Jackson/Bryce Davidson；确认全名前不关联公开比赛记录。
