const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const TH = 'th-TH';
const money = (n) => '฿' + Number(n || 0).toLocaleString(TH, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const shortDate = (s) => new Intl.DateTimeFormat(TH, { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDate(s));
const titleDate = (d) => new Intl.DateTimeFormat(TH, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const monthTitle = (d) => new Intl.DateTimeFormat(TH, { month: 'long', year: 'numeric' }).format(d);
const WEEK = (d) => addDays(d, -(d.getDay() + 6) % 7);
const CATEGORIES = { expense: ['อาหารและเครื่องดื่ม', 'เดินทาง', 'ช้อปปิ้ง', 'ที่พักอาศัย', 'บิลและสาธารณูปโภค', 'สุขภาพ', 'ความบันเทิง', 'อื่น ๆ'], income: ['เงินเดือน', 'งานเสริม', 'ขายของ', 'ดอกเบี้ย', 'ของขวัญ', 'อื่น ๆ'] };
const ICONS = { 'อาหารและเครื่องดื่ม': '☕', 'เดินทาง': '🚕', 'ช้อปปิ้ง': '🛍', 'ที่พักอาศัย': '⌂', 'บิลและสาธารณูปโภค': '▣', 'สุขภาพ': '✚', 'ความบันเทิง': '♫', 'เงินเดือน': '↙', 'งานเสริม': '✦', 'ขายของ': '◈', 'ดอกเบี้ย': '%', 'ของขวัญ': '♡' };
const LOCAL_KEY = 'daily-money-entries-v1';
const CONFIG_KEY = 'daily-money-supabase-v1';
let entries = readLocal();
let supabase = null;
let user = null;
let period = 'day';
let reportMode = 'week';
let reportDate = new Date();
let editId = null;
let entryType = 'expense';

function readLocal() { try { const x = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } }
function saveLocal() { localStorage.setItem(LOCAL_KEY, JSON.stringify(entries)); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3500); }
function safeText(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function activeRange(kind, anchor = new Date()) { const start = kind === 'day' ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()) : kind === 'week' ? WEEK(anchor) : new Date(anchor.getFullYear(), anchor.getMonth(), 1); const end = kind === 'day' ? start : kind === 'week' ? addDays(start, 6) : new Date(start.getFullYear(), start.getMonth() + 1, 0); return [dateKey(start), dateKey(end)]; }
function inRange(rows, range) { return rows.filter((e) => e.entry_date >= range[0] && e.entry_date <= range[1]); }
function sums(rows) { return rows.reduce((a, e) => { a[e.type] += Number(e.amount); a[e.type + 'Count']++; return a; }, { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 }); }
function ordered(rows) { return [...rows].sort((a, b) => b.entry_date.localeCompare(a.entry_date) || String(b.created_at || '').localeCompare(String(a.created_at || ''))); }
function empty(label = 'ยังไม่มีรายการในช่วงนี้') { return `<div class="empty-state"><strong>${label}</strong>เพิ่มรายการแรกเพื่อเริ่มดูสรุปการเงิน</div>`; }
function rowHtml(e, editable = false) { return `<div class="transaction-row"><div class="tx-icon ${e.type}">${safeText(ICONS[e.category] || (e.type === 'income' ? '↙' : '◈'))}</div><div class="tx-main"><div class="tx-title">${safeText(e.title)}</div><div class="tx-meta">${safeText(e.category)} · ${shortDate(e.entry_date)}</div></div><div class="tx-amount ${e.type === 'income' ? 'income-text' : 'expense-text'}">${e.type === 'income' ? '+' : '−'}${money(e.amount)}</div>${editable ? `<button class="tx-edit" data-edit="${safeText(e.id)}" aria-label="แก้ไข ${safeText(e.title)}">⋯</button>` : ''}</div>`; }

function renderOverview() {
  const range = activeRange(period); const rows = inRange(entries, range); const total = sums(rows);
  $('#overview-range').textContent = period === 'day' ? titleDate(parseDate(range[0])) : `${shortDate(range[0])} – ${shortDate(range[1])}`;
  $('#balance-total').textContent = money(total.income - total.expense);
  $('#income-total').textContent = money(total.income); $('#expense-total').textContent = money(total.expense);
  $('#income-count').textContent = `${total.incomeCount} รายการ`; $('#expense-count').textContent = `${total.expenseCount} รายการ`;
  const recent = ordered(rows).slice(0, 5); $('#recent-list').innerHTML = recent.length ? recent.map((e) => rowHtml(e)).join('') : empty();
  const days = []; let current = parseDate(range[0]); const end = parseDate(range[1]);
  while (current <= end) { days.push(dateKey(current)); current = addDays(current, 1); }
  const chartDays = days.length > 16 ? days.filter((_, i) => i % 2 === 0 || i === days.length - 1) : days;
  const values = chartDays.map((day) => sums(entries.filter((e) => e.entry_date === day)));
  const max = Math.max(1, ...values.flatMap((v) => [v.income, v.expense]));
  $('#chart-caption').textContent = period === 'month' ? 'ทุก 2 วันในเดือนนี้' : 'รายวันในช่วงเวลาที่เลือก';
  $('#cash-chart').innerHTML = chartDays.map((day, i) => `<div class="chart-col" title="${shortDate(day)}: รายรับ ${money(values[i].income)}, รายจ่าย ${money(values[i].expense)}"><div class="bar-pair"><div class="bar income" style="height:${Math.max(2, values[i].income / max * 100)}%"></div><div class="bar expense" style="height:${Math.max(2, values[i].expense / max * 100)}%"></div></div><span class="chart-day">${Number(day.slice(-2))}</span></div>`).join('');
}
function renderTransactions() {
  const query = $('#search-input').value.trim().toLocaleLowerCase(TH); const type = $('#type-filter').value; const month = $('#date-filter').value;
  const rows = ordered(entries.filter((e) => (type === 'all' || e.type === type) && (!month || e.entry_date.startsWith(month)) && (!query || `${e.title} ${e.category} ${e.note || ''}`.toLocaleLowerCase(TH).includes(query))));
  $('#all-list').innerHTML = rows.length ? rows.map((e) => rowHtml(e, true)).join('') : empty('ไม่พบรายการ');
}
function renderReports() {
  const range = activeRange(reportMode, reportDate); const rows = inRange(entries, range); const total = sums(rows);
  $('#report-range').textContent = reportMode === 'week' ? `${shortDate(range[0])} – ${shortDate(range[1])}` : monthTitle(reportDate);
  $('#report-income').textContent = money(total.income); $('#report-expense').textContent = money(total.expense); $('#report-balance').textContent = money(total.income - total.expense);
  $('#report-count').textContent = `${rows.length} รายการ`; $('#report-list').innerHTML = rows.length ? ordered(rows).slice(0, 8).map((e) => rowHtml(e)).join('') : empty();
  const byCategory = {}; for (const e of rows.filter((x) => x.type === 'expense')) byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  const cats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  $('#category-report').innerHTML = cats.length ? cats.map(([name, value]) => `<div class="cat-row"><div class="cat-top"><span>${safeText(name)}</span><strong>${money(value)}</strong></div><div class="cat-track"><div class="cat-fill" style="width:${value / total.expense * 100}%"></div></div></div>`).join('') : empty('ยังไม่มีรายจ่าย');
}
function render() { renderOverview(); renderTransactions(); renderReports(); updateStorageLabel(); }
function setView(view) { $$('.view').forEach((x) => x.classList.toggle('active-view', x.id === view)); $$('[data-view]').forEach((x) => x.classList.toggle('active', x.dataset.view === view)); window.scrollTo(0, 0); }
function updateStorageLabel() { $('#storage-label').textContent = user ? `ซิงก์กับ ${user.email}` : 'บันทึกในเครื่องนี้'; $('#mode-description').textContent = user ? `ข้อมูลกำลังซิงก์กับ Supabase สำหรับ ${user.email}` : 'ตอนนี้ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้'; $('#auth-status').textContent = user ? `เข้าสู่ระบบ: ${user.email}` : 'ยังไม่ได้เข้าสู่ระบบ'; $('#signout-btn').hidden = !user; $('#upload-local-btn').hidden = !user || !readLocal().length; }
function fillCategories(value = '') { const select = $('#entry-category'); select.innerHTML = CATEGORIES[entryType].map((x) => `<option value="${safeText(x)}">${safeText(x)}</option>`).join(''); if (value && CATEGORIES[entryType].includes(value)) select.value = value; }
function setEntryType(type, category = '') { entryType = type; $$('[data-entry-type]').forEach((x) => x.classList.toggle('active', x.dataset.entryType === type)); fillCategories(category); }
function openEntry(e = null) { editId = e?.id || null; $('#entry-form').reset(); $('#dialog-title').textContent = e ? 'แก้ไขรายการ' : 'เพิ่มรายการ'; $('#delete-entry').hidden = !e; setEntryType(e?.type || 'expense', e?.category); $('#entry-date').value = e?.entry_date || dateKey(new Date()); if (e) { $('#entry-amount').value = e.amount; $('#entry-title').value = e.title; $('#entry-note').value = e.note || ''; } $('#entry-dialog').showModal(); }

async function loadRemote() { if (!supabase || !user) return; const { data, error } = await supabase.from('transactions').select('id,type,amount,title,category,entry_date,note,created_at').order('entry_date', { ascending: false }).limit(5000); if (error) { toast(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`); return; } entries = data || []; render(); }
async function saveEntry(e) { if (user) { const payload = { type: e.type, amount: e.amount, title: e.title, category: e.category, entry_date: e.entry_date, note: e.note, user_id: user.id }; const result = editId ? await supabase.from('transactions').update(payload).eq('id', editId) : await supabase.from('transactions').insert(payload); if (result.error) throw result.error; await loadRemote(); } else { if (editId) entries = entries.map((old) => old.id === editId ? { ...old, ...e } : old); else entries.push({ ...e, id: crypto.randomUUID(), created_at: new Date().toISOString() }); saveLocal(); render(); } }
async function deleteEntry() { if (!editId || !confirm('ลบรายการนี้ใช่ไหม?')) return; try { if (user) { const { error } = await supabase.from('transactions').delete().eq('id', editId); if (error) throw error; await loadRemote(); } else { entries = entries.filter((e) => e.id !== editId); saveLocal(); render(); } $('#entry-dialog').close(); toast('ลบรายการแล้ว'); } catch (error) { toast(`ลบไม่สำเร็จ: ${error.message}`); } }

async function connectSupabase() { const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); if (!config) return; try { const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'); supabase = createClient(config.url, config.key); $('#auth-area').hidden = false; const { data: { session } } = await supabase.auth.getSession(); user = session?.user || null; if (user) await loadRemote(); else { entries = readLocal(); render(); } supabase.auth.onAuthStateChange((_event, session) => { const nextId = session?.user?.id || null; if (nextId === user?.id) return; user = session?.user || null; if (user) setTimeout(loadRemote, 0); else { entries = readLocal(); render(); } updateStorageLabel(); }); updateStorageLabel(); } catch (error) { supabase = null; $('#auth-area').hidden = true; toast(`เชื่อมต่อไม่สำเร็จ: ${error.message}`); } }
async function authSubmit(signup = false) { if (!supabase) return toast('กรุณาตั้งค่า Supabase ก่อน'); const email = $('#auth-email').value.trim(); const password = $('#auth-password').value; if (!email || password.length < 6) return toast('กรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร'); const { data, error } = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password }); if (error) return toast(error.message); if (data.session) { user = data.user; await loadRemote(); toast('เข้าสู่ระบบแล้ว'); } else toast('สมัครบัญชีแล้ว กรุณายืนยันอีเมลตามที่ Supabase ส่งให้'); updateStorageLabel(); }
async function uploadLocal() { if (!user) return; const local = readLocal(); if (!local.length || !confirm(`คัดลอก ${local.length} รายการจากเครื่องนี้ขึ้น Supabase ใช่ไหม?`)) return; const payload = local.map((e) => ({ user_id: user.id, type: e.type, amount: e.amount, title: e.title, category: e.category, entry_date: e.entry_date, note: e.note || '' })); const { error } = await supabase.from('transactions').insert(payload); if (error) return toast(`นำเข้าข้อมูลไม่สำเร็จ: ${error.message}`); localStorage.removeItem(LOCAL_KEY); await loadRemote(); toast('คัดลอกรายการขึ้น Supabase แล้ว'); }

function csvEscape(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function exportCsv() { const header = ['date', 'type', 'amount', 'title', 'category', 'note']; const lines = [header.join(','), ...ordered(entries).map((e) => [e.entry_date, e.type, e.amount, e.title, e.category, e.note || ''].map(csvEscape).join(','))]; const blob = new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `money-${dateKey(new Date())}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function parseCsv(text) { const rows = []; let row = [], cell = '', quoted = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; } else if (c === ',' && !quoted) { row.push(cell); cell = ''; } else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; } else cell += c; } row.push(cell); if (row.some(Boolean)) rows.push(row); return rows; }
async function importCsv(file) { if (user) return toast('กรุณาออกจากระบบก่อนนำเข้า CSV ในเครื่อง'); const rows = parseCsv((await file.text()).replace(/^\ufeff/, '')); if (rows.length < 2 || rows[0].join(',') !== 'date,type,amount,title,category,note') return toast('รูปแบบ CSV ไม่ถูกต้อง'); const imported = rows.slice(1).map(([date, type, amount, title, category, note]) => ({ id: crypto.randomUUID(), entry_date: date, type, amount: Number(amount), title, category, note, created_at: new Date().toISOString() })).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.entry_date) && ['income', 'expense'].includes(e.type) && e.amount > 0 && e.title); entries.push(...imported); saveLocal(); render(); toast(`นำเข้า ${imported.length} รายการแล้ว`); }

