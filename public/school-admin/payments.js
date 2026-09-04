async function renderPayments(content) {
  content.innerHTML = `
    <div class="section-header">
      <h2>Payments</h2>
      <button class="btn" id="record-payment-btn">+ Record Payment</button>
    </div>
    <div class="toolbar">
      <input type="date" id="p-from"><input type="date" id="p-to">
      <button class="btn secondary sm" id="p-filter">Filter</button>
      <a class="btn secondary sm" href="${apiDownloadUrl('/reports/payments?format=csv')}" target="_blank">Export CSV</a>
    </div>
    <div id="payments-table"></div>
  `;
  const load = async () => {
    const from = content.querySelector('#p-from').value;
    const to = content.querySelector('#p-to').value;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const { payments, total } = await api(`/payments?${params}`);
    content.querySelector('#payments-table').innerHTML = `
      <div class="table-wrap"><table><thead><tr><th>Receipt</th><th>Student</th><th>Amount</th><th>Date</th><th>Method</th><th></th></tr></thead><tbody>
        ${payments.map(p => `<tr>
          <td>${escapeHtml(p.receipt_no)}</td><td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name || '')} (${escapeHtml(p.admission_no)})</td>
          <td>${fmtMoney(p.amount)}</td><td>${fmtDate(p.payment_date)}</td><td>${escapeHtml(p.method)}</td>
          <td><a class="btn secondary sm" href="${apiDownloadUrl(`/payments/${p.id}/receipt/pdf`)}" target="_blank">Receipt</a></td>
        </tr>`).join('') || `<tr class="empty-row"><td colspan="6">No payments recorded</td></tr>`}
      </tbody></table></div>
      <p class="text-muted">${total} payment(s)</p>
    `;
  };
  content.querySelector('#p-filter').addEventListener('click', load);
  content.querySelector('#record-payment-btn').addEventListener('click', () => openPaymentForm(load));
  await load();
}

function studentPicker(container, onSelect) {
  container.innerHTML = `
    <div class="field">
      <label>Student *</label>
      <input type="text" id="sp-search" placeholder="Type student name or admission no..." autocomplete="off">
      <input type="hidden" id="sp-id" required>
      <div id="sp-results" style="position:relative">
        <div id="sp-list" style="position:absolute;z-index:10;background:#fff;border:1px solid var(--border);border-radius:8px;width:100%;max-height:200px;overflow-y:auto;box-shadow:var(--shadow);display:none"></div>
      </div>
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
        if (onSelect) onSelect(item.dataset.id);
      }));
    }, 250);
  });
}

function openPaymentForm(onDone) {
  openModal({
    title: 'Record Payment',
    bodyHtml: `
      <form id="f">
        <div id="student-picker"></div>
        <div class="form-grid">
          <div class="field"><label>Amount *</label><input type="number" step="0.01" name="amount" required></div>
          <div class="field"><label>Payment Date *</label><input type="date" name="paymentDate" value="${new Date().toISOString().slice(0,10)}" required></div>
          <div class="field"><label>Method</label><select name="method">
            <option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="mobile_money">Mobile Money</option><option value="other">Other</option>
          </select></div>
        </div>
        <div class="field"><label>Notes</label><input name="notes"></div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn" type="submit">Record Payment</button></div>
      </form>
    `,
    onMount: (body, close) => {
      studentPicker(body.querySelector('#student-picker'));
      body.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = body.querySelector('#sp-id').value;
        if (!studentId) { toast('Please select a student', 'error'); return; }
        const fd = new FormData(e.target);
        const payload = Object.fromEntries(fd.entries());
        payload.studentId = studentId;
        try {
          const result = await api('/payments', { method: 'POST', body: payload });
          toast(`Payment recorded (${result.receiptNo})`, 'success');
          close();
          onDone();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}
