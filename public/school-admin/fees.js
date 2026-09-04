async function renderFees(content) {
  const classes = await fetchClasses();
  const { feeTypes } = await api('/fees/types');
  content.innerHTML = `
    <div class="pill-tabs">
      <button class="active" data-tab="types">Fee Types</button>
      <button data-tab="assign">Assign Fees</button>
      <button data-tab="outstanding">Outstanding Balances</button>
    </div>
    <div id="panel-types"></div>
    <div id="panel-assign" class="hidden"></div>
    <div id="panel-outstanding" class="hidden"></div>
  `;
  content.querySelectorAll('.pill-tabs button').forEach(btn => btn.addEventListener('click', () => {
    content.querySelectorAll('.pill-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['types', 'assign', 'outstanding'].forEach(t => content.querySelector(`#panel-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
  }));

  renderFeeTypesPanel(content.querySelector('#panel-types'), feeTypes);
  renderAssignFeePanel(content.querySelector('#panel-assign'), classes, feeTypes);
  renderOutstandingPanel(content.querySelector('#panel-outstanding'), classes);
}

function renderFeeTypesPanel(panel, feeTypes) {
  panel.innerHTML = `
    <div class="section-header"><h2>Fee Types</h2><button class="btn sm" id="add-fee-type">+ Add Fee Type</button></div>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Category</th></tr></thead><tbody>
      ${feeTypes.map(f => `<tr><td>${escapeHtml(f.name)}</td><td>${badge(f.category, 'info')}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="2">No fee types yet</td></tr>`}
    </tbody></table></div>
  `;
  panel.querySelector('#add-fee-type').addEventListener('click', () => {
    openModal({
      title: 'Add Fee Type',
      bodyHtml: `<form id="f"><div class="field"><label>Name *</label><input name="name" required placeholder="e.g. Tuition Fee"></div>
        <div class="field"><label>Category</label><select name="category">
          <option value="tuition">Tuition</option><option value="registration">Registration</option><option value="transport">Transport</option><option value="exam">Exam</option><option value="other">Other</option>
        </select></div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Save</button></div></form>`,
      onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        await api('/fees/types', { method: 'POST', body: payload });
        close(); toast('Fee type added', 'success'); renderFees(document.getElementById('content'));
      })
    });
  });
}

function renderAssignFeePanel(panel, classes, feeTypes) {
  panel.innerHTML = `
    <h2>Assign Fee to a Whole Class</h2>
    <form id="bulk-form" class="form-grid">
      <div class="field"><label>Class *</label><select name="classId" required><option value="">Select</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Fee Type *</label><select name="feeTypeId" required><option value="">Select</option>${feeTypes.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Amount Required *</label><input type="number" step="0.01" name="amountRequired" required></div>
      <div class="field"><label>Due Date</label><input type="date" name="dueDate"></div>
      <div class="field" style="align-self:end"><button class="btn" type="submit">Assign to Class</button></div>
    </form>
    <div id="bulk-result"></div>
  `;
  panel.querySelector('#bulk-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const result = await api('/fees/assign-class', { method: 'POST', body: payload });
    panel.querySelector('#bulk-result').innerHTML = `<p class="text-success">Fee assigned to ${result.assigned} students.</p>`;
  });
}

function renderOutstandingPanel(panel, classes) {
  panel.innerHTML = `
    <div class="toolbar">
      <select id="o-class"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <button class="btn sm" id="o-load">Load</button>
    </div>
    <div id="o-table"></div>
  `;
  const load = async () => {
    const classId = panel.querySelector('#o-class').value;
    const { students } = await api(`/fees/outstanding${classId ? '?classId=' + classId : ''}`);
    panel.querySelector('#o-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Admission No</th><th>Name</th><th>Class</th><th>Required</th><th>Paid</th><th>Outstanding</th></tr></thead><tbody>
        ${students.map(s => `<tr><td>${escapeHtml(s.admission_no)}</td><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name || '')}</td><td>${escapeHtml(s.class_name || '-')}</td>
          <td>${fmtMoney(s.required)}</td><td>${fmtMoney(s.paid)}</td><td class="text-danger">${fmtMoney(s.outstanding)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="6">No outstanding balances</td></tr>`}
      </tbody></table></div>
    `;
  };
  panel.querySelector('#o-load').addEventListener('click', load);
  load();
}
