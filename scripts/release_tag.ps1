param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$versionFile = Join-Path $repoRoot "version.yml"
$syncScript = Join-Path $repoRoot "scripts/sync_version.py"

if (-not (Test-Path $versionFile)) {
  throw "version.yml 不存在: $versionFile"
}

$projectVersion = ""
Get-Content $versionFile | ForEach-Object {
  if ($_ -match '^\s*project_version\s*:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$') {
    $projectVersion = $Matches[1]
  }
}

if (-not $projectVersion) {
  throw "version.yml 中未找到 project_version"
}

$tag = "v$projectVersion"
if (-not $Message) {
  $Message = "chore: release $tag"
}

Push-Location $repoRoot
try {
  if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $syncScript
  } elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python $syncScript
  } else {
    throw "未找到可用 Python（需要 python3 或 python）"
  }

  $releaseFiles = @(
    "version.yml",
    "README.md",
    "app/templates/config.html",
    "plugin/tampermonkey/mw_quick_archive.user.js",
    "plugin/chrome_extension/mw_quick_archive_ext/manifest.json",
    "scripts/sync_version.py",
    ".github/workflows/release.yml",
    "scripts/release_tag.ps1"
  )
  git add -- $releaseFiles

  $hasStaged = git diff --cached --name-only
  if ($hasStaged) {
    git commit -m $Message
  } else {
    Write-Host "没有可提交的变更，跳过 commit。"
  }

  $tagExists = git tag --list $tag
  if ($tagExists) {
    throw "tag 已存在: $tag"
  }

  git tag $tag
  git push origin HEAD
  git push origin $tag

  Write-Host "已发布 tag: $tag"
  Write-Host "GitHub Actions 将自动创建 Release。"
} finally {
  Pop-Location
}
