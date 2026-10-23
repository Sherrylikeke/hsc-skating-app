param(
    [Parameter(Mandatory=$true)][string]$ToolchainRoot,
    [string]$OutputDirectory='',
    [switch]$SkipWebBuild
)
$ErrorActionPreference='Stop'
$ToolchainRoot=[System.IO.Path]::GetFullPath($ToolchainRoot)
if ($OutputDirectory) {$OutputDirectory=[System.IO.Path]::GetFullPath($OutputDirectory)}
$clientRoot=Split-Path -Parent $PSScriptRoot
$settings=Get-Content -LiteralPath (Join-Path $ToolchainRoot 'toolchain.json') -Raw | ConvertFrom-Json
$variables=@('JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','ANDROID_SDK_HOME','GRADLE_USER_HOME','ANDROID_USER_HOME','ANDROID_PREFS_ROOT','PATH')
$previous=@{}
foreach ($variable in $variables) {$previous[$variable]=[Environment]::GetEnvironmentVariable($variable,'Process')}
try {
    if (-not (Test-Path -LiteralPath (Join-Path $settings.jdkHome 'bin/java.exe'))) {throw 'Portable JDK is missing.'}
    if (-not (Test-Path -LiteralPath (Join-Path $settings.sdkRoot 'platforms/android-36/android.jar'))) {throw 'Android SDK platform 36 is missing.'}
    $env:JAVA_HOME=$settings.jdkHome
    $env:ANDROID_HOME=$settings.sdkRoot
    $env:ANDROID_SDK_ROOT=$settings.sdkRoot
    $env:GRADLE_USER_HOME=$settings.gradleUserHome
    $env:ANDROID_USER_HOME=$settings.androidUserHome
    $env:ANDROID_PREFS_ROOT=$null
    $env:ANDROID_SDK_HOME=$null
    $javaUserHome=Join-Path $ToolchainRoot 'java-user'
    New-Item -ItemType Directory -Path $javaUserHome -Force | Out-Null
    $env:PATH=(Join-Path $env:JAVA_HOME 'bin')+';'+(Join-Path $env:ANDROID_HOME 'platform-tools')+';'+$env:PATH
    Push-Location $clientRoot
    try {
        if (-not $SkipWebBuild) {
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) {throw 'Static client build failed.'}
            & node scripts/check.mjs
            if ($LASTEXITCODE -ne 0) {throw 'Client regression checks failed.'}
            & node node_modules/@capacitor/cli/bin/capacitor sync android
            if ($LASTEXITCODE -ne 0) {throw 'Android sync failed.'}
        }
        Push-Location (Join-Path $clientRoot 'android')
        try {
            & .\gradlew.bat ':app:assembleDebug' ':app:lintDebug' ('-Duser.home='+$javaUserHome) '-Pkotlin.compiler.execution.strategy=in-process' '--stacktrace' '--no-daemon' '--no-watch-fs' '--max-workers=2' '--console=plain'
            if ($LASTEXITCODE -ne 0) {throw 'Android build or lint failed.'}
        } finally {Pop-Location}
        $apk=Join-Path $clientRoot 'android/app/build/outputs/apk/debug/app-debug.apk'
        & (Join-Path $env:ANDROID_HOME 'build-tools/35.0.0/apksigner.bat') verify --verbose --print-certs $apk
        if ($LASTEXITCODE -ne 0) {throw 'APK signature verification failed.'}
        $metadata=& (Join-Path $env:ANDROID_HOME 'build-tools/35.0.0/aapt2.exe') dump badging $apk
        if ($LASTEXITCODE -ne 0 -or -not ($metadata -match "^package: name='ca[.]hsc[.]skating' ") -or -not ($metadata -match "^minSdkVersion:'24'") -or -not ($metadata -match "^targetSdkVersion:'36'")) {throw 'Unexpected APK application id or SDK compatibility.'}
        $metadata | Select-String -Pattern '^package:|^minSdkVersion:|^targetSdkVersion:|^application-label:|^launchable-activity:'
        if ($OutputDirectory) {
            New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
            $delivered=Join-Path $OutputDirectory 'HSC-Capacitor-debug.apk'
            Copy-Item -LiteralPath $apk -Destination $delivered -Force
            Get-FileHash -LiteralPath $delivered -Algorithm SHA256
        }
    } finally {Pop-Location}
} finally {
    foreach ($variable in $variables) {[Environment]::SetEnvironmentVariable($variable,$previous[$variable],'Process')}
}
