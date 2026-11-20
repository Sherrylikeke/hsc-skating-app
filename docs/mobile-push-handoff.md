# 手机推送实施交接

2026-11-20。用户要求确认可行步骤并另开会话实施；每个小任务验证后立即commit、push，给出SHA并明确提醒“可以compact”。先读AGENTS.md和docs/project-note.md，再核对远端、工作区、Sites真实部署，不能把源码同步当上线。

## 优先路线及用户需要做的事

优先为当前HSC网站实现标准Web Push，复用既有官方更新outbox。iPhone/iPad需要iOS/iPadOS 16.4或更新版本、先添加到主屏幕、从主屏幕打开，再由用户主动点击“启用手机通知”并允许系统提示；这条路线不需要Apple Developer Program会员或先上架App Store。Android按浏览器实际能力检测显示开关。后台消息是远程推送，现有原生本地提醒不能代替它。

用户最后需在自己的手机上完成通知授权，以及锁屏/关闭网页/点击通知回到比赛的真实验收。自动同步仍按原小时任务运行，不承诺官网发布后立刻推送或手机精确到分钟送达。

## 分成独立提交的小任务

1. 核对部署和架构，确认现有manifest/service worker以及Sites Worker的出站推送能力；确定VAPID和标准Web Push兼容实现。只在服务端安全配置中保存私钥，不入Git或客户端，不新建付费服务。
2. 增加按当前账号/设备隔离的订阅与取消接口、追加式D1迁移、前台通知开关与PWA安装指引。只由真实用户手势申请浏览器权限，支持拒绝/撤销及不支持状态，不自动给任何人订阅。
3. 接入现有official-update持久投递链路：按当前My Skaters/账号有效状态再次核对，保留去重和重试，清理失效订阅。退订、退出、换账号和移除选手后不得继续泄漏旧账号消息。锁屏内容默认简短，不发送私人教练备注。通知点击回到相应比赛并经过正常登录/权限检查。
4. 完成隔离API、投递适配器及手机浏览器回归，覆盖跨账号、失败重试、重复变更、撤权和深链。按当前Sites技能准备可审查版本并发布同一站点，保留当前受众和原每小时任务；不新增heartbeat。只对用户主动授权的测试设备验证真实推送，不向会员群发测试消息。
5. 用户手机进行前台/后台/锁屏/关闭网页及点击通知验收，记录实际结果和限制。模拟成功不能写成真实手机送达。

每一步是一个可恢复的小任务：必要验证、commit、push、更新Note、给SHA并说可以compact；不要等整个推送功能结束才集中提交。需要用户操作时先完成不依赖它的可验证工作。

## 当前代码和部署边界

- GitHub为https://github.com/Sherrylikeke/hsc-skating-app.git。交接前远端main为f36e30ab98600f01ed110a43eec79db260e95162，包含尚未部署的portal v1、R2 BUCKET声明及0008迁移；此前0006/0007及日历/准备/订阅也有待发布范围。不要直接把整条main部署而顺带上线这些功能。
- 上一次明确验证的线上基线为2026-11-18 V53，Sites项目appgprj_6ad76ca2dba481919ba883865cbd5a0d，运行源码daded9fc1aeee6e7255d0c80257a52e161b7e375，网站https://hamiltonskatingclub.memberportal.dev/。新会话必须重新读取Sites；这些是历史记录，不代表11月20日实时状态。
- 原每小时任务Automation_a2b3ae8946b48191937bd484365e1ec2。11月18日已观察真实无人值守轮次；Niagara当时83/83份正式名单、579报名、23位关联选手、74时段。现有小铃铛是站内通知，尚无系统远程推送。
- 原生capacitor/有@capacitor/local-notifications，没有远程push插件。未来原生阶段在既有mobile/capacitor分支实施：iOS需Mac/Xcode、签名团队、Push Notifications capability和APNs服务端配置；Android需Firebase/FCM。原生凭据和设备验收另行处理，不在本阶段擅自注册付费账号。
- 原工作区及本次隔离工作树存在21份既有PDF删除；只提交本任务指定文件，不restore/stash/add --all这些删除。

## 官方参考（2026-11-20核对）

- [WebKit：iOS/iPadOS主屏幕Web Push、权限及无需Apple Developer会员](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Apple：Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [Capacitor v8原生Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
