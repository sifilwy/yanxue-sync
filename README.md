# 研学现场信息同步系统

这是一个研学现场信息同步 MVP。目标是让教练、老师、导游、督导等人员用手机提交现场问题，后台统一查看、筛选、处理和导出。

当前版本先做“手机填写 + 后台汇总”，暂时不是正式微信小程序上架版。

## 当前线上地址

- 手机填写端：https://yanxue-sync.top/mobile
- 后台汇总端：https://yanxue-sync.top/admin
- API 健康检查：https://yanxue-sync.top/api/health

当前已经绑定域名并启用 HTTPS。旧的 IP 访问仍可用于排查问题。

## 当前功能

- 手机端登录身份：姓名、身份会保存在本机浏览器里，下次打开不用重复填写。
- 手机端提交信息：可选择团期、队伍、环节、分类，填写内容。
- 图片入口：手机端已有图片上传入口。
- 图片保存：图片会保存为服务器文件，后台显示缩略图；点开图片后可查看原图，在手机上可长按保存。
- 标记选项：支持“紧急”和“影响结算”。
- 后台汇总：查看所有提交记录。
- 后台筛选：按团期、身份、类型、状态筛选。
- 分类统计：按分类查看数量。
- 状态流转：未处理、处理中、已处理。
- 导出 CSV：后台可导出记录。
- 基础数据管理：后台可以管理团期、队伍、研学环节、问题分类、人员身份。
- 人员信息：后台有独立界面管理工作人员和参加团员信息。

## 本地开发

先安装依赖：

```powershell
npm.cmd install
```

启动开发环境：

```powershell
npm.cmd run dev
```

本地访问：

- 手机端：http://localhost:5173/mobile
- 后台：http://localhost:5173/admin
- API：http://localhost:4000/api/health

## GitHub 协作

仓库地址：

https://github.com/sifilwy/yanxue-sync

朋友第一次下载：

```bash
git clone https://github.com/sifilwy/yanxue-sync.git
cd yanxue-sync
npm install
npm run dev
```

日常同步：

```bash
git pull
```

改完提交：

```bash
git add .
git commit -m "说明这次改了什么"
git push
```

## 服务器部署

当前服务器是 DigitalOcean Droplet，应用通过 Docker 运行。

当前部署方式：

- 代码目录：`/opt/yanxue-sync`
- 数据目录：`/opt/yanxue-sync-data`
- 图片目录：`/opt/yanxue-sync-data/uploads`
- 容器名：`yanxue-sync`
- HTTPS 容器名：`yanxue-sync-caddy`
- 服务端口：`4000`
- 域名：`yanxue-sync.top`

服务器上可用这些命令查看状态：

```bash
docker ps -a
docker logs --tail=80 yanxue-sync
docker logs --tail=80 yanxue-sync-caddy
```

重新部署的大致流程：

```bash
cd /opt/yanxue-sync
docker build -t yanxue-sync-app .
docker rm -f yanxue-sync 2>/dev/null || true
docker run -d \
  --name yanxue-sync \
  --restart unless-stopped \
  -p 4000:4000 \
  -v /opt/yanxue-sync-data:/app/data \
  -e NODE_ENV=production \
  -e PORT=4000 \
  yanxue-sync-app
```

## 微信小程序状态

当前仓库里有 `miniprogram/` 目录，用于后续做微信小程序 web-view 壳。

正式上传微信小程序前，还需要：

- 注册微信小程序并获取 AppID。
- 准备域名。
- 将域名解析到服务器。
- 配置 HTTPS。
- 在微信公众平台配置业务域名。
- 用微信开发者工具上传审核。

## 下一步建议

优先把当前系统变成小范围稳定试用版：

- 后台加管理员登录。
- 后台可管理团期、队伍、环节、分类。
- 图片上传和后台预览做稳定。
- 清理测试乱码数据。
- 绑定域名和 HTTPS。
