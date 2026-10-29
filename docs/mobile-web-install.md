# 手机网页安装与 Android 安装包

原站点：https://hsc-coach-roster.sherrylikeke.chatgpt.site/

用户提到此前手机浏览器自动提示安装。从这种入口安装的是浏览器管理的网页应用/桌面入口；它与会话交付的 Android APK 属于两种安装方式，不能把 APK 已构建误称为网页入口已更新。

Android Chrome 可打开站点，点右上角更多菜单，选择“安装并创建快捷方式”或“添加到主屏幕”，再点“安装”。菜单名称可能随 Chrome 版本变化，不必等待自动提示。若已经有该网页应用图标，可先关闭后重新打开或刷新以重新读取网页。原站点没有注册离线 Service Worker，不承诺离线访问或自动弹窗一定出现。

手机响应式布局从 mobile/capacitor 的 840d070 同步三份共享界面文件到网页主线：club-app.tsx、club-mobile.css、layout.tsx。720px 以下显示赛程卡片、短导航及折叠筛选；网页与主屏幕入口共同读取同一部署。APK 1.1 文件仍在会话 outputs/mobile-v1.1，未上传公开网页供下载；用户选择网页安装时无需另传 APK。

登录使用已建立的 HSC 邮箱/用户名和密码。原管理员尚未关联密码时先走原可信身份关联流程，不因安装应用新增管理员或放宽账号权限。安装图标不等于完成注册，安装方式不授予私人关系。

官方操作说明：[Google Chrome：使用 Web 应用](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=zh-Hans)。
