# Android 精简本地构建

只安装便携 JDK 21、Android SDK Command-Line Tools、`platform-tools`、`platforms;android-36`、`build-tools;35.0.0`；不安装 Android Studio、模拟器或 NDK。AGP 8.13.0 使用 Build Tools 35.0.0；Capacitor 原生编译使用 Java 21。Gradle 8.14.3 使用 `bin` 分发包，并固定官方 SHA-256。

工具仅放在工作目录，构建缓存和 Android 用户目录也指向工作目录。Gradle 还显式设置 `user.home` 为工具目录下 `java-user/`，使旧工具的偏好文件也留在工作目录。SDK 许可必须由用户同意后接受；2026-10-22 用户已明确同意本轮精简下载和 SDK 许可。不要把 SDK、缓存、调试密钥或签名配置加入 Git。

## 工具准备

1. 从 [Adoptium](https://adoptium.net/temurin/releases?version=21) 下载 Windows x64 JDK 21 ZIP，核对官方校验值后解压。
2. 从 [Android 官方下载页](https://developer.android.com/studio#command-line-tools-only) 下载 Command-Line Tools 并校验，解压为 `sdk/cmdline-tools/latest/`。
3. 在当前 PowerShell 进程设置 `JAVA_HOME` 为该 JDK 目录，`ANDROID_HOME` 为 SDK 目录，`ANDROID_USER_HOME` 为工作目录中的 Android 用户目录。通过 `sdkmanager.bat --sdk_root=<SDK目录> "platform-tools" "platforms;android-36" "build-tools;35.0.0"` 安装必要包，按用户授权接受对应许可。
4. 在工具根目录保存不含秘密的 `toolchain.json`。示例路径须替换为实际位置：

```json
{
  "jdkHome": "C:\\HSC-tools\\jdk-21",
  "sdkRoot": "C:\\HSC-tools\\sdk",
  "gradleUserHome": "C:\\HSC-tools\\gradle-cache",
  "androidUserHome": "C:\\HSC-tools\\android-user"
}
```

`ANDROID_USER_HOME` 还会存放自动生成的调试签名密钥；它不是正式发布密钥，不可用于商店正式签名。

## 一条命令构建与验证

在 `capacitor/` 执行：

```powershell
.\scripts\build-android.ps1 -ToolchainRoot '<工具目录>' -OutputDirectory '<交付目录>'
```

脚本依次执行静态生产构建、客户端回归、Android sync、`:app:assembleDebug`、`:app:lintDebug`，然后用 `apksigner verify` 校验签名、`aapt2 dump badging` 核对应用 ID。输出 `HSC-Capacitor-debug.apk` 和 SHA-256。脚本会恢复调用前的进程环境变量，不修改系统 Java、用户 PATH 或系统 SDK 设置。

脚本只使用 `ANDROID_USER_HOME`，临时清除旧 `ANDROID_PREFS_ROOT` / `ANDROID_SDK_HOME`，避免旧变量追加 `.android` 后与新路径冲突。Windows 下关闭 Gradle 文件系统监听，限制为两个工作线程，并设置 `kotlin.compiler.execution.strategy=in-process`，避免本机 Kotlin 守护进程连接失败后的重复等待；不关闭系统安全检查。

只有静态资源已验证且未更改时才使用 `-SkipWebBuild`。该选项不跳过 Android 编译、Lint、签名或应用 ID 校验。

## 验收边界

- 编译、Lint、签名校验与 APK 内容检查不等于设备运行验收。
- `adb devices -l` 仅列出可用设备。实际安装和通知实发需要一台已授权的 Android 设备；本轮不下载模拟器。
- 调试 APK 可用于测试，不是商店发布包；没有正式发布签名或商店上传。
- Android 12+ 明确排除云备份和设备迁移的全部数据域；旧系统使用 `allowBackup=false` / `fullBackupContent=false`。不为解决 Lint 而允许私人数据备份。
- 原私人 Sites 网关仍可能在应用账号登录之前返回 HTML 401。构建成功不会自动解决该访问边界，不能嵌入平台服务令牌或公开站点绕过。

2026-10-22 本机已实际完成调试构建、Lint 与签名校验；自定义 Cookie 桥接类已编译进 APK。本机 Platform Tools 37.0.1 的 `adb version` / `adb devices -l` 无输出退出 1，因此设备发现、安装和真机行为仍未验收。此问题不影响本次已完成的 APK 构建，不通过关闭系统安全功能处理。

参考：[AGP 8.13 兼容表](https://developer.android.com/build/releases/agp-8-13-0-release-notes)、[sdkmanager](https://developer.android.com/tools/sdkmanager)、[Gradle 分发校验](https://docs.gradle.org/current/userguide/gradle_wrapper.html)。
