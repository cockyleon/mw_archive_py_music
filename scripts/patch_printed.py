from pathlib import Path
import re
import sys


PRINTED_HTML = """
  <div class="section-title">打印成品</div>
  <div class="printed">
    <div class="attach-upload">
      <input type="file" id="printedInput" multiple accept="image/*">
      <button class="attach-btn" type="button" id="printedUploadBtn">上传图片</button>
      <span class="attach-msg" id="printedMsg"></span>
    </div>
    <div class="printed-grid" id="printedList"></div>
  </div>
""".strip("\n")

PRINTED_JS = """
(function() {
  const listEl = document.getElementById('printedList');
  const msgEl = document.getElementById('printedMsg');
  const inputEl = document.getElementById('printedInput');
  const btnEl = document.getElementById('printedUploadBtn');
  if (!listEl) return;

  function setMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    if (isError) msgEl.classList.add('error');
    else msgEl.classList.remove('error');
  }

  function getModelDir() {
    const path = window.location.pathname || '';
    const parts = path.split('/').filter(Boolean);
    const filesIdx = parts.indexOf('files');
    if (filesIdx >= 0 && parts.length > filesIdx + 1) return decodeURIComponent(parts[filesIdx + 1]);
    if (parts.length >= 2) return decodeURIComponent(parts[parts.length - 2]);
    return '';
  }

  const modelDir = getModelDir();
  if (!modelDir) {
    setMsg('无法识别模型目录', true);
    return;
  }

  function openLightbox(src) {
    const overlay = document.getElementById('imgLightbox');
    const overlayImg = overlay ? overlay.querySelector('img') : null;
    if (!overlay || !overlayImg) return;
    overlayImg.src = src;
    overlay.classList.add('show');
  }

  listEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    openLightbox(target.src);
  });

  function renderList(files) {
    listEl.innerHTML = '';
    if (!files || files.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'printed-empty';
      empty.textContent = '暂无图片';
      listEl.appendChild(empty);
      return;
    }
    files.forEach((name) => {
      const item = document.createElement('div');
      item.className = 'printed-item';
      const img = document.createElement('img');
      img.className = 'printed-img';
      img.src = './printed/' + encodeURIComponent(name);
      img.alt = name;
      const caption = document.createElement('div');
      caption.className = 'printed-caption';
      caption.textContent = name;
      item.appendChild(img);
      item.appendChild(caption);
      listEl.appendChild(item);
    });
  }

  function loadList() {
    if (location.protocol === 'file:') {
      renderList([]);
      setMsg('请通过本地服务打开页面以查看图片列表', true);
      return;
    }
    fetch('/api/models/' + encodeURIComponent(modelDir) + '/printed')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        renderList((data && data.files) || []);
        setMsg('');
      })
      .catch(() => {
        renderList([]);
        setMsg('图片列表加载失败', true);
      });
  }

  loadList();

  if (!btnEl || !inputEl) return;
  btnEl.addEventListener('click', async () => {
    const files = inputEl.files ? Array.from(inputEl.files) : [];
    if (!files.length) {
      setMsg('请选择图片', true);
      return;
    }
    if (location.protocol === 'file:') {
      setMsg('请通过本地服务打开页面以便上传', true);
      return;
    }
    btnEl.disabled = true;
    let success = 0;
    let failed = 0;
    setMsg(`上传中... (0/${files.length})`);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/models/' + encodeURIComponent(modelDir) + '/printed', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) throw new Error('upload failed');
        success += 1;
      } catch (e) {
        failed += 1;
      }
      setMsg(`上传中... (${success + failed}/${files.length})`);
    }
    inputEl.value = '';
    loadList();
    if (failed === 0) setMsg('上传成功');
    else if (success === 0) setMsg('上传失败', true);
    else setMsg(`部分成功 ${success}/${files.length}`, true);
    btnEl.disabled = false;
  });
})();
""".strip("\n")

PRINTED_CSS = """
.printed {
  margin-bottom: 10px;
}

.printed-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.printed-item {
  width: 160px;
}

.printed-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #eee;
  background: #000;
  cursor: zoom-in;
}

.printed-caption {
  font-size: 12px;
  color: #555;
  margin-top: 4px;
  word-break: break-all;
}

.printed-empty {
  color: #888;
  font-size: 13px;
  margin-top: 6px;
}
""".strip("\n")


def detect_newline(text: str) -> str:
    return "\r\n" if "\r\n" in text else "\n"


def insert_printed_html(text: str) -> str | None:
    if 'id="printedList"' in text:
        return None
    m = re.search(r"</div>\s*\n\s*<div class=\"lightbox\"", text)
    if not m:
        return None
    nl = detect_newline(text)
    block = PRINTED_HTML.replace("\n", nl)
    insert_at = m.start()
    return text[:insert_at] + nl + block + nl + nl + text[insert_at:]


def insert_printed_js(text: str) -> str | None:
    if "printedUploadBtn" in text:
        return None
    idx = text.rfind("</script>")
    if idx == -1:
        return None
    nl = detect_newline(text)
    block = PRINTED_JS.replace("\n", nl)
    return text[:idx] + nl + block + nl + text[idx:]


def insert_printed_css(text: str) -> str | None:
    if ".printed" in text:
        return None
    nl = detect_newline(text)
    block = PRINTED_CSS.replace("\n", nl)
    m = re.search(r"\n\.attachments \{", text)
    if m:
        idx = m.start()
        return text[:idx] + nl + block + nl + text[idx:]
    return text + nl + nl + block + nl


def patch_get_model_dir(text: str) -> str:
    text = text.replace("return parts[filesIdx + 1];", "return decodeURIComponent(parts[filesIdx + 1]);")
    text = text.replace("return parts[parts.length - 2];", "return decodeURIComponent(parts[parts.length - 2]);")
    return text


def patch_index(index_path: Path) -> bool:
    original = index_path.read_text(encoding="utf-8")
    updated = insert_printed_html(original) or original
    updated = insert_printed_js(updated) or updated
    updated = patch_get_model_dir(updated)
    if updated != original:
        index_path.write_text(updated, encoding="utf-8")
        return True
    return False


def patch_style(style_path: Path) -> bool:
    original = style_path.read_text(encoding="utf-8")
    updated = insert_printed_css(original) or original
    if updated != original:
        style_path.write_text(updated, encoding="utf-8")
        return True
    return False


def list_model_dirs(root: Path) -> list[Path]:
    if root.is_dir() and root.name.startswith(("MW_", "Others_")) and (root / "index.html").exists():
        return [root]
    dirs = []
    dirs.extend(sorted(root.glob("MW_*")))
    dirs.extend(sorted(root.glob("Others_*")))
    return dirs


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("app/data")
    if not root.exists():
        print(f"root not found: {root}")
        return 1

    changed_indexes = []
    changed_styles = []
    for model_dir in list_model_dirs(root):
        if not model_dir.is_dir():
            continue
        index_path = model_dir / "index.html"
        if index_path.exists() and patch_index(index_path):
            changed_indexes.append(str(index_path))
        style_path = model_dir / "style.css"
        if style_path.exists() and patch_style(style_path):
            changed_styles.append(str(style_path))

    print(f"updated index.html: {len(changed_indexes)}")
    for p in changed_indexes:
        print(f" - {p}")
    print(f"updated style.css: {len(changed_styles)}")
    for p in changed_styles:
        print(f" - {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
