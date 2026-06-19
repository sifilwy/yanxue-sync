# 研学现场信息同步系统

第一版目标很小：现场人员填信息，后台统一汇总、筛选、导出。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

- 手机端填报原型：http://localhost:5173/mobile
- 后台汇总：http://localhost:5173/admin
- API：http://localhost:4000/api/health

## DigitalOcean 部署

1. 把域名 A 记录指向 DigitalOcean 服务器 IP。
2. 把 `Caddyfile` 里的 `你的域名` 改成真实域名。
3. 在服务器安装 Docker 和 Docker Compose。
4. 上传或拉取项目代码后执行：

```bash
docker compose up -d --build
```

上线后访问：

- `https://你的域名/mobile`
- `https://你的域名/admin`
- `https://你的域名/api/health`

## 第一版功能

- 选择身份、团期、队伍、环节
- 提交现场信息
- 查看自己的提交记录
- 后台查看全部提交
- 按团期、身份、环节、状态筛选
- 标记未处理/处理中/已处理
- 导出 CSV

## 后续扩展

代码先保持简单，但数据模型预留了扩展方向：

- 图片/语音附件
- 微信小程序登录
- AI 自动归类和日报
- 点名、请假、结算影响
- 分团分房、接送站、物料
- PostgreSQL 正式数据库
