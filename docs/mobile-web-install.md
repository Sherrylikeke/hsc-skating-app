# 手机网页安装与 Android 安装包

当前网址：https://hamiltonskatingclub.memberportal.dev/

原网址继续保留：https://hsc-coach-roster.sherrylikeke.chatgpt.site/

用户提到此前手机浏览器自动提示安装。从这种入口安装的是浏览器管理的网页应用/桌面入口；它与会话交付的 Android APK 属于两种安装方式，不能把 APK 已构建误称为网页入口已更新。

Android Chrome 可打开站点，点右上角更多菜单，选择“安装并创建快捷方式”或“添加到主屏幕”，再点“安装”。菜单名称可能随 Chrome 版本变化，不必等待自动提示。若已经有该网页应用图标，可先关闭后重新打开或刷新以重新读取网页。原站点没有注册离线 Service Worker，不承诺离线访问或自动弹窗一定出现。

手机响应式布局从 mobile/capacitor 的 840d070 同步三份共享界面文件到网页主线：club-app.tsx、club-mobile.css、layout.tsx。720px 以下显示赛程卡片、短导航及折叠筛选；网页与主屏幕入口共同读取同一部署。APK 1.1 文件仍在会话 outputs/mobile-v1.1，未上传公开网页供下载；用户选择网页安装时无需另传 APK。

登录使用已建立的 HSC 邮箱/用户名和密码。原管理员尚未关联密码时先走原可信身份关联流程，不因安装应用新增管理员或放宽账号权限。安装图标不等于完成注册，安装方式不授予私人关系。

官方操作说明：[Google Chrome：使用 Web 应用](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=zh-Hans)。

## iPhone / iPad

在 Safari 打开当前网址，点分享，选择“添加到主屏幕”；若出现“Open as Web App / 作为网页 App 打开”选项，保持开启，再点添加。无需等待 Android 式的自动安装提示。现有 manifest 为 standalone；目前没有发布 App Store 原生版或 iOS 安装包。

2026-11-03 手机顶部经 Chromium 与 WebKit 手机浏览器模拟检查：320/375/390/430px 与桌面对照，中英文及家长／管理员视图共 56 个页面；使用隔离 API 测试数据，不读取真实用户会话。它是实际浏览器渲染与手机参数模拟，不是 iPhone 真机或 Xcode 系统模拟器。

复现：在忽略的 work/browser-qa 安装 playwright-core@1.64.1，使用系统 Chrome；WebKit 浏览器缓存也放在该目录。启动本机开发预览后运行 scripts/check-mobile-layout.mjs，HSC_PREVIEW_ORIGIN 指定预览网址；HSC_MOBILE_ENGINE=webkit 可切换引擎，HSC_MOBILE_ROLE=admin 与 HSC_MOBILE_WIDTHS=320,390 为管理员窄屏检查。截图／几何报告写到 HSC_MOBILE_OUTPUT。

Safari 官方说明：[WebKit：主屏幕网页应用](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#every-site-can-be-a-web-app-on-ios-and-ipados)。
