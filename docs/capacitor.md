# HSC Capacitor 实施与技术配置

日期：2026-10-22。沿用原 Sites 项目、私人站点、Worker/D1 和私人 GitHub；原 Expo `mobile/` 保留回退。

## 1. 本地客户端与静态构建

新增 `capacitor/`，独立 Vite 入口是 `src/main.tsx`。直接复用 `app/member-app.tsx`、`club-app.tsx`、`coach-editor.tsx`、主页多选手、提醒和验证界面，以及现有样式/语言模块。组件不复制，修改后 Web 与手机同步获得业务修正。

Capacitor core/CLI/Android/iOS 固定 8.5.3；插件版本由本目录 `package-lock.json` 锁定。React 与仓库保持 19.2.6，通过 Vite alias/dedupe 避免重复 React。

`capacitor.config.ts`：appId 为 `ca.hsc.skating`，appName 为 `HSC Skating`，webDir 为 `dist`；Android 来源为 `https://localhost`，iOS 为 `capacitor://localhost`。未配置远站 `server.url`。项目只输出 HTML/CSS/JS，服务端路由、Worker、D1、密钥均留在服务器；回归会扫描 JS 包排除服务端代码和密钥配置名。Cloudflare 类型声明只参加类型检查，不成为手机运行时。

已有根依赖后，在 `capacitor/` 执行：

```powershell
npm.cmd ci
npm.cmd run build
node scripts/check.mjs
node node_modules/@capacitor/cli/bin/capacitor sync
```

原生工程 `android/`、`ios/` 已生成；重复构建使用 sync，不重复 add。纯静态浏览器预览用于界面检查，不能直接运行服务器 API；没有后端时显示连接/访问授权提示。

## 2. API、令牌与私人托管边界

共享适配层 `lib/client-platform.ts` 接入所有现有客户端请求。Web 保持原同源 fetch；原生使用显式 `CapacitorHttp.request`，未全局改写 fetch。原生目标只允许原站点的 `/api/`，拒绝路径穿越和其他主机，禁止跟随重定向，超时为连接 15 秒、读取 30 秒。API 地址是公开配置，不是密钥；本次刻意不提供任意服务器地址输入，以免令牌泄露到误填主机。

原生请求携带固定服务器 Origin 和 Better Auth 返回的已签名 bearer。Origin 是浏览器写入防护的一部分，不能作为原生应用身份；真正权限仍由服务器验证签名会话、角色、状态和批准关系。浏览器不能任意伪造 Origin，跨源写入/CSRF 校验没有删除，也没有增加通配 CORS。

仅保存 `set-auth-token` 签名令牌，不保存密码或登录 JSON 中的原始 token。使用 `@aparajita/capacitor-secure-storage`：iOS Keychain（whenUnlockedThisDeviceOnly、关闭 iCloud 同步），Android Keystore AES-GCM。浏览器预览不调用插件的 localStorage 实现。令牌只在内存和系统安全存储中；源码、聊天、构建包均无真实凭据。

退出时先清内存，再串行清安全存储、待发/已显示通知和导出缓存。即使服务端 sign-out 网络失败也清本机数据；并发登录响应不能在退出后恢复令牌。API JSON 401 清本机会话并回登录页；HTML 401 被识别为平台网关错误，不误判成应用密码错误。原生启动清编辑草稿，避免账号串用；不持久缓存私人档案。

**实际接入检查：2026-10-22 对原站点无凭据 GET 返回 HTTP 401、Content-Type text/html。Sites owner-private 外层网关先于应用登录；Better Auth 账号不能解锁它。** 官方 Sites 身份说明只提供浏览器顶层登录或服务访问；服务令牌不能写入手机包。当前未取得可面向独立手机客户端的受支持平台访问通道，因此生产手机登录尚未验收。保留现有私人范围，后续需解决平台支持的客户端接入；不能靠公开站点、复制浏览器 Cookie、嵌入服务令牌或删除来源校验解决。

## 3. 路由、返回与邮箱验证深链

手机入口复用 `/`、`/workspace`、`/coaches`、`/verify-email`。本地链接在 WebView 内更新 history；Android 返回先关闭对话框，再返回历史，无历史时回主页或收起应用。外部 HTTPS 官方来源通过系统浏览器打开，不附加应用令牌；javascript 等协议不执行。

Android Manifest 与 iOS Info.plist 注册 `hscskating://verify-email`。处理冷启动和运行中的 appUrlOpen，只接收验证结果路径；不接收会话、密码或验证 token。邮件仍走原服务器一小时签名链接及 HTTPS 回调；验证网页增加“打开 HSC 应用”按钮。返回应用只引导重新登录，最终 emailVerified 状态始终由服务器决定，验证结果不授予角色/关系。

