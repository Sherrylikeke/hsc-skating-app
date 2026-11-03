# 管理员维护选手与教练

使用有效管理员账号登录 `/workspace?view=skaters`。

- 新增：点“新增选手”，填写全名、负责教练及训练／全名待确认状态，点“保存选手”。
- 更新：打开选手档案，点“编辑选手及教练”。多位教练用 `/` 分隔，教练栏留空可清除。
- 批量维护：点“批量编辑教练”进入 `/coaches`，原有表格粘贴、自动保存与 CSV 导出保留；名单包含新加选手。
- 保存后当前工作区立即采用新资料；其他已打开页面需重新读取资料。

服务器通过 `/api/skaters` 验证有效管理员、同源 JSON 和字段，检查重复姓名，使用 D1 原子批次保存 `hsc_admissions` 的人工资料及 `coach_assignments`，并写入 `hsc_audit`。修改沿用原选手 ID、历史成绩、官方来源、代表俱乐部覆盖信息及 admitted 状态；新增资料的 admitted 为 0。姓名、训练关系、教练文本均不会自动创建会员账号、私人关系或授权。

编辑载入资料版本和教练 revision；其他页面已更新时返回 409，保留输入并提供重新读取入口。旧批量教练页与单人编辑共用教练 revision，避免互相静默覆盖。官方同步仍读取当前 profiles，并保留全名待确认的匹配限制；新增资料不会凭姓名自动合并历史档案。

验证：`scripts/check-owner-registration-worker.mjs` 在临时 Worker/D1 测试新增、更新、重复／并发冲突、批量页和权限隔离；`scripts/check-skater-editor-browser.mjs` 使用隔离 API 数据在 Chromium/WebKit 检查 320/390/1280px 中英文新增、编辑及保存失败后保留输入。运行方式与浏览器依赖见 `docs/mobile-web-install.md`。不使用生产账号或写入测试选手到线上数据库。
