let CURRENT_USER = null;

async function fetchClasses() { return (await api('/academics/classes')).classes; }

async function init() {
  CURRENT_USER = await requireRole(['accountant']);
  if (!CURRENT_USER) return;
  const content = buildShell({
    user: CURRENT_USER,
    brandLabel: CURRENT_USER.schoolName || 'Accountant Portal',
    navItems: [
      { route: '/dashboard', label: 'Dashboard' },
      { route: '/fees', label: 'Fees' },
      { route: '/payments', label: 'Payments' },
      { route: '/reports', label: 'Reports' }
    ]
  });
  initRouter({
    '/dashboard': renderDashboard,
    '/fees': renderFees,
    '/payments': renderPayments,
    '/reports': renderReports
  }, content, '/dashboard');
}

async function renderDashboard(content) {
  const s = await api('/dashboard/accountant');
  content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="label">This Month's Collections</div><div class="value">${fmtMoney(s.monthlyCollections)}</div></div>
      <div class="stat-card"><div class="label">Outstanding Fees</div><div class="value text-danger">${fmtMoney(s.outstandingFees)}</div></div>
    </div>
    <div class="card"><h3>Recent Payments</h3>
      <div class="table-wrap"><table><thead><tr><th>Student</th><th>Amount</th><th>Date</th></tr></thead><tbody>
        ${s.recentPayments.map(p => `<tr><td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name || '')}</td><td>${fmtMoney(p.amount)}</td><td>${fmtDate(p.payment_date)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="3">No payments yet</td></tr>`}
      </tbody></table></div>
    </div>
  `;
}

async function renderFees(content) {
  const classes = await fetchClasses();
  const { feeTypes } = await api('/fees/types');
  content.innerHTML = `
    <div class="pill-tabs">
      <button class="active" data-tab="assign">Assign Fees</button>
      <button data-tab="outstanding">Outstanding Balances</button>
      <button data-tab="types">Fee Types</button>
    </div>
    <div id="panel-assign"></div>
    <div id="panel-outstanding" class="hidden"></div>
    <div id="panel-types" class="hidden"></div>
  `;
  content.querySelectorAll('.pill-tabs button').forEach(btn => btn.addEventListener('click', () => {
    content.querySelectorAll('.pill-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['assign', 'outstanding', 'types'].forEach(t => content.querySelector(`#panel-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
  }));

  content.querySelector('#panel-assign').innerHTML = `
    <h2>Assign Fee to a Class</h2>
    <form id="bulk-form" class="form-grid">
      <div class="field"><label>Class *</label><select name="classId" required><option value="">Select</option>${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Fee Type *</label><select name="feeTypeId" required><option value="">Select</option>${feeTypes.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Amount *</label><input type="number" step="0.01" name="amountRequired" required></div>
      <div class="field"><label>Due Date</label><input type="date" name="dueDate"></div>
      <div class="field" style="align-self:end"><button class="btn" type="submit">Assign</button></div>
    </form>
    <div id="bulk-result"></div>
  `;
  content.querySelector('#bulk-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const result = await api('/fees/assign-class', { method: 'POST', body: payload });
    content.querySelector('#bulk-result').innerHTML = `<p class="text-success">Assigned to ${result.assigned} students.</p>`;
  });

  const loadOutstanding = async () => {
    const { students } = await api('/fees/outstanding');
    content.querySelector('#panel-outstanding').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Admission No</th><th>Name</th><th>Class</th><th>Outstanding</th></tr></thead><tbody>
        ${students.map(s => `<tr><td>${escapeHtml(s.admission_no)}</td><td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name || '')}</td><td>${escapeHtml(s.class_name || '-')}</td><td class="text-danger">${fmtMoney(s.outstanding)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="4">No outstanding balances</td></tr>`}
      </tbody></table></div>
    `;
  };
  loadOutstanding();

  content.querySelector('#panel-types').innerHTML = `
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Category</th></tr></thead><tbody>
      ${feeTypes.map(f => `<tr><td>${escapeHtml(f.name)}</td><td>${badge(f.category, 'info')}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="2">No fee types yet</td></tr>`}
    </tbody></table></div>
  `;
}

function studentPicker(container) {
  container.innerHTML = `
    <div class="field">
      <label>Student *</label>
      <input type="text" id="sp-search" placeholder="Type student name or admission no..." autocomplete="off">
      <input type="hidden" id="sp-id" required>
      <div style="position:relative"><div id="sp-list" style="position:absolute;z-index:10;background:#fff;border:1px solid var(--border);border-radius:8px;width:100%;max-height:200px;overflow-y:auto;box-shadow:var(--shadow);display:none"></div></div>
      <div id="sp-selected" class="text-muted" style="margin-top:4px"></div>
    </div>
  `;
  const searchInput = container.querySelector('#sp-search');
  const list = container.querySelector('#sp-list');
  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = searchInput.value.trim();
      if (!q) { list.style.display = 'none'; return; }
      const { students } = await api(`/students?search=${encodeURIComponent(q)}&pageSize=8`);
      list.innerHTML = students.map(s => `<div class="sp-item" data-id="${s.id}" data-name="${escapeHtml(s.first_name)} ${escapeHtml(s.last_name || '')}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name || '')} — ${escapeHtml(s.admission_no)}</div>`).join('') || `<div style="padding:8px 12px;color:#94a3b8">No matches</div>`;
      list.style.display = 'block';
      list.querySelectorAll('.sp-item').forEach(item => item.addEventListener('click', () => {
        container.querySelector('#sp-id').value = item.dataset.id;
        container.querySelector('#sp-selected').textContent = `Selected: ${item.dataset.name}`;
        searchInput.value = item.dataset.name;
        list.style.display = 'none';
      }));
    }, 250);
  });
}

