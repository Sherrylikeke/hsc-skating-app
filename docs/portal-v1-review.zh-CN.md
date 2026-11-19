# HSC 门户 v1 本地评审说明

2026年11月19日。配套需求：[PRD v1](portal-prd-v1.zh-CN.md)。这是隔离本地版本，生产会员与财务数据未迁移，现有线上入口未替换。

## 打开与启动

开发机本地预览：`http://127.0.0.1:5173/portal`。内容后台：`http://127.0.0.1:5173/portal/admin`。只有预览进程运行期间可以访问，不是公网发布地址。

本轮验收完成后已关闭临时预览进程；使用下面命令即可重新打开，已建好的隔离测试数据会保留。

在 `F:\hsc-skating-app` 执行：

```powershell
node scripts/preview-portal.mjs
```

脚本使用 `work/portal-v1/runtime` 中独立的本地 D1／R2，不读取云端数据库；首次启动应用全部迁移并创建合成测试账号。绑定仅监听 `127.0.0.1:5173`，保持真实邮件关闭。首次初始化可单独运行 `node scripts/preview-portal.mjs --prepare`。

如源码修改或缺少 `dist`，先用当前 Sites 构建助手构建：

```powershell
node C:/Users/seand/.codex/plugins/cache/openai-curated-remote/sites/1.1.7/scripts/build-site.mjs
```

此路径是本次开发机安装位置；换机时读取当地 Sites 技能中的构建助手位置。构建输出为 `dist/server/index.js` 和 `dist/client`。

**仅限隔离本地测试的账号**：用户名 `portal_preview`，密码 `HSC-Preview-Only-2026!`，邮箱 `preview@example.test`。该账号是脚本生成的虚拟 Board 管理员，不是任何真实会员或生产管理员。使用现有 Better Auth 登录，随机本地认证密钥保存在被 Git 忽略的 `work/portal-v1/.dev.vars`。

## 建议评审顺序

1. 首页：保留原 Logo，查看深青绿／浅冰绿方向、课程入口及手机菜单。
2. Our Programs／Our Coaches：核对四类课程、18 位教练及其经原 HTML 行结构确认的照片。教练邮箱目标冲突显示待确认，不自行更改旧资料。
3. Registration：搜索、筛选、列表／日历切换、展开详情；匿名 Register 提示登录，并保留返回报名路径。
4. Products／Annual Membership：显示原公开项目、费用与售罄；登录后可保存购物车。Checkout 被服务端明确关闭，不产生报名、订单或扣款。
5. Content administration：保存草稿、预览、直接发布、加载旧版本再发布；正文与教练简介可编辑。授权编辑权限与私人会员／财务权限独立。
6. Images & documents：上传 PNG／JPEG／WebP／PDF，默认私有。勾选公开后才可由访客读取；可将公开文件链接插入当前草稿，再发布。
7. Contact Us：提交仅写入此本地版本的管理员收件箱，不发送真实邮件。
8. `/api/health` 返回最小可用性；后台导出仅包含门户内容与文件元数据，不是完整备份。

## 实现清单

- 31 个原入口有对应页面；原栏目次序保持。v1 使用 `/portal` 前缀，正式根路径留到统一切换。
- 原根页、`/workspace`、密码恢复和既有认证保持；新增 `/member` 别名和严格限制的门户登录返回路径。
- 本地公开快照：24 项商品、1 个实际观察到的班次、年度会员入口；未将四类课程介绍虚构成可售班次。
- 45 张原图和 6 份 PDF 保留来源及校验值，位于 `public/portal-assets/`；素材清单在 `data/portal-snapshot.json`。
- 教练照片关联按原页同一 `div.m-row` 内唯一图片与姓名核验；姓名、简介与来源随快照保留。
- 内容／版本／编辑授权／文件／联系收件箱／购物车新增 6 张 D1 表，增量迁移 `0008_sweet_blur.sql`；旧迁移未改写。
- R2 逻辑绑定 `BUCKET` 已在源码声明；本地模拟存储可测，尚未向生产部署这个声明。

## 验收记录

| 检查 | 本次结果 |
| --- | --- |
| Web TypeScript | `node node_modules/typescript/bin/tsc --noEmit` 通过 |
| 新门户服务端／功能 | `node scripts/check-portal.mjs`，16 组通过；覆盖授权、草稿隔离、版本冲突、恢复、撤权、教练发布、购物车隔离／可信金额、CSRF、联系收件箱、私有文件和登录返回 |
| 既有会员核心 | `node scripts/check-members.mjs`，32 组通过；旧数据保护、身份与私人关系未退化，外部邮件发送 0 |
| 既有会员客户端 | `node scripts/check-member-client.mjs`，13 组通过 |
| 语言基线 | `node scripts/check-locales.mjs` 通过 |
| Sites 官方构建 | 通过；工具链既有 sourcemap／动态导入警告，不是新的构建失败 |
| 浏览器 | 31 个原入口 HTTP 200、未知路径 404；Chromium／WebKit 在 1440、390、320 宽度共 30 个页面渲染及 6 组真实本地流程通过，页面错误 0、无横向溢出；记录在 `work/portal-v1/browser/report.json` |
| 最后手机复核 | 手机登录入口及 320px 筛选框调整后重新构建，两个引擎 × 320／390 宽度共 4 组通过；菜单登录可达、无横向溢出，复看 WebKit 320px 报名页截图。记录在 `work/portal-v1/browser/final-mobile.json` |

浏览器脚本 `scripts/check-portal-browser.mjs` 使用项目已有 Playwright、Chromium／WebKit，检查 1440、390、320 宽度及真实本地账号流程。它不读取生产会话，也不将隔离测试当成真实会员、手机真机或真实邮件验收。

## 尚未完成的正式迁移工作

- 分期实现、正式域名、付款页面形态继续待定。
- 缺 Uplifter 后台资料；实际课程资格／容量／候补、折扣／税费／退款、家庭及账务导出尚未核验。
- 真正 Stripe 收款、支付通知、订单与名额联动、余额／历史账务迁移和旧会员激活发送尚未实施。购物车只是选择保存，不代表完成这些业务。
- 联系收件人和 Resend 运营配置未接通，公开自助注册继续服从现有邮件与准入限制。
- 每周完整备份、独立副本、自动提醒及平台恢复入口未接通；本轮交付的是轻运维方案、健康检查与指定内容导出。
- 网站文案的已知冲突仍需俱乐部确认；具体视觉方向可继续调整。
- Sites 查询返回站点 V53 和现有自定义网址，但源码写入凭据接口返回 `project_not_found`（404），本轮未能执行官方源同步／保存版本。未新建替代项目，也未改变域名、受众或生产入口。

以上缺口关闭并完成 PRD 的正式验收后，再统一切换官网、报名与付款。当前 v1 不应作为完整 Uplifter 替代上线。
