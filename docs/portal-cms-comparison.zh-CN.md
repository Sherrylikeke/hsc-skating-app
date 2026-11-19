# HSC 独立 CMS 方案比较

版本 1.1　核查日期 2026年11月18日　状态 已选择应用内轻量后台 独立方案比较留档

本比较是《HSC 官网迁移产品需求文档》的技术选型附件。用户在比较后选择应用内轻量后台，复用既定前端、Worker、D1、Drizzle 和现有账号。以下独立方案资料保留作为决策依据，未安装或接入候选系统。

## 1 选择结论与方案差异

2026年11月18日用户明确选择“回到应用内轻量后台”。Board 通过现有账号按内容权限维护页面、公告、教练和政策，保留原站栏目；编辑、发布和版本恢复由本项目开发维护。比较阶段曾建议 Sanity、备选 Payload，均未被采用；下表仅记录当时权衡。

独立 CMS 可以只负责内容后台，前台仍由现有 React 应用呈现；因此可以保留原站栏目、路径映射及家长报名习惯。Board 的编辑界面会改变，须单独验收。现阶段没有旧后台权限，不能承诺后台操作完全相同。

| 方案 | Board 编辑体验 | 对 HSC 的适配与代价 |
| --- | --- | --- |
| Sanity 托管内容平台 | 可配置成网页、公告、教练和政策表单；支持草稿、预览和协作 | 通过 API 接入现有前台，内容库由 Sanity 托管；我们仍需开发内容模型和前台整合，平台运行维护较少 |
| Payload 自托管 CMS | 自带管理界面，可配置富文本、媒体、草稿和内容权限 | TypeScript 与 React 路线接近现有技术；需维护 CMS 服务、升级、备份、权限及构建整合 |
| Directus 独立内容后台 | 可视化管理结构化内容，提供角色权限与 API | 官方自托管路线采用 Docker；会增加 CMS 运行环境和内容数据库，集成与运维范围较大 |

Sanity 的预览、协作与角色功能依方案而异，不能把全部付费功能算入普通免费版。[官方功能与价格](https://www.sanity.io/pricing)。Payload 的草稿和细粒度权限可配置，但多级审批等工作流需要进一步确认范围。[草稿](https://payloadcms.com/docs/versions/drafts)、[权限](https://payloadcms.com/docs/access-control/overview)。

Directus 的官方数据库客户端列表包含 PostgreSQL、MySQL、SQLite 等，未列 Cloudflare D1；本次不能把 SQLite 支持视作 D1 已兼容。[部署](https://directus.com/docs/self-hosting/deploying)、[数据库配置](https://directus.com/docs/configuration/database)。上述维护工作量排序是结合 HSC 当前架构的判断，不是实际工时测量。

## 2 费用、许可与内容归属

| 方案 | 已核查的基础条件 | 对 HSC 的含义 |
| --- | --- | --- |
| Sanity | 非营利计划获批后，额度内免费，含 25 用户和 3 个 dataset；普通 Growth 为每个非 Viewer 席位 US$15／月 | 若未获批，假设共 5 个收费席位，基础费为 US$75／月、US$900／年；尚未计税、汇率及超额用量 |
| Payload | 核心 CMS 为 MIT 开源许可，自托管软件免费；企业功能另计 | 没有核心 CMS 席位费，但运行、文件存储、备份和维护并非免费；现有 Sites 实际增量账单待确认 |
| Directus | 定价 FAQ 的 Open Innovation Grant 条件为年收入低于 $5M 且少于 50 名员工，符合条件可免自托管软件费；Grant 云托管标价 $99／月 | HSC 的资格未核实；官网报价不视作已获优惠，也不当作加元预算，币种、税费和最终条款须在选型前确认 |

Sanity 非营利计划接近 Growth 功能，需提交带有效 project ID 的申请；官方给出的回复时间为 14 个工作日以内。HSC 的 non-profit 身份是申请依据，但不等于已获批。普通 Free 虽含 20 个席位，却仅提供 Administrator 和 Viewer 两种角色，不适合直接作为多人编辑、权限分工的默认方案。[非营利计划](https://www.sanity.io/docs/platform-management/non-profit-plan)、[普通方案及美元计费](https://www.sanity.io/pricing)。

Payload 的核心 MIT 许可与企业增值功能需要区分；SSO、企业视觉编辑等不能默认包含在免费核心内。[官方方案](https://payloadcms.com/get-started)。Directus 当前许可页为 MSCL-1.0-GPL，并有许可证密钥限制，不能沿用旧版本许可印象或视作 MIT 同类。[许可](https://directus.com/license)、[价格与 Grant 条件](https://directus.com/pricing)。

Sanity 的内容保存在服务商平台；Payload／Directus 自托管时由所选基础设施承载。三者都必须规划内容、媒体、链接和版本的可用导出及恢复演练。更换 CMS 还可能需要转换富文本格式和查询代码，自托管也不等于零迁移成本。此处仅比较 CMS 费用，不包含支付商手续费、邮件或域名费用。

## 3 接入约束与决定前验证

内容边界：CMS 管理公开页面文字、公告、教练简介、政策及相关图片和 PDF。原站栏目层级和英文业务名称固定为迁移基线，页面用受控模块编辑，避免编辑时误改网站结构。新增存储服务及绑定仍待决定。

业务边界：账号、私人关系、课程名额、收费规则、报名、订单、支付及财务余额继续由 HSC Worker 和 D1 控制。CMS 可以展示课程说明和业务链接，但不能成为第二套价格、名额或付款状态来源。CMS 编辑员不自动获得会员、财务或系统管理员权限。

Payload 的官方 Cloudflare 模板支持 Workers、D1 和 R2；本次读取的 main 模板使用 OpenNext，依赖为 4.0.0-beta.10。我们当前采用 Vinext／Vite，R2 尚未启用，因此“支持 Cloudflare”不等于可直接装入当前应用。实施前需选择稳定版本，验证构建、媒体、登录及迁移边界；不能用模板自动建库或覆盖现有表。[官方 Cloudflare 说明](https://payloadcms.com/posts/blog/deploy-payload-onto-cloudflare-in-a-single-click)、[本次读取的模板依赖](https://github.com/payloadcms/payload/blob/main/templates/with-cloudflare-d1/package.json)。

| 验证项 | 通过条件 | 当前状态 |
| --- | --- | --- |
| 编辑与发布 | Board 完成改课程说明、发公告、替换政策 PDF、预览与恢复版本；公众只读已发布内容 | 待原型与试用 |
| 账号与权限 | 已选择复用现有账号；内容权限由服务端检查，与会员、私人关系和财务权限分开 | 方向已定 待实现验收 |
| 构建与业务隔离 | 保留现有前端和业务库；CMS 故障时仍可展示最后发布内容并继续核心报名流程 | 待设计与测试 |
| 退出与交接 | 内容及媒体可导出、恢复，链接可重建；组织所有权和运维责任可交接 | 待设计与演练 |

CMS 方向已确认，内容和版本记录存现有 D1；下一项讨论图片、PDF 等文件存储，部署及备份另定。本次仅更新选型文档，未实施后台或数据库迁移，未开通服务或提交优惠申请。
