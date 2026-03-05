#!/usr/bin/env bash

# 脚本说明：
# - 通过 GitHub PR 方式将 dev 合并到 main（不需要切换分支）。
# - 执行前会展示提交差异与文件变更统计，仅一次人工确认后继续。
# - 若已存在 dev -> main 的打开状态 PR，则复用该 PR 直接执行合并。
# - 合并策略使用 merge commit（等价于 gh pr merge --merge）。
#
# 用法：
#   bash scripts/merge2main.sh
#   bash scripts/merge2main.sh --base main --head dev
#
# 依赖：
# - git
# - gh（GitHub CLI，且已登录：gh auth login）

set -euo pipefail

BASE_BRANCH="main"
HEAD_BRANCH="dev"

# 解析可选参数，便于后续复用脚本处理其他分支对。
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      if [[ $# -lt 2 ]]; then
        echo "错误：--base 需要一个分支名参数"
        exit 1
      fi
      BASE_BRANCH="$2"
      shift 2
      ;;
    --head)
      if [[ $# -lt 2 ]]; then
        echo "错误：--head 需要一个分支名参数"
        exit 1
      fi
      HEAD_BRANCH="$2"
      shift 2
      ;;
    *)
      echo "错误：未知参数 $1"
      echo "用法：bash scripts/merge2main.sh [--base main] [--head dev]"
      exit 1
      ;;
  esac
done

# 基础命令可用性检查，避免执行到中途才失败。
if ! command -v git >/dev/null 2>&1; then
  echo "错误：未找到 git 命令"
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "错误：未找到 gh 命令，请先安装 GitHub CLI"
  exit 1
fi

# 确保当前目录在 git 仓库内。
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "错误：当前目录不是 git 仓库"
  exit 1
fi

# 确保 gh 已登录，后续 create/merge PR 才能执行。
if ! gh auth status >/dev/null 2>&1; then
  echo "错误：GitHub CLI 未登录，请先执行 gh auth login"
  exit 1
fi

echo "正在同步远端分支信息..."
git fetch origin "$BASE_BRANCH" "$HEAD_BRANCH" >/dev/null

# 约束：base 分支必须存在于远端。
if ! git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH"; then
  echo "错误：远端分支 origin/$BASE_BRANCH 不存在"
  exit 1
fi

# PR 创建依赖远端 head 分支，因此必须存在 origin/$HEAD_BRANCH。
if ! git show-ref --verify --quiet "refs/remotes/origin/$HEAD_BRANCH"; then
  echo "错误：远端分支 origin/$HEAD_BRANCH 不存在，请先 push 分支后再执行"
  exit 1
fi

# 以“远端 base 与远端 head”做最终可合并性判断。
# 若为 0，表示 GitHub 侧没有可创建 PR 的提交，直接停止。
COMMIT_COUNT="$(git rev-list --count "origin/$BASE_BRANCH..origin/$HEAD_BRANCH")"
if [[ "$COMMIT_COUNT" -eq 0 ]]; then
  echo "无需合并：origin/$HEAD_BRANCH 相比 origin/$BASE_BRANCH 没有新增提交。"
  echo "说明 main 与 dev 在可合并方向上已一致，脚本已自动停止。"
  exit 0
fi

echo ""
echo "================ 合并前对比 ================"
echo "目标：$HEAD_BRANCH -> $BASE_BRANCH"
echo "新增提交数：$COMMIT_COUNT"
echo ""
echo "[提交列表]"
git --no-pager log --oneline --no-decorate "origin/$BASE_BRANCH..origin/$HEAD_BRANCH"
echo ""
echo "[文件变更统计]"
git --no-pager diff --stat "origin/$BASE_BRANCH...origin/$HEAD_BRANCH"
echo "============================================"
echo ""

read -r -p "确认以上变更无误并继续执行（创建/复用 PR + 立即合并）? 输入 y 继续，其它任意键取消: " CONFIRM_DIFF
if [[ "$CONFIRM_DIFF" != "y" && "$CONFIRM_DIFF" != "Y" ]]; then
  echo "已取消操作。"
  exit 1
fi

# 先尝试查找是否已有打开的 PR（避免重复创建）。
EXISTING_PR_NUMBER="$(gh pr list \
  --base "$BASE_BRANCH" \
  --head "$HEAD_BRANCH" \
  --state open \
  --json number \
  --jq '.[0].number')"

PR_REF=""
if [[ -n "$EXISTING_PR_NUMBER" && "$EXISTING_PR_NUMBER" != "null" ]]; then
  PR_REF="$EXISTING_PR_NUMBER"
  echo "检测到已存在打开的 PR：#$PR_REF，将复用该 PR 继续合并。"
else
  echo "未发现打开的 PR，正在创建新 PR..."
  # 使用 --fill 自动从提交信息生成标题和描述，减少手工输入。
  PR_REF="$(gh pr create --base "$BASE_BRANCH" --head "$HEAD_BRANCH" --fill)"
  echo "PR 已创建：$PR_REF"
fi

echo "正在合并 PR..."
gh pr merge "$PR_REF" --merge --delete-branch=false

echo ""
echo "合并完成：$HEAD_BRANCH -> $BASE_BRANCH"
