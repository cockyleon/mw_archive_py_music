# MakerWorld 本地归档小应用

![MakerWorld Archive](https://aliyun-wb-h9vflo19he.oss-cn-shanghai.aliyuncs.com/use/makerworld_archive.png)

一个用于归档 MakerWorld 模型到本地的 FastAPI 项目，支持模型采集、离线页面生成、模型库浏览、缺失 3MF 重试，以及浏览器插件一键归档。

## 当前版本
- `v5.0`（2026-03-02）
- 更新说明见 [doc/v5.0_update_log.md](doc/v5.0_update_log.md)

## 核心能力
- 归档模型并落盘为独立目录：`MW_<id>_<title>/`
- 目录内包含：`meta.json`、`index.html`、`images/`、`instances/`
- 复用在线模板生成本地归档页，支持后续统一重建
- 同模型二次归档自动按“更新”处理，避免重复目录
- `meta.json` 增加 `update_time` 字段
- 配置页支持“更新已归档页面”（`/api/archive/rebuild-pages`）
- 缺失 3MF 记录与重试下载
- 模型库页面支持收藏、打印状态、手动导入、附件管理
- Chrome 插件与油猴脚本支持一键归档流程

## 项目结构
```text
0.mw_archive/
├─ app/
│  ├─ archiver.py
│  ├─ server.py
│  ├─ config.json
│  ├─ cookie.txt
│  ├─ data/
│  ├─ logs/
│  ├─ static/
│  └─ templates/
├─ plugin/
│  ├─ chrome_extension/
│  │  ├─ mw_quick_archive_ext/
│  │  └─ 使用说明.md
│  └─ tampermonkey/
│     ├─ mw_quick_archive.user.js
│     └─ 使用说明.md
├─ scripts/
├─ doc/
├─ Dockerfile
├─ docker_build.sh
└─ update.sh
```

## 页面
![主页](doc/screenshot/主页.png)
![模型详情](doc/screenshot/模型详情.png)

## 运行环境
- Python `3.10+`（建议 `3.11`）
- 依赖见 [app/requirements.txt](app/requirements.txt)
- 可选：Docker

## 本地启动
```bash
cd app
python -m venv .venv
# Windows
. .venv/Scripts/activate
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

默认地址：
- 模型库：`http://127.0.0.1:8000/`
- 配置页：`http://127.0.0.1:8000/config`

## Docker 启动
```bash
# 项目根目录执行
bash docker_build.sh

docker run -d \
  --name mw-archiver \
  -p 8000:8000 \
  -v $PWD/app/data:/app/data \
  -v $PWD/app/logs:/app/logs \
  -v $PWD/app/cookie.txt:/app/cookie.txt \
  mw-archiver:latest
```

## 配置说明
配置文件为 [app/config.json](app/config.json)：
```json
{
  "download_dir": "./data",
  "cookie_file": "./cookie.txt",
  "logs_dir": "./logs"
}
```

## 常用流程
1. 在 `/config` 设置 Cookie（或调用 `POST /api/cookie`）。
2. 在 `/config` 输入模型链接执行归档（或调用 `POST /api/archive`）。
3. 若同模型再次归档，系统自动执行更新。
4. 归档历史样式升级时，点击“更新已归档页面”或调用 `POST /api/archive/rebuild-pages`。
5. 在 `/` 模型库查看、筛选、标记和打开本地模型页面。

## API 清单
- `GET /api/config`
- `POST /api/cookie`
- `POST /api/archive`
- `POST /api/archive/rebuild-pages`
- `GET /api/logs/missing-3mf`
- `POST /api/logs/missing-3mf/redownload`
- `DELETE /api/logs/missing-3mf/{index}`
- `GET /api/bambu/download/{hex_path}.3mf`
- `POST /api/instances/{inst_id}/redownload`
- `POST /api/models/{model_id}/redownload`
- `GET /api/gallery`
- `GET /api/gallery/flags`
- `POST /api/gallery/flags`
- `POST /api/models/manual`
- `POST /api/models/{model_dir}/delete`
- `GET /api/models/{model_dir}/attachments`
- `POST /api/models/{model_dir}/attachments`
- `GET /api/models/{model_dir}/printed`
- `POST /api/models/{model_dir}/printed`
- `GET /v2/files/{model_dir}`
- `GET /api/v2/models/{model_dir}/meta`

## 插件说明
Chrome 插件：
- 目录：`plugin/chrome_extension/mw_quick_archive_ext`
- 说明：[plugin/chrome_extension/使用说明.md](plugin/chrome_extension/使用说明.md)

油猴脚本：
- 文件：`plugin/tampermonkey/mw_quick_archive.user.js`
- 说明：[plugin/tampermonkey/使用说明.md](plugin/tampermonkey/使用说明.md)

## 脚本说明
- `update.sh`：服务器更新部署脚本，支持 `git pull` 无更新时确认是否继续重部署。
- `scripts/rebuild_index_from_meta.py`：根据 `meta.json` 重建归档页面（兼容场景）。
- `scripts/patch_attachments.py`、`scripts/patch_printed.py`：历史数据补丁脚本。

## 文档目录
- [doc/v5.0_update_log.md](doc/v5.0_update_log.md)
- [doc/v4.5_update_log.md](doc/v4.5_update_log.md)
- [doc/v4.0_update_log.md](doc/v4.0_update_log.md)
- [doc/项目架构与功能文档.md](doc/项目架构与功能文档.md)

## 许可证
MIT
