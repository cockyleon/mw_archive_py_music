# MakerWorld 本地归档小应用

集成采集/归档、API、前端页面、Docker 部署。

## 目录结构
- `config.json`：基础配置（下载目录、cookie 文件、日志目录）
- `cookie.txt`：存放最新 Cookie（手动或 API 设置）
- `logs/`：日志目录（`app.log`、`missing_3mf.log`、`cookie.log`）
- `data/`：默认下载目录，每个模型一个 `MW_*/` 子目录，包含 `meta.json/index.html/images/instances`
- `server.py`：FastAPI 入口
- `archiver.py`：采集/归档核心逻辑
- `templates/`：前端页面（gallery/config）
- `requirements.txt`：依赖

## 启动（本地）
```bash
cd app
python -m venv .venv
. .venv/Scripts/activate  # Windows
pip install -r requirements.txt
python server.py  # 默认 0.0.0.0:8000
```
浏览器打开：http://localhost:8000 （模型库）或 http://localhost:8000/config （配置/归档）。

## API
- `POST /api/cookie`  `{ "cookie": "..." }`
  - 写入 cookie.txt，返回 `{status, updated_at}`
- `POST /api/archive` `{ "url": "模型地址" }`
  - 使用当前 Cookie 和下载目录归档模型，返回 `{status, base_name, work_dir, missing_3mf}`
- `GET /api/config`  -> 下载目录、日志目录、cookie 文件与更新时间
- `GET /api/logs/missing-3mf` -> 缺失 3MF 记录列表
- `POST /api/logs/missing-3mf/redownload` -> 读取缺失记录，使用最新 Cookie 重新获取下载地址并补下 3MF
- `POST /api/instances/{inst_id}/redownload` -> 指定实例 ID，扫描已下载模型，重新获取原始下载地址并覆盖本地文件
- `POST /api/models/{model_id}/redownload` -> 指定模型 ID（目录 MW_{id}_*），遍历该模型的全部实例 apiUrl 重新下载
- `GET /api/gallery` -> 扫描下载目录下 `MW_*/meta.json`，返回模型简表

## 前端
- `/config`：
  - 配置 Cookie（包含 cf_clearance 等）、显示下载/日志目录
  - 输入模型链接一键归档，实时日志，缺失 3MF 列表
- `/`：模型库，基于下载目录下的 meta.json 渲染，支持搜索/点击打开

## 缺失 3MF 记录
- 采集阶段若实例未拿到 downloadUrl，则写入 `logs/missing_3mf.log`，状态标记 `cookie失效`。
- 页面 `/config` 中展示该列表，便于判断 Cookie 失效。

## Cookie 提示
- 请从模型详情页请求里复制完整 Cookie（包含 cf_clearance 等防护字段），粘贴到配置页或调用 `/api/cookie`。

## Docker 部署
示例 `Dockerfile` 已提供，构建 & 运行：
```bash
cd app
docker build -t mw-archiver:latest . 
docker run -d \
  -p 8000:8000 \
  -v $PWD/data:/app/data \
  -v $PWD/logs:/app/logs \
  -v $PWD/cookie.txt:/app/cookie.txt \
  --name mw-archiver mw-archiver
```
- 修改 `config.json` 或通过挂载文件/卷调整下载目录、日志目录、cookie 文件路径。

docker build -t <镜像名称>:<版本标签> .

## 是否需要数据库？
当前场景文件化足够（meta.json + 日志）。若接入 MySQL，可扩展：
- `models` 表：id/base_name/title/tags/path/timestamps
- `instances` 表：实例详情、3MF url、盘数、耗材
- `logs` 表：采集日志与缺失 3MF 记录
但现阶段无需数据库即可满足需求。