async function renderPayments(content) {
  content.innerHTML = `
    <div class="section-header"><h2>Payments</h2><button class="btn" id="record-btn">+ Record Payment</button></div>
    <div class="toolbar">
      <input type="date" id="p-from"><input type="date" id="p-to">
      <button class="btn secondary sm" id="p-filter">Filter</button>
      <a class="btn secondary sm" href="${apiDownloadUrl('/reports/payments?format=csv')}" target="_blank">Export CSV</a>
    </div>
    <div id="payments-table"></div>
  `;
  const load = async () => {
    const from = content.querySelector('#p-from').value, to = content.querySelector('#p-to').value;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const { payments, total } = await api(`/payments?${params}`);
    content.querySelector('#payments-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Receipt</th><th>Student</th><th>Amount</th><th>Date</th><th>Method</th><th></th></tr></thead><tbody>
        ${payments.map(p => `<tr><td>${escapeHtml(p.receipt_no)}</td><td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name || '')}</td><td>${fmtMoney(p.amount)}</td><td>${fmtDate(p.payment_date)}</td><td>${escapeHtml(p.method)}</td>
          <td><a class="btn secondary sm" href="${apiDownloadUrl(`/payments/${p.id}/receipt/pdf`)}" target="_blank">Receipt</a></td></tr>`).join('') || `<tr class="empty-row"><td colspan="6">No payments recorded</td></tr>`}
      </tbody></table></div><p class="text-muted">${total} payment(s)</p>
    `;
  };
  content.querySelector('#p-filter').addEventListener('click', load);
  content.querySelector('#record-btn').addEventListener('click', () => {
    openModal({
      title: 'Record Payment',
      bodyHtml: `<form id="f"><div id="sp"></div>
        <div class="form-grid">
          <div class="field"><label>Amount *</label><input type="number" step="0.01" name="amount" required></div>
          <div class="field"><label>Date *</label><input type="date" name="paymentDate" value="${new Date().toISOString().slice(0,10)}" required></div>
          <div class="field"><label>Method</label><select name="method"><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="mobile_money">Mobile Money</option><option value="other">Other</option></select></div>
        </div>
        <div class="field"><label>Notes</label><input name="notes"></div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Record</button></div></form>`,
      onMount: (body, close) => {
        studentPicker(body.querySelector('#sp'));
        body.querySelector('#f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const studentId = body.querySelector('#sp-id').value;
          if (!studentId) { toast('Select a student', 'error'); return; }
          const payload = Object.fromEntries(new FormData(e.target).entries());
          payload.studentId = studentId;
          try {
            const result = await api('/payments', { method: 'POST', body: payload });
            toast(`Payment recorded (${result.receiptNo})`, 'success');
            close(); load();
          } catch (err) { toast(err.message, 'error'); }
        });
      }
    });
  });
  await load();
}

async function renderFinance(content) {
  content.innerHTML = `
    <div class="section-header"><h2>Income &amp; Expenses</h2><button class="btn" id="add-btn">+ Add Record</button></div>
    <div id="finance-summary"></div>
    <div id="finance-table"></div>
  `;
  const load = async () => {
    const year = new Date().getFullYear();
    const { summary } = await api(`/finance/monthly-summary?year=${year}`);
    content.querySelector('#finance-summary').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Month</th><th>Income</th><th>Fee Collections</th><th>Expenses</th><th>Balance</th></tr></thead><tbody>
        ${summary.map(m => `<tr><td>${m.month}</td><td class="text-success">${fmtMoney(m.income)}</td><td class="text-success">${fmtMoney(m.feeCollections)}</td><td class="text-danger">${fmtMoney(m.expenses)}</td><td>${fmtMoney(m.balance)}</td></tr>`).join('') || `<tr class="empty-row"><td colspan="5">No records</td></tr>`}
      </tbody></table></div>
    `;
    const { records } = await api('/finance');
    content.querySelector('#finance-table').innerHTML = `
      <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Type</th><th>Category</th><th>Amount</th><th>Date</th><th></th></tr></thead><tbody>
        ${records.map(r => `<tr><td>${badge(r.type, r.type === 'income' ? 'active' : 'inactive')}</td><td>${escapeHtml(r.category)}</td><td>${fmtMoney(r.amount)}</td><td>${fmtDate(r.record_date)}</td>
          <td><button class="btn danger sm" data-del="${r.id}">Delete</button></td></tr>`).join('') || `<tr class="empty-row"><td colspan="5">No records yet</td></tr>`}
      </tbody></table></div>
    `;
    content.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirmDialog('Delete this record?')) return;
      await api(`/finance/${btn.dataset.del}`, { method: 'DELETE' }); load();
    }));
  };
  content.querySelector('#add-btn').addEventListener('click', () => {
    openModal({
      title: 'Add Income / Expense Record',
      bodyHtml: `<form id="f">
        <div class="form-grid">
          <div class="field"><label>Type *</label><select name="type" required><option value="income">Income</option><option value="expense">Expense</option></select></div>
          <div class="field"><label>Category *</label><input name="category" required></div>
          <div class="field"><label>Amount *</label><input type="number" step="0.01" name="amount" required></div>
          <div class="field"><label>Date *</label><input type="date" name="recordDate" value="${new Date().toISOString().slice(0,10)}" required></div>
        </div>
        <div class="field"><label>Notes</label><input name="notes"></div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Save</button></div></form>`,
      onMount: (body, close) => body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        await api('/finance', { method: 'POST', body: payload });
        toast('Record added', 'success'); close(); load();
      })
    });
  });
  await load();
}

async function renderReports(content) {
  content.innerHTML = `
    <h2>Reports</h2>
    <div class="stat-grid">
      <div class="card"><h3>Students</h3><a class="btn secondary sm" href="${apiDownloadUrl('/reports/students?format=csv')}" target="_blank">Download CSV</a></div>
      <div class="card"><h3>Payments</h3><a class="btn secondary sm" href="${apiDownloadUrl('/reports/payments?format=csv')}" target="_blank">Download CSV</a></div>
    </div>
  `;
}

init();
