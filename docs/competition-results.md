# 历史比赛排名与评分

在 Skater records 选手页点击历史比赛名称、项目或图表点，打开该组成绩。选手高亮；排名表可按官方名次、TES 或 PCS 排序，点击姓名查看动作／分项与官方评分页。多项目比赛切换项目标签；合计不代替各项目的逐项评分。

技术和 PCS 名次为站内按官方分数计算的比较值，同分并列；缺少已评分对手的分项分数时隐藏该项比较名次。没有推算个人比赛时间、评分或未公布的官方名次。PCS 包括 Presentation/Performance 等内容，具体以赛事评分制为准。

来源读取只允许服务器历史记录中的官方地址。PDF/公开 API 为主要支持格式；官方不可用、403、扫描件或格式不支持时显示提示与原始来源。只读内存缓存 15 分钟，不覆盖原历史资料。

回归：`node scripts/check-competition-results.mjs`；构建后 `node scripts/check-owner-registration-worker.mjs` 在隔离 D1/Worker 验证 API 与真实 PDF，不接触生产账号。真实手机视觉仍须设备验收。
