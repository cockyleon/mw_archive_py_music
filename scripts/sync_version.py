#!/usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = REPO_ROOT / "version.yml"


def load_version_cfg(path: Path) -> Dict[str, str]:
    cfg: Dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        cfg[key.strip()] = value.strip().strip("'\"")
    required = ["project_version", "tampermonkey_version", "chrome_extension_version"]
    missing = [k for k in required if not cfg.get(k)]
    if missing:
        raise RuntimeError(f"version.yml 缺少字段: {', '.join(missing)}")
    return cfg


def update_tampermonkey(path: Path, version: str) -> bool:
    content = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?m)^//\s*@version\s+.+$", f"// @version      {version}", content)
    if updated == content:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def update_manifest(path: Path, version: str) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("version") == version:
        return False
    data["version"] = version
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True


def update_config_html(path: Path, project_version: str) -> bool:
    content = path.read_text(encoding="utf-8")
    short_ver = ".".join(project_version.split(".")[:2])
    updated = re.sub(
        r'(<span class="version">)v[^<]+(</span>)',
        rf"\g<1>v{short_ver}\g<2>",
        content,
        count=1,
    )
    updated = re.sub(
        r'(/static/css/manual_import\.css\?v=)[^"\']+',
        rf"\g<1>{short_ver}",
        updated,
        count=1,
    )
    if updated == content:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def update_readme(path: Path, project_version: str) -> bool:
    content = path.read_text(encoding="utf-8")
    updated = re.sub(
        r"(?m)^- `v[0-9]+\.[0-9]+(?:\.[0-9]+)?`（[0-9]{4}-[0-9]{2}-[0-9]{2}）$",
        f"- `v{project_version}`（待发布）",
        content,
        count=1,
    )
    if updated == content:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    cfg = load_version_cfg(VERSION_FILE)
    changed: List[str] = []

    targets = [
        ("plugin/tampermonkey/mw_quick_archive.user.js", update_tampermonkey, cfg["tampermonkey_version"]),
        ("plugin/chrome_extension/mw_quick_archive_ext/manifest.json", update_manifest, cfg["chrome_extension_version"]),
        ("app/templates/config.html", update_config_html, cfg["project_version"]),
        ("README.md", update_readme, cfg["project_version"]),
    ]

    for rel, fn, version in targets:
        abs_path = REPO_ROOT / rel
        if fn(abs_path, version):
            changed.append(rel)

    if changed:
        print("Updated:")
        for item in changed:
            print(f"- {item}")
    else:
        print("No changes needed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
