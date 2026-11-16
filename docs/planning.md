# 比赛准备与个人报名

## 比赛日

主页、个人赛程的“比赛日”进入 `/workspace?view=day`。默认 Toronto 今天，可选择已有赛程日期和 My Skaters 中的单个孩子。页面集中显示到场参考、官方组别时段、原有预计热身／开滑、冰场与教练集合安排；未确认时间保持待定。到场最少提前60分钟，已有更早教练集合时使用更早时间。教练安排仍只使用服务端已按批准关系过滤的数据。

准备清单按账号、日期、孩子保存在当前浏览器；换设备不自动同步。打印／保存PDF使用浏览器打印窗口，仅包含当天筛选内容，内容较多时分页，未接入邮件或推送。

## 个人报名看板

`/workspace?view=registrations` 记录“考虑报名、已提交、候补中、不参加”，支持多孩子及手动添加当前／未来赛事。报名推荐复用原匹配规则，官方／Interim名单独立展示；个人填写不会向主办方报名，也不代表已获Assigned名额。

`GET/POST /api/registrations` 复用应用认证和同源写入校验。D1 `hsc_registration_plans` 按会员、选手、赛事唯一保存；每次重新核对当前My Skaters，只能读写自己的记录。从主页移除孩子后不再展示或允许更新其计划，既有私人关系不变。

## 资料更新状态

首页推荐卡、比赛详情、比赛日和报名看板显示最近成功检查时间、部分待核对、保留上次有效赛程。赛事详情成功时间独立于最近尝试时间；旧记录没有可靠成功时间时显示“尚无记录”，不将失败尝试当作成功。尚未完成的文件或旧解析版本仍视为待核对。

普通会员只收到安全摘要，不含原始错误、文件批次进度或解析内部信息。管理员在既有默认折叠Reference中查看诊断，通过比赛详情顶部“检查这场比赛更新”重试。原每小时任务和轮转范围保持不变。

## 日历订阅

赛程日历底部可创建、替换或撤销个人订阅，详情见 [calendar.md](calendar.md)。只读当前My Skaters的确定官方组别时间，既有一次性导出继续可用。

## 迁移与验收

追加 `0006_registration_plans.sql`、`0007_calendar_subscriptions.sql`；没有修改旧迁移或重建数据库。部署时需由有原Sites项目权限的所有者使用既有发布流程应用迁移和源码；GitHub推送本身不会让网站上线。本轮没有改动生产数据、Sites权限、邮件或原生客户端。

```text
node scripts/check-competition-day.mjs
node scripts/check-registration-board.mjs
node scripts/check-source-freshness.mjs
node scripts/check-calendar-subscription.mjs
node scripts/check-planning-browser.mjs
```

综合浏览器脚本使用隔离API与固定时钟，覆盖320px Chromium、390px WebKit各中英两组，检查清单恢复、个人报名与官方状态分离、订阅管理、打印和横向溢出。真实构建Worker另用临时D1验证新迁移、报名API和订阅读取／撤销。实际第三方日历订阅刷新和手机真机验收仍未进行。