真实邮件服务尚未配置，本轮未发送真实邮件。现有邮箱/用户名登录和所有者恢复路径保留；邮件配置前新自助注册继续暂停。服务端键仍为 `RESEND_API_KEY`、`HSC_EMAIL_FROM`、`HSC_EMAIL_VERIFICATION_ENABLED`，只通过安全配置入口设置，不放入手机端环境变量。

## 4. 下载、提醒与权限隔离

CSV 继续使用现有列与公式注入防护；Web 使用下载链接，原生使用 Filesystem Cache + 系统分享面板，可保存到文件或分享。Android FileProvider 只暴露 `hsc-exports/` 缓存子目录，关闭系统备份和明文 HTTP；启动/退出清理临时导出。外部官方 PDF 在浏览器中下载，不把私人令牌附加到官方 URL。

本机提醒由服务端已授权 ReminderPlan 生成；只接收当前 memberId、明确 official-group-start、未来提醒、提前至少 60 分钟到场且提醒至少早于到场 60 分钟的计划。上限最近 60 条，按计划 ID 去重。保存规则/刷新/重新启动/前台恢复重新核对，旧版本先取消；退出清除待发和已显示提醒。账号主页选手偏好仍由服务器按 member_id 保存，不参与私人授权。

首次授权通过提醒页“启用此手机的本机提醒”按钮。自动刷新仅检查既有通知权限，不主动弹权限框。使用 inexact 本机通知，显式关闭插件默认精确闹钟，移除 SCHEDULE_EXACT_ALARM，避免刷新自动跳系统设置；省电策略可能延迟，不能承诺分秒送达。应用关闭后不会实时获得官网修订或远程撤权；重新联网/打开时才取消或重排，因此仍须核对官网。本轮不增加远程推送服务或周期续做任务。

## 5. Android 与 iOS 配置/命令

Android 生成配置为 minSdk 24、compileSdk/targetSdk 36、Gradle 8.14.3；需要 JDK 21、Android SDK 36/build-tools 和测试设备/模拟器。当前本机 Node 24.16.0 满足要求，检测到 Java 8.0.202，未找到 Android SDK/adb。官方设备检测已实际运行，返回 ERR_SDK_NOT_FOUND。尚未生成 APK、安装设备或验收原生通知；SDK 下载与许可接受已提出明确授权请求，未在无答复时自动接受。

工具链配置示例（不含密钥，路径按实际安装调整）：

```powershell
$env:JAVA_HOME='C:\\path\\to\\jdk-21'
$env:ANDROID_HOME='C:\\path\\to\\android-sdk'
$env:GRADLE_USER_HOME=Join-Path (Get-Location) 'work/gradle'
$env:PATH=$env:JAVA_HOME+'\\bin;'+$env:ANDROID_HOME+'\\platform-tools;'+$env:PATH
Set-Location android
.\\gradlew.bat :app:assembleDebug
```

调试 APK 是 `android/app/build/outputs/apk/debug/app-debug.apk`。有设备后运行 `cap run android`；深链可用 `adb shell am start -a android.intent.action.VIEW -d "hscskating://verify-email?verified=1" ca.hsc.skating` 检查。调试构建与正式签名/商店发布分开，签名密钥不入 Git。

iOS 已生成 Xcode + Swift Package Manager 工程并完成 sync，注册 URL scheme，加入 Filesystem C617.1 隐私 API 用途文件并放入 Resources。Windows 不能编译/签名 iOS；后续在 Mac/Xcode 26+ 打开 `ios/App/App.xcodeproj`，设置开发团队后编译和真机测试。商店隐私声明、名称/图标、签名、关联域名和付费账号仍需正式发布阶段核对；本轮未发布商店。

## 6. 本轮验证与发布记录

- Web TypeScript、原 Expo TypeScript 均通过。
- 原 18 组身份/权限/邮箱/多选手/提醒回归通过；测试使用隔离 D1/捕获式邮件，真实发送 0。
- 语言、粘贴、选手历史、官方赛程解析、出场顺序回归通过。
- 新增 9 组客户端回归通过：目标限制、网关错误、签名 bearer、返回/安全来源链接、提醒隔离与取消、HTML 401、会话清除、退出竞态、静态包边界。
- Capacitor 静态生产构建及 Android/iOS sync 通过。浏览器检查登录、中文注册和连接错误提示，未伪造真实账号登录或真机验收。
- 原站点生产构建已通过；最终源码同步、GitHub 推送及私人部署结果在交付记录中补充。

参考：[Capacitor 环境要求](https://capacitorjs.com/docs/getting-started/environment-setup)、[原生 HTTP](https://capacitorjs.com/docs/apis/http)、[App/深链](https://capacitorjs.com/docs/apis/app)、[安全存储插件](https://github.com/aparajita/capacitor-secure-storage)。

