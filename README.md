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
