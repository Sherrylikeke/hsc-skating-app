# Web 依赖审计 · 2026-11-08

## 修复结果

Web 锁文件的 `npm audit --omit=dev --package-lock-only` 从 10 项降为 0，`npm audit --package-lock-only` 从 34 项降为 0。React、React DOM 和 RSC 统一为 19.3.1，Next 与 eslint-config-next 为 16.4.5，Vinext 为 1.4.4，Sharp 为 0.35.5，Zod 为 4.6.7。新的 Cloudflare 工具链已使用修复版 Sharp，原有的 Miniflare/Sharp 覆盖已移除。三项窄范围 overrides 分别修正 Drizzle Kit 旧加载器的 esbuild、TypeScript ESLint 使用的 minimatch 和 Satori 使用的 fflate；以后上游依赖范围更新时可逐项撤销并复查。

按锁文件安装后，Web 类型检查、16 个回归脚本（含 26 组会员检查）、生产构建及隔离 workerd/D1 回归通过。原始同哈希 PDF 的测试现明确保存 v3 解析记录，再检查 v4 重解析的时段、日期及版本。另核对 Zod 预览协议的正常与错误输入、Drizzle 迁移检查、ESLint 调用，以及 Chromium/WebKit 共 60 个中英文视图。GitHub 工作流分别检查 Web 功能与完整依赖树，不需要生产凭据。

## 修复前的适用范围

核查基线为 GitHub `main` 的 `a4a6265`、Web 锁文件和本地 Vinext 生产构建。通过构建钩子读取实际写入客户端、SSR 和 Worker 的模块；第二次构建区分了两份 Zod 的来源及 Server Actions 能力。Sites 连接查询原项目返回 `NOT_FOUND`，无法比对当前生产 Worker。下列判断适用于已核验的源码和构建，不是线上事故取证。

| 锁文件发现 | 当前构建与实际影响 |
| --- | --- |
| Next 16.3.4（1 个严重级别的包，11 条公告） | 三条严重公告涉及 Node 版 `next/og`、Next 图片优化的原生 SVG 处理、返回多个 typed array 的 `use cache` 函数。三份产物均无 `next` 包模块。Worker 包含 Vinext 自己的图片处理，未打包 Sharp，构建配置中无 Images 绑定；业务也未定义上述缓存函数或 OG 图片生成。未发现这三条远程代码执行路径。 |
| Sharp 0.35.4、source-map-js 1.2.1、根 Zod 3.25.76（3 高） | 前两者及根 Zod 均未进入三份产物。Worker 中的 19 个 Zod 模块全部来自 Better Auth 私有依赖 4.6.7，已越过该公告修复点 4.6.6。 |
| baseline-browser-mapping、fast-uri、esbuild、Drizzle Kit 和两个 esbuild-kit 包（6 中） | 在三份产物中未见对应包模块。部分是同一 esbuild 问题沿工具依赖链重复计数。主要影响开发工具和构建机；其中 esbuild 开发服务器告警有启用相应服务器的前提。 |
| 完整锁文件另检出的 React 服务端组件（高） | `react-server-dom-webpack@19.2.6` 的服务端实现确实打入 Worker。当前构建生成的能力标记为 `hasServerActions=false`，未打包 Vinext 的 Server Action 执行模块；未发现该拒绝服务公告所需的函数入口。若启用 Server Actions，应重新评估。优先将 React、React DOM 和服务端组件一起升级到兼容的已修复版本（19.2 系列修复点为 19.2.8）。 |

现有证据支持继续受邀测试。下一次依赖维护优先验证 React 三包补丁，然后测试 npm 建议的 Next 16.4.5 及 Sharp 0.35.5 或更高兼容补丁，复核 Miniflare 对 Sharp 的固定覆盖。分别复跑审计、构建、隔离 Worker 登录与权限回归；不要使用强制修复导致 Drizzle Kit 降级。未修改依赖或部署。

上游依据：[Next OG 图片生成](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)、[Next SVG 图片优化](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)、[Next 缓存函数](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr)、[React 服务端函数拒绝服务](https://github.com/facebook/react/security/advisories/GHSA-wx67-qw84-cm4g)、[Zod 公告](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)。

## 历史记录 · Private-test web dependency gate · 2026-10-20

The production-dependency audit reports **9 dependency-tree findings: 1 critical, 2 high, 6 moderate**. Newly added Better Auth, its crypto/session dependencies, the Drizzle runtime and date-fns-tz were not named as vulnerable in this report. This is not a guarantee that they have no vulnerabilities.

The retained Sites starter pins Next 16.3.4. The audit includes [Next ImageResponse/next-og RCE](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) and additional Next cache/image advisories; other high findings concern `sharp` and `source-map-js`. The application runs through the retained Vinext/Cloudflare integration, not `next start`. No OG/ImageResponse, dynamic image-optimization or user-supplied source-map feature was added. This source observation is not a complete runtime reachability/security assessment.

Unrelated framework packages were not force-upgraded, nor was the supported Sites starter integration replaced. **These audit findings remain unresolved and must be reviewed/remediated with compatible maintained versions before opening registration or production member distribution.** The site stays behind its original owner-only hosting boundary, as explicitly requested. Do not treat passing functional tests or private publication as security certification or permission to expose it publicly.

All member routes enforce server authentication and approved skater relationships. Self-registration cannot bootstrap admin, auto-merge with an existing member by email, or read private data merely because a role was requested. Password-account ownership requires an administrator-issued email-bound invitation or explicit dual-session linking. Real password-library and local Worker tests cover signed tokens, hash storage, cross-origin writes, pending scope and revocation.