$$('[data-view]').forEach((a) => a.addEventListener('click', () => setView(a.dataset.view)));
$$('.add-trigger').forEach((b) => b.addEventListener('click', () => openEntry()));
$$('[data-period]').forEach((b) => b.addEventListener('click', () => { period = b.dataset.period; $$('[data-period]').forEach((x) => x.classList.toggle('active', x === b)); renderOverview(); }));
$$('[data-report]').forEach((b) => b.addEventListener('click', () => { reportMode = b.dataset.report; reportDate = new Date(); $$('[data-report]').forEach((x) => x.classList.toggle('active', x === b)); renderReports(); }));
$('#report-prev').addEventListener('click', () => { reportDate = reportMode === 'week' ? addDays(reportDate, -7) : new Date(reportDate.getFullYear(), reportDate.getMonth() - 1, 1); renderReports(); });
$('#report-next').addEventListener('click', () => { reportDate = reportMode === 'week' ? addDays(reportDate, 7) : new Date(reportDate.getFullYear(), reportDate.getMonth() + 1, 1); renderReports(); });
['search-input', 'type-filter', 'date-filter'].forEach((id) => $('#' + id).addEventListener('input', renderTransactions));
$('#clear-filters').addEventListener('click', () => { $('#search-input').value = ''; $('#type-filter').value = 'all'; $('#date-filter').value = ''; renderTransactions(); });
$('#all-list').addEventListener('click', (event) => { const id = event.target.closest('[data-edit]')?.dataset.edit; if (id) openEntry(entries.find((e) => e.id === id)); });
$('#close-dialog').addEventListener('click', () => $('#entry-dialog').close());
$$('[data-entry-type]').forEach((b) => b.addEventListener('click', () => setEntryType(b.dataset.entryType)));
$('#entry-form').addEventListener('submit', async (event) => { event.preventDefault(); const e = { type: entryType, amount: Number($('#entry-amount').value), title: $('#entry-title').value.trim(), category: $('#entry-category').value, entry_date: $('#entry-date').value, note: $('#entry-note').value.trim() }; if (!e.amount || e.amount <= 0 || !e.title || !e.entry_date) return toast('กรุณากรอกข้อมูลให้ครบ'); try { await saveEntry(e); $('#entry-dialog').close(); toast('บันทึกรายการแล้ว'); } catch (error) { toast(`บันทึกไม่สำเร็จ: ${error.message}`); } });
$('#delete-entry').addEventListener('click', deleteEntry);
$('#export-btn').addEventListener('click', exportCsv);
$('#import-input').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) importCsv(file); event.target.value = ''; });
$('#config-form').addEventListener('submit', async (event) => { event.preventDefault(); const url = $('#supabase-url').value.trim().replace(/\/$/, ''); const key = $('#supabase-key').value.trim(); if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_')) return toast('กรุณากรอก Supabase URL และ publishable key ให้ถูกต้อง'); localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key })); await connectSupabase(); if (supabase) toast('บันทึกการเชื่อมต่อแล้ว'); });
$('#auth-form').addEventListener('submit', (event) => { event.preventDefault(); authSubmit(false); });
$('#signup-btn').addEventListener('click', () => authSubmit(true));
$('#signout-btn').addEventListener('click', async () => { await supabase.auth.signOut(); user = null; entries = readLocal(); render(); toast('ออกจากระบบแล้ว'); });
$('#upload-local-btn').addEventListener('click', uploadLocal);
$('#today-label').textContent = titleDate(new Date());
const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); if (config) { $('#supabase-url').value = config.url; $('#supabase-key').value = config.key; connectSupabase(); }
const initialView = location.hash.slice(1); if (['overview', 'transactions', 'reports', 'settings'].includes(initialView)) setView(initialView);
window.addEventListener('hashchange', () => { const view = location.hash.slice(1); if (['overview', 'transactions', 'reports', 'settings'].includes(view)) setView(view); });
render();
