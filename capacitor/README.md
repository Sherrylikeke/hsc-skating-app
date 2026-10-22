# HSC Capacitor

本地静态客户端，复用 `app/` React 组件和原私人站点 API。实现和配置见 [中文实施说明](../docs/capacitor.md)。

先安装仓库根依赖，再在本目录执行：

```powershell
npm.cmd ci
npm.cmd run build
node scripts/check.mjs
node node_modules/@capacitor/cli/bin/capacitor sync
```

`dist/` 只包含浏览器资源。原站点目前为 owner-private，手机端未取得独立托管访问通道；本地构建成功不代表生产登录已打通。不要在客户端配置 Sites 服务令牌。
