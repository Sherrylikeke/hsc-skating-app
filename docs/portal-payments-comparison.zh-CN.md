# HSC 线上支付方案比较

版本 1.1　核查日期 2026年11月19日　状态 已选择 Stripe Payments 分期实现待定

用户已确认新门户以线上报名付款为主，并选择 Stripe Payments。Stripe 与 Square 的比较保留作为决策依据。现场刷卡设备不作为本次选型的主要依据，原有现金、转账或线下付款确认仍按实际业务核对；报名及财务逻辑继续由 HSC 应用管理。

## 1 选择结论、能力与费用

2026年11月19日用户选择 Stripe Payments，确认了比较阶段的建议；尚未做集成验证。Square 的能力和较低公开费率保留作历史比较，本轮不接入。选择 Stripe 不自动启用 Billing，也不等于批准新商户开户；分期实现方式与预算另定。

| 比较项 | Stripe | Square |
| --- | --- | --- |
| 现有网站接入 | Checkout 提供嵌入式表单及 Elements，可保留自有报名页面 | Web Payments SDK 采集支付信息，后台经 Payments API 收款 |
| 加拿大本地卡线上基础费率 | 2.9%＋CA$0.30／成功付款 | eCommerce 与 Subscriptions API 均列为 2.8%＋CA$0.30／笔 |
| 托管周期收费 | Billing 按用量方案另收 Billing 交易额的 0.7% | 官方订阅 API 定价表采用上述订阅费率；仍须核对实际商户合同 |
| 有限期收费 | Subscription schedules 可配置阶段及结束后取消 | 订阅阶段可设置周期数；最终阶段不设周期数会持续收费 |

接入能力依据：[Stripe Checkout](https://docs.stripe.com/payments/checkout)、[Square Web Payments SDK](https://developer.squareup.com/docs/web-payments/overview)。有限期规则依据：[Stripe schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules)、[Square phases](https://developer.squareup.com/docs/subscriptions-api/plans-and-variations)。两者都需要用真实 HSC 期数、金额、结束日期和换课样本验证，不把固定学期分期改成无限续订。

| 示例，全部以加元计 | Stripe | Square |
| --- | --- | --- |
| 单次收 CA$500 | 500×2.9%＋0.30＝14.80 | 500×2.8%＋0.30＝14.30 |
| CA$1,000 分四次，每次 CA$250 | 支付手续费 30.20；若全部使用 Billing，再加 7.00，合计 37.20 | 按订阅 API 列示费率，4×（250×2.8%＋0.30）＝29.20 |

以上假设加拿大商户、本地卡、加元结算、全部付款成功，未计税费、国际卡、汇兑、争议、额外产品及开发维护费用，也不代表 HSC 实际报价。[Stripe 加拿大定价](https://stripe.com/en-ca/pricing)、[Square API 定价](https://developer.squareup.com/docs/payments-pricing)。Square 通用费率页另列手工／保存卡费率；本表使用更具体的线上及订阅 API 口径，不能混用不同收款渠道。[Square 通用说明](https://squareup.com/ca/en/payments/our-fees)。

## 2 分期、退款与迁出 Uplifter

分期方式另选。Stripe 可通过保存支付方式后再次扣款，或使用 Billing 管理周期收费。前者需要我们维护扣款调度、有限期停止、失败重试及提醒；后者增加服务费，仍需处理报名、名额和余额。两者都必须取得对应的扣款授权并保存记录。[Stripe 后续扣款说明](https://docs.stripe.com/payments/save-and-reuse)。

建议在能保持原分期金额、日期及结束规则的前提下，优先评估 Billing，以减少扣款调度及失败重试的维护；这是待选建议。Billing 支持自动重试，但缺少支付方式或部分拒付原因仍需人工／用户处理，不能承诺自动收回所有欠款。[Stripe 重试说明](https://docs.stripe.com/billing/revenue-recovery/smart-retries)。是否采用及费用仍待用户确认，不修改原站分期规则。

退款会影响真实运营成本。Stripe 标准卡支付退款不另收费，但原处理费不退；Square 退款也不退原处理费。部分退款、退款后的剩余分期和名额如何处理，须以 HSC 原规则及财务样本确认。[Stripe 退款费用](https://stripe.com/en-ca/pricing)、[Square 加拿大退款说明](https://squareup.com/help/ca/en/article/6116-process-refunds)。

Non-profit 身份不等于支付优惠。Stripe 的该项优惠要求至少 80% 交易额来自可抵税捐款；会员费、课程费和报名费不计入门槛。因此本次按标准费率比较，不把滑冰报名当作捐款。[Stripe 非营利条件](https://support.stripe.com/questions/fee-discount-for-nonprofit-organizations)。

| 迁移与验收项 | 要求 | 当前状态 |
| --- | --- | --- |
| 收款归属 | 商户与结算账户归 HSC；Board 财务权限及交接清楚 | 现商户、合同和权限待核对 |
| 银行卡迁移 | 由旧支付商与新支付商安全转移，或家长重新绑定；会员 CSV 不含可迁移银行卡凭据 | 无后台权限，不能承诺无感迁卡 |
| 剩余分期 | 对齐总额、已付、欠款及未来期次；同一笔款只由一处执行扣款 | 待脱敏导出及迁移演练 |
| 报名与付款一致 | 服务端确认付款结果；重复、延迟、失败和退款通知均可核对，不超卖或重复入班 | 待实现与测试 |
| 旧订单退款 | 保留原支付渠道、订单映射和所需退款访问；不能把新支付商退款接口用于旧渠道交易 | 待合同和退出方案确认 |

Uplifter 官方说明其支付商因平台及合同而异；该文不能确定 HSC 当前用哪一家。Stripe 提供支付资料导入流程，也区分跨支付商迁移、Stripe 账号间转移和订阅迁移；是否适用于 HSC，取决于旧商户归属及对方配合。Square 的旧卡导入可行性本轮未核实，保留重新绑卡预案。[Uplifter 支付商说明](https://learn.uplifterinc.com/hc/en-us/articles/55782413740051-Payment-processors-and-merchant-accounts)、[Stripe 支付资料迁移](https://docs.stripe.com/get-started/data-migrations/pan-import)。

支付服务商已确认 Stripe Payments，下一项只确定分期实现方向与费用。当前未创建商户、购买服务、迁移卡资料、取消旧扣款或发起真实支付；Billing 仍为待选方案。
