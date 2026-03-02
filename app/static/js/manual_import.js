(function() {
  const modal = document.getElementById('manualImportModal');
  if (!modal) return;

  const openers = document.querySelectorAll('[data-manual-import-open]');
  const closers = modal.querySelectorAll('[data-manual-import-close]');
  const form = document.getElementById('manualImportForm');
  const msgEl = document.getElementById('manualImportMsg');
  const submitBtn = document.getElementById('manualImportSubmit');

  const instanceAddBtn = document.getElementById('manualAddInstance');
  const instancePicker = document.getElementById('manualInstancePicker');
  const instanceList = document.getElementById('instanceDescList');
  const instanceEntries = [];

  const draftSessionInput = document.getElementById('manualDraftSessionId');
  const draftOverridesInput = document.getElementById('manualDraftOverrides');
  const parse3mfBtn = document.getElementById('manualParse3mf');
  const parse3mfInput = document.getElementById('manual3mfPicker');
  const draftPreview = document.getElementById('manualParsedPreview');
  const draftCover = document.getElementById('manualDraftCover');
  const draftTitle = document.getElementById('manualDraftTitle');
  const draftDesigner = document.getElementById('manualDraftDesigner');
  const parsedInstanceList = document.getElementById('parsedInstanceList');

  let parsedDraft = null;

  function setMsg(text, isError, isSuccess) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.classList.remove('error');
    msgEl.classList.remove('success');
    if (isError) msgEl.classList.add('error');
    if (isSuccess) msgEl.classList.add('success');
  }

  function refreshInstanceLabels() {
    instanceEntries.forEach((entry, idx) => {
      entry.nameEl.textContent = `实例 ${idx + 1}: ${entry.file.name}`;
    });
  }

  function clearInstanceEntries() {
    instanceEntries.splice(0, instanceEntries.length);
    if (instanceList) instanceList.innerHTML = '';
  }

  function clearDraftPreview() {
    parsedDraft = null;
    if (draftSessionInput) draftSessionInput.value = '';
    if (draftOverridesInput) draftOverridesInput.value = '[]';
    if (draftPreview) draftPreview.classList.add('hidden');
    if (parsedInstanceList) parsedInstanceList.innerHTML = '';
    if (draftCover) draftCover.src = '';
    if (draftTitle) draftTitle.textContent = '';
    if (draftDesigner) draftDesigner.textContent = '';
  }

  function openModal() {
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setMsg('');
  }

  openers.forEach((btn) => btn.addEventListener('click', openModal));
  closers.forEach((btn) => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  function addInstanceFiles(files) {
    if (!instanceList || !files || !files.length) return;
    Array.from(files).forEach((file, idx) => {
      const row = document.createElement('div');
      row.className = 'file-desc-item';

      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = `实例 ${instanceEntries.length + idx + 1}: ${file.name}`;

      const label = document.createElement('label');
      label.textContent = '实例介绍';
      const input = document.createElement('textarea');
      input.setAttribute('data-instance-desc', '1');
      input.rows = 2;

      const picLabel = document.createElement('label');
      picLabel.textContent = '实例图片 (多选)';
      const picInput = document.createElement('input');
      picInput.type = 'file';
      picInput.accept = 'image/*';
      picInput.multiple = true;
      picInput.setAttribute('data-instance-pics', '1');

      const actions = document.createElement('div');
      actions.className = 'file-desc-actions';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'manual-btn danger';
      removeBtn.textContent = '移除';
      removeBtn.addEventListener('click', () => {
        const index = instanceEntries.findIndex((entry) => entry.row === row);
        if (index >= 0) instanceEntries.splice(index, 1);
        row.remove();
        refreshInstanceLabels();
      });
      actions.appendChild(removeBtn);

      row.appendChild(name);
      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(picLabel);
      row.appendChild(picInput);
      row.appendChild(actions);
      instanceList.appendChild(row);
      instanceEntries.push({ file, nameEl: name, descEl: input, picEl: picInput, row });
    });
    refreshInstanceLabels();
  }

  function renderDraftInstances(instances) {
    if (!parsedInstanceList) return;
    parsedInstanceList.innerHTML = '';
    (instances || []).forEach((inst, idx) => {
      const card = document.createElement('div');
      card.className = 'manual-draft-inst';

      const head = document.createElement('div');
      head.className = 'manual-draft-inst-head';
      const left = document.createElement('div');
      left.className = 'left';

      const enable = document.createElement('input');
      enable.type = 'checkbox';
      enable.checked = true;
      enable.setAttribute('data-draft-enabled', String(idx));
      left.appendChild(enable);

      const fileTag = document.createElement('span');
      fileTag.className = 'manual-help';
      fileTag.textContent = inst.name || '';
      left.appendChild(fileTag);
      head.appendChild(left);
      card.appendChild(head);

      const titleLabel = document.createElement('label');
      titleLabel.textContent = `实例 ${idx + 1} 标题`;
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'manual-draft-inst-title';
      titleInput.value = inst.title || '';
      titleInput.setAttribute('data-draft-title', String(idx));

      const summaryLabel = document.createElement('label');
      summaryLabel.textContent = '实例介绍';
      const summaryInput = document.createElement('textarea');
      summaryInput.rows = 2;
      summaryInput.value = inst.summary || '';
      summaryInput.setAttribute('data-draft-summary', String(idx));

      card.appendChild(titleLabel);
      card.appendChild(titleInput);
      card.appendChild(summaryLabel);
      card.appendChild(summaryInput);
      parsedInstanceList.appendChild(card);
    });
  }

  function collectDraftOverrides() {
    if (!parsedDraft || !parsedDraft.instances) return [];
    return parsedDraft.instances.map((_, idx) => {
      const enabledEl = parsedInstanceList.querySelector(`[data-draft-enabled="${idx}"]`);
      const titleEl = parsedInstanceList.querySelector(`[data-draft-title="${idx}"]`);
      const summaryEl = parsedInstanceList.querySelector(`[data-draft-summary="${idx}"]`);
      return {
        enabled: !!(enabledEl && enabledEl.checked),
        title: titleEl ? titleEl.value : '',
        summary: summaryEl ? summaryEl.value : '',
      };
    });
  }

  async function parse3mfFiles() {
    if (!parse3mfInput || !parse3mfInput.files || !parse3mfInput.files.length) {
      setMsg('请先选择 3MF 文件', true);
      return;
    }
    const fd = new FormData();
    Array.from(parse3mfInput.files).forEach((f) => fd.append('files', f));

    const oldText = parse3mfBtn ? parse3mfBtn.textContent : '';
    if (parse3mfBtn) {
      parse3mfBtn.disabled = true;
      parse3mfBtn.textContent = '识别中...';
    }
    setMsg('正在解析 3MF ...');
    try {
      const res = await fetch('/api/manual/3mf/parse', { method: 'POST', body: fd });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || '解析失败');
      }
      const data = await res.json();
      const draft = data && data.draft ? data.draft : null;
      if (!draft) throw new Error('解析结果为空');
      parsedDraft = draft;

      if (draftSessionInput) draftSessionInput.value = draft.sessionId || '';
      if (draftTitle) draftTitle.textContent = draft.title || '未命名模型';
      if (draftDesigner) draftDesigner.textContent = draft.designer ? `作者: ${draft.designer}` : '作者: 未识别';
      if (draftCover) {
        draftCover.src = draft.coverUrl || '';
        draftCover.style.display = draft.coverUrl ? '' : 'none';
      }
      if (draftPreview) draftPreview.classList.remove('hidden');

      renderDraftInstances(draft.instances || []);

      const titleInput = form.querySelector('[name="title"]');
      if (titleInput && !titleInput.value.trim()) titleInput.value = draft.title || '';
      const summaryInput = form.querySelector('[name="summary"]');
      if (summaryInput && !summaryInput.value.trim()) summaryInput.value = draft.summary || '';
      const sourceInput = form.querySelector('[name="sourceLink"]');
      if (sourceInput && !sourceInput.value.trim()) sourceInput.value = '';

      setMsg('3MF 识别完成，可补充信息后保存归档', false, true);
    } catch (err) {
      setMsg(`3MF 识别失败：${err.message || err}`, true);
    } finally {
      if (parse3mfBtn) {
        parse3mfBtn.disabled = false;
        parse3mfBtn.textContent = oldText || '识别并填充';
      }
    }
  }

  if (instanceAddBtn && instancePicker) {
    instanceAddBtn.addEventListener('click', () => instancePicker.click());
    instancePicker.addEventListener('change', () => {
      addInstanceFiles(instancePicker.files);
      instancePicker.value = '';
    });
  }

  if (parse3mfBtn) parse3mfBtn.addEventListener('click', parse3mfFiles);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (draftOverridesInput) {
        draftOverridesInput.value = JSON.stringify(collectDraftOverrides());
      }

      const formData = new FormData();
      const titleInput = form.querySelector('[name="title"]');
      const modelLinkInput = form.querySelector('[name="modelLink"]');
      const sourceLinkInput = form.querySelector('[name="sourceLink"]');
      const summaryInput = form.querySelector('[name="summary"]');
      const tagsInput = form.querySelector('[name="tags"]');

      formData.append('title', titleInput ? titleInput.value : '');
      formData.append('modelLink', modelLinkInput ? modelLinkInput.value : '');
      formData.append('sourceLink', sourceLinkInput ? sourceLinkInput.value : '');
      formData.append('summary', summaryInput ? summaryInput.value : '');
      formData.append('tags', tagsInput ? tagsInput.value : '');
      formData.append('draft_session_id', draftSessionInput ? draftSessionInput.value : '');
      formData.append('draft_instance_overrides', draftOverridesInput ? draftOverridesInput.value : '[]');

      const coverInput = form.querySelector('[name="cover"]');
      if (coverInput && coverInput.files && coverInput.files[0]) {
        formData.append('cover', coverInput.files[0]);
      }
      const designInput = form.querySelector('[name="design_images"]');
      if (designInput && designInput.files) {
        Array.from(designInput.files).forEach((f) => formData.append('design_images', f));
      }

      instanceEntries.forEach((entry) => formData.append('instance_files', entry.file));

      const attachmentsInput = form.querySelector('[name="attachments"]');
      if (attachmentsInput && attachmentsInput.files) {
        Array.from(attachmentsInput.files).forEach((f) => formData.append('attachments', f));
      }

      const descs = instanceEntries.map((entry) => entry.descEl.value || '');
      const picInputs = instanceEntries.map((entry) => entry.picEl);
      const picCounts = [];
      const picFiles = [];
      picInputs.forEach((input) => {
        const files = input.files ? Array.from(input.files) : [];
        picCounts.push(files.length);
        files.forEach((f) => picFiles.push(f));
      });
      formData.append('instance_descs', JSON.stringify(descs));
      formData.append('instance_picture_counts', JSON.stringify(picCounts));
      picFiles.forEach((f) => formData.append('instance_pictures', f));

      if (submitBtn) submitBtn.disabled = true;
      setMsg('上传中...');
      try {
        const res = await fetch('/api/models/manual', { method: 'POST', body: formData });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || '导入失败');
        }
        const data = await res.json();
        form.reset();
        clearInstanceEntries();
        clearDraftPreview();
        setMsg('导入成功', false, true);
        closeModal();
        alert(`导入完成：${data.work_dir || data.base_name || ''}`);
        window.location.reload();
      } catch (err) {
        setMsg(`导入失败：${err.message || err}`, true);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
})();

