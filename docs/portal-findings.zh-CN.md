# HSC 官网现状与迁移发现

版本 1.0　核查日期 2026年11月18日　读者 项目负责人及俱乐部 Board

HSC 现有 Uplifter 门户同时承担官网展示、会员入口、课程报名和多种收费。完整迁出需要保留这些业务及其数据。项目方向已确定为在现有 HSC 应用上扩展，保留原网站结构、功能和主要使用流程，重点更新外观。具体技术栈和服务商逐项确认。

## 1 核查范围与证据边界

本次重新读取了 30 个导航及辅助入口，另读平台 Cookie 说明，共 31 个站内页面或入口；下载读取 6 份本站 PDF，共 102 页，视觉核对两份课表；清点 18 位教练、24 项商品或收费及 9 个视频嵌入，并检查 14 个外部目标的可访问状态。重复导航、锚点和同一登录跳转不重复计作业务页面。

课程 Register、商品 Add、年度会员 Add to Cart 均实际点击，匿名访问进入登录弹窗。志愿者入口也要求登录。未创建账号、下单、付款、发送邮件或提交联系表单。

用户确认目前没有 Uplifter 管理后台权限。因此，登录后的家庭管理、购物车、结账、收据、余额、分期、管理员页面及导出数据尚未核验；页面上的说明不等于后台实际配置。视频只清点嵌入来源，未逐段观看；外部网站未递归遍历。

| 证据级别 | 可以支持的结论 | 使用限制 |
| --- | --- | --- |
| 公开页面实查 | 页面结构、文字、公开金额、可见字段和匿名入口行为 | 不推断登录后或管理员功能细节 |
| 本站附件 | 附件版本的课表、治理表单与资料主题 | 与网页冲突时不能自行选定有效版本 |
| 厂商官方说明 | 导出和支付迁移存在相应能力 | 不能代表 HSC 套餐、合同或实际费率 |
| 待后台核对 | 会员关系、财务余额、扣款计划和运营配置 | 补齐后才能确认功能等价和切换方案 |

