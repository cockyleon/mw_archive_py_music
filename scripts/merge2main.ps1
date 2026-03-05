<#
脚本说明：
- 通过 GitHub PR 方式将 dev 合并到 main（PowerShell 版，不需要切换分支）。
- 执行前会展示提交差异与文件变更统计，仅一次人工确认后继续。
- 若已存在 dev -> main 的打开状态 PR，则复用该 PR 并直接执行合并。
- 合并策略使用 merge commit（等价于 gh pr merge --merge）。

用法：
  powershell -ExecutionPolicy Bypass -File .\scripts\merge2main.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\merge2main.ps1 -BaseBranch main -HeadBranch dev

依赖：
- git
- gh（GitHub CLI，且已登录：gh auth login）
#>

param(
  [string]$BaseBranch = "main",
  [string]$HeadBranch = "dev"
)

# 出错立即终止，避免脚本中途失败后继续执行后续动作。
$ErrorActionPreference = "Stop"

function Assert-CommandExists {
  param([string]$CommandName)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "错误：未找到命令 $CommandName"
  }
}

# 基础环境检查：git / gh 都必须存在。
Assert-CommandExists "git"
Assert-CommandExists "gh"

# 必须在 Git 仓库内执行。
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
  throw "错误：当前目录不是 git 仓库"
}

# 必须先登录 gh，否则无法创建/合并 PR。
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw "错误：GitHub CLI 未登录，请先执行 gh auth login"
}

Write-Host "正在同步远端分支信息..."
git fetch origin $BaseBranch $HeadBranch *> $null

# base 分支必须存在于远端。
git show-ref --verify --quiet "refs/remotes/origin/$BaseBranch"
if ($LASTEXITCODE -ne 0) {
  throw "错误：远端分支 origin/$BaseBranch 不存在"
}

# PR 创建依赖远端 head 分支，因此必须存在 origin/$HeadBranch。
git show-ref --verify --quiet "refs/remotes/origin/$HeadBranch"
if ($LASTEXITCODE -ne 0) {
  throw "错误：远端分支 origin/$HeadBranch 不存在，请先 push 分支后再执行"
}

# 以“远端 base 与远端 head”做最终可合并性判断。
# 若为 0，表示 GitHub 侧没有可创建 PR 的提交，直接停止。
$commitCount = (git rev-list --count "origin/$BaseBranch..origin/$HeadBranch").Trim()
if ([int]$commitCount -eq 0) {
  Write-Host "无需合并：origin/$HeadBranch 相比 origin/$BaseBranch 没有新增提交。"
  Write-Host "说明 main 与 dev 在可合并方向上已一致，脚本已自动停止。"
  exit 0
}

Write-Host ""
Write-Host "================ 合并前对比 ================"
Write-Host "目标：$HeadBranch -> $BaseBranch"
Write-Host "新增提交数：$commitCount"
Write-Host ""
Write-Host "[提交列表]"
git --no-pager log --oneline --no-decorate "origin/$BaseBranch..origin/$HeadBranch"
Write-Host ""
Write-Host "[文件变更统计]"
git --no-pager diff --stat "origin/$BaseBranch...origin/$HeadBranch"
Write-Host "============================================"
Write-Host ""

# 仅一次确认：确认后会创建/复用 PR 并直接执行合并。
$confirm = Read-Host "确认以上变更无误并继续执行（创建/复用 PR + 立即合并）? 输入 y 继续，其它任意键取消"
if ($confirm -ne "y" -and $confirm -ne "Y") {
  Write-Host "已取消操作。"
  exit 1
}

# 查找是否已有打开的 PR（避免重复创建）。
$prJson = gh pr list --base $BaseBranch --head $HeadBranch --state open --json number
$prList = @()
if ($prJson) {
  $prList = $prJson | ConvertFrom-Json
}

$prRef = ""
if ($prList.Count -gt 0) {
  $prRef = [string]$prList[0].number
  Write-Host "检测到已存在打开的 PR：#$prRef，将复用该 PR 继续合并。"
} else {
  Write-Host "未发现打开的 PR，正在创建新 PR..."
  # 使用 --fill 自动从提交记录生成 PR 标题和正文，减少手工输入。
  $createOutput = gh pr create --base $BaseBranch --head $HeadBranch --fill 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ($createOutput -match "No commits between") {
      Write-Host "无需合并：GitHub 提示 $BaseBranch 与 $HeadBranch 之间无可合并提交，脚本已停止。"
      exit 0
    }
    throw "创建 PR 失败: $createOutput"
  }
  $prRef = "$createOutput".Trim()
  if (-not $prRef) {
    throw "创建 PR 失败：未返回有效 PR 信息"
  }
  Write-Host "PR 已创建：$prRef"
}

Write-Host "正在合并 PR..."
gh pr merge $prRef --merge --delete-branch=false

Write-Host ""
Write-Host "合并完成：$HeadBranch -> $BaseBranch"