主要依据为 [HSC 门户首页](https://hamiltonskating.uplifterinc.com/) 及其站内链接。本轮完整逐页元素、截图和附件清单保存在本地审阅报告中；其路径见本文末尾。

## 2 原网站结构与现有能力

顶栏的主要顺序为首页、About Us、Our Programs、Our Coaches、Club Resources、Registration、Schedule、News、Contact Us；Login 为独立账户入口。页脚重复俱乐部简介、联系信息、Sitemap、教练、资源、报名和社交链接。

| 栏目 | 已观察的内容和功能 | 迁移关注点 |
| --- | --- | --- |
| 首页与 About Us | AGM 公告、董事提名、营养资料、课程入口、董事及岗位目录 | 保留栏目归属和入口，统一岗位联系方式 |
| Our Programs | Learn to Skate、Junior Academy、STAR 1至10、Competitive | 保留课程分类与进阶说明 |
| Our Coaches | 18 位教练的照片、联系信息、资质、经验、专长等 | 保留独立资料结构与私教联系入口 |
| Club Resources | 资源首页及 12 个政策或程序子页面 | 保留层级、政策版本及确认记录 |
| Registration 与 Synchro | 搜索、筛选、排序、列表和日历、详情、Register | 保留熟悉的查课和报名顺序 |
| Fall 与 Summer | 学期、项目、价格、折扣、分期、视频、课表附件 | 核对季节和定价，以确认后的规则迁移 |
| Schedule 与 News | 课表图片；新闻及归档框架 | 保留两个独立栏目，处理过期或空内容 |
| Products 与 Subscriptions | 24 项收费或商品；年度会员费 | 保留数量、价格、售罄、购买与适用选手等语义 |
| Login 与 Forgot Password | 登录、创建账号、邮件偏好、找回密码 | 旧账号迁移及新旧身份关联待确认 |
| Volunteer 与 Contact | 登录限制；姓名、邮箱、部门、留言及验证码 | 志愿业务细节和联系邮件投递待核验 |

Club Resources 子页面为 Club Structure、Registration and Payment、Payment Terms、Publicity Release、Privacy Policy、Confidentiality、Code of Conduct and Ethics、Inclusion Policy、Safe Sport Policy、General Dispute and Resolution、其下的 Procedure，以及 Mobile Device Policy。

## 3 收费业务与附件依赖

课程收费之外，系统包含 2 项测试收费、2 项俱乐部内外临时上冰收费、5 项同步滑承诺费，以及 15 项服装或刺绣商品。年度会员页另列 2026/2027 Skate Canada Membership，公开标价 CA$65.70。这些数字是核查日的页面快照，不是永久价格配置。

公开说明还涉及家庭折扣、多课折扣、Team Training 条件价格、按比例收费、固定期数分期、换课以及账户余额抵扣。具体组合优先级、资格及计算方式必须和实际配置核对。私教、Paul 磨刀服务、City ticket ice 有各自联系或付款安排，不能默认由 HSC 统一收款。

| 附件 | 页数 | 迁移处理 |
| --- | --- | --- |
| 董事提名表 | 2 | 保留表单和提交渠道；数字化申请属于后续另定范围 |
| 董事职责与确认书 | 2 | 保留版本、署名及签名用途 |
| 秋季 2026 冰上及陆地课表 | 1 | 保留下载及原栏目位置，核对休冰日和项目条件 |
| 暑期 2026 晚间课表 | 1 | 与网页金额存在冲突，需确认有效版本 |
| High Performance Nutrition Foundations | 53 | 保留作者和原始学习资料 |
| Fueling Young Athletes | 43 | 保留作者和原始学习资料 |

Safe Sport 的 6 个 SharePoint 文档均跳转 Microsoft 登录，未取得正文。Skate Canada 包容政策索引可访问；旧 Safe Sport 文章和 skate-safe.ca 访问失败。Skate Ontario 日历可读，两场历史赛事详情本轮请求失败，不能据此判定永久失效。Facebook 和 Instagram 只核对公开入口。

协会自己的登记和比赛报名平台属于外部业务。HSC 官网与自身收费可以迁出 Uplifter，但不能替协会更换 SkateReg 等指定入口；收取协会年费也不等于已完成协会登记。

## 4 需确认和修正的问题

下列项目是内容或配置冲突。新版应记录原值、确认人和生效版本，再更新；不以“保持原样”为由复制已确认错误，也不由开发人员自行决定价格或政策。

| 编号 | 发现 | 影响与确认事项 |
| --- | --- | --- |
| F01 | 暑期 GroupStar 网页 CA$175与260，PDF CA$200与300 | 确认同季有效价格及单课双课适用规则 |
| F02 | Synchro 报名标题 STAR 3，详情写 STAR 6；定金说明也需对齐 | 确认队伍、费用阶段、已付定金抵扣方式 |
| F03 | STAR 6至Gold 商品 CA$20，正文首项 CA$12加5 | 确认测试费、招待费、额外测试费构成 |
| F04 | 付款政策不接受现金，测试商品说明仍接受现金 | 财务确认统一收款方式和期限 |
| F05 | Publicity Release 只有模板占位文字 | 补齐正式条款；不能推断会员已同意 |
| F06 | 新闻页空白，Schedule 仍为冬春 2026，首页有历史赛事 | 保留栏目，确认当前内容与归档内容 |
| F07 | 9 处显示邮箱和 mailto 目标不同，部分岗位姓名不一致 | 确认是否为别名或旧联系人，再修正 |
| F08 | GroupStar 与 Intro to Figure Skating 名称或门槛不一致 | 确认更名、生效季节和 Stage 条件 |
| F09 | June 31st、2026至2037 等日期文字异常 | 核对正式付款截止和赛季 |
| F10 | 多个外部政策目标需登录或访问失败 | 取得可用的官方入口或允许发布的文件 |
| F11 | 通用横幅与空白较大，部分信息依赖课表图片 | 可改善尺寸、排版与可读性，保持信息归属和操作位置 |

已核查页面：[商品](https://hamiltonskating.uplifterinc.com/registration/products/)、[暑期说明](https://hamiltonskating.uplifterinc.com/registration/2025-2026-registration-information/summer-2026/)、[付款条款](https://hamiltonskating.uplifterinc.com/club-resources/payment-terms/)、[宣传授权](https://hamiltonskating.uplifterinc.com/club-resources/publicity-release/)。

## 5 迁移判断和待补资料

迁移需承接公开内容、家庭与选手关系、课程班次、报名和候补、订单及支付、信用余额、未结分期、商品、政策确认、邮件偏好和后台权限。旧 ID、订单编号和原支付渠道应可追溯；保存银行卡须由支付商安全转移或由会员重新绑定，普通会员 CSV 不能替代卡资料迁移。

支付方案尚未选定。Stripe 和 Square 是已研究候选；2026年11月18日公开加拿大线上本地卡基础费率分别为 2.9%加CA$0.30 和 2.8%加CA$0.30。单笔 CA$500 的示例费用分别为 CA$14.80 和 CA$14.30，未计附加服务、国际卡等费用。Stripe Billing、PAD 和 Square 保存卡另有计价与流程。Non-profit 身份不自动获得捐款优惠。实施时重新核实服务条件及 HSC 合同。

待取得的资料包括后台只读访问或脱敏流程演示、会员与财务导出样本、套餐与合同、商户账户归属、未结分期和余额、课程容量、税费与收据配置、协会登记方式。拿到这些资料后才能关闭功能等价与财务迁移的核验项。

已确认产品原则为保留原网站结构、功能和主要使用流程，重点更新外观；在现有 HSC 应用上扩展。此前建议中的栏目合并、流程重排、技术品牌和新增功能，均不自动成为实施要求。具体要求见配套 PRD。

参考来源：[Uplifter Club 1.0 报表](https://learn.uplifterinc.com/hc/en-us/articles/115015338867-Reports-on-Club-1-0)、[支付商说明](https://learn.uplifterinc.com/hc/en-us/articles/55782413740051-Payment-processors-and-merchant-accounts)、[Stripe 定价](https://stripe.com/en-ca/pricing)、[Square 定价](https://squareup.com/ca/en/payments/our-fees)、[Stripe 卡资料迁移](https://docs.stripe.com/get-started/data-migrations/pan-import)、[Stripe 非营利优惠](https://support.stripe.com/questions/fee-discount-for-nonprofit-organizations)、[Skate Canada 运营指南](https://info.skatecanada.ca/index.php/en-ca/guides/16-club-and-skating-school-operations-guide.html)。

本地完整证据：`work/portal-inventory-2026-11-18/deep-review/HSC-full-migration-review-2026-11-18.html`；页面记录 `pages.json`、`cookies.json`；附件记录 `attachments.json` 及 `pdf/`。这些是核查快照，不含后台会员资料。
