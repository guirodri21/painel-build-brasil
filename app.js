// ============================================================
// Build Brasil — Painel de Resultados v3
// ============================================================

let sb = null;
let user = null;
let ordens = [];
let despesas = [];
let lookups = { equipes: [], regioes: [], linhas: [] };
let filters = { regiao: '', equipe: '', linha: '', de: '', ate: '', busca: '' };
let ticketsPage = 1;
let ticketsSort = { col: 'data', asc: false };
let realtimeChannel = null;
const PER_PAGE = 12;

// === INIT ====================================================

document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  try {
    const lib = window.supabase;
    if (!lib || !lib.createClient) throw new Error('SDK não carregou');
    sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (data.session) await enterApp(data.session.user);
    else showLogin();
    watchAuth();
  } catch (e) {
    console.error('Init:', e);
    showLogin();
  }
  bindEvents();
  hideLoading();
});

// === AUTH STATE ==============================================

function watchAuth() {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
      // Sessão expirada ou logout (possivelmente em outra aba)
      if (user) toast('Sua sessão expirou. Faça login novamente.', true);
      teardownRealtime();
      user = null;
      showLogin();
    }
  });
}

function teardownRealtime() {
  if (realtimeChannel) { sb.removeChannel(realtimeChannel); realtimeChannel = null; }
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  el.classList.add('fade-out');
  setTimeout(() => el.style.display = 'none', 500);
}

// === THEME ===================================================

function loadTheme() {
  const t = localStorage.getItem('bb-theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  updateThemeBtn(t);
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('bb-theme', next);
  updateThemeBtn(next);
  if (!document.getElementById('app').classList.contains('hidden')) renderBalanco(filteredOrdens());
}
function updateThemeBtn(t) {
  const b = document.getElementById('btn-theme');
  if (b) b.innerHTML = t === 'dark'
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

// === TOAST ===================================================

function toast(msg, err) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// === AUTH ====================================================

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function enterApp(u) {
  user = u;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-email').textContent = u.email;
  document.getElementById('stamp-date').textContent = todayBR();
  await reloadAll();
}

function showSkeletons() {
  // Apenas containers que são totalmente reescritos no render (seguro):
  // KPIs e gráficos de barra. Tabelas e canvas são preservados.
  document.querySelectorAll('.kpi-strip').forEach(el => {
    el.innerHTML = Array(4).fill('<div class="skeleton skel-kpi"></div>').join('');
  });
  ['chart-vendas-regiao','chart-vendas-equipe','chart-vendas-linha','chart-tempo','chart-qualidade']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="skeleton skel-row w90"></div>' +
        '<div class="skeleton skel-row w60"></div>' +
        '<div class="skeleton skel-row w80"></div>';
    });
}

async function reloadAll() {
  clearLoadError();
  showSkeletons();
  try {
    await loadLookups();
    populateDropdowns();
    restoreFilters();
    await loadData();
    renderAll();
    restoreTab();
    setupRealtime();
  } catch (e) {
    console.error('Carregamento:', e);
    showLoadError(e);
  }
}

// === REALTIME ================================================

function setupRealtime() {
  if (realtimeChannel) return; // já inscrito
  realtimeChannel = sb.channel('painel-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens' }, silentReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'despesas_gerais' }, silentReload)
    .subscribe();
}

const silentReload = debounce(async () => {
  try {
    await loadData();
    renderAll();
  } catch (e) {
    console.error('Realtime reload:', e);
  }
}, 600);

async function manualRefresh() {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true; btn.classList.add('spinning');
  try {
    await loadData();
    renderAll();
    toast('Dados atualizados.');
  } catch (e) {
    toast('Erro ao atualizar: ' + (e?.message || ''), true);
  } finally {
    btn.disabled = false; btn.classList.remove('spinning');
  }
}

function showLoadError(e) {
  const bar = document.getElementById('load-error');
  if (!bar) return;
  bar.querySelector('.load-error-msg').textContent =
    'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.';
  bar.classList.remove('hidden');
  toast('Erro ao carregar dados: ' + (e?.message || 'desconhecido'), true);
}
function clearLoadError() {
  const bar = document.getElementById('load-error');
  if (bar) bar.classList.add('hidden');
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !pw) { errEl.textContent = 'Preencha e-mail e senha.'; return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Entrando...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  btn.disabled = false; btn.textContent = 'Entrar';
  if (error) { errEl.textContent = 'Credenciais inválidas.'; return; }
  await enterApp(data.user);
}

// === DATA ====================================================

async function loadLookups() {
  const [eq, rg, ls] = await Promise.all([
    sb.from('equipes').select('nome').order('nome'),
    sb.from('regioes').select('nome').order('nome'),
    sb.from('linhas_servico').select('nome').order('nome'),
  ]);
  const err = eq.error || rg.error || ls.error;
  if (err) throw err;
  lookups.equipes = (eq.data || []).map(r => r.nome);
  lookups.regioes = (rg.data || []).map(r => r.nome);
  lookups.linhas  = (ls.data || []).map(r => r.nome);
}

async function loadData() {
  const [o, d] = await Promise.all([
    sb.from('ordens').select('*').order('data', { ascending: false }),
    sb.from('despesas_gerais').select('*').order('data', { ascending: false }),
  ]);
  if (o.error || d.error) throw (o.error || d.error);
  ordens = o.data || [];
  despesas = d.data || [];
}

function filteredOrdens() {
  const q = filters.busca.toLowerCase();
  return ordens.filter(o => {
    if (filters.regiao && o.regiao !== filters.regiao) return false;
    if (filters.equipe && o.equipe !== filters.equipe) return false;
    if (filters.linha && o.linha_servico !== filters.linha) return false;
    if (filters.de && o.data < filters.de) return false;
    if (filters.ate && o.data > filters.ate) return false;
    if (q && ![o.cliente, o.resumo, o.equipe, o.regiao, o.linha_servico]
      .filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}

// === DROPDOWNS ===============================================

function populateDropdowns() {
  fill('filter-regiao', lookups.regioes, 'Todas');
  fill('filter-equipe', lookups.equipes, 'Todas');
  fill('filter-linha', lookups.linhas, 'Todas');
  const f = document.getElementById('form-ordem');
  fill(f.querySelector('[name="regiao"]'), lookups.regioes, 'Selecione');
  fill(f.querySelector('[name="equipe"]'), lookups.equipes, 'Selecione');
  fill(f.querySelector('[name="linha_servico"]'), lookups.linhas, 'Selecione');
}

function fill(el, items, ph) {
  el = typeof el === 'string' ? document.getElementById(el) : el;
  el.innerHTML = `<option value="">${ph}</option>` + items.map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
}

// === EVENTS ==================================================

function bindEvents() {
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  ['login-email', 'login-password'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); }));
  document.getElementById('btn-logout').addEventListener('click', async () => { await sb.auth.signOut(); user = null; showLogin(); });
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
  document.getElementById('btn-retry-load').addEventListener('click', reloadAll);
  document.getElementById('btn-refresh').addEventListener('click', manualRefresh);

  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  ['filter-regiao', 'filter-equipe', 'filter-linha', 'filter-de', 'filter-ate'].forEach(id =>
    document.getElementById(id).addEventListener('change', applyFilters));
  document.getElementById('filter-busca').addEventListener('input', debounce(applyFilters, 250));
  document.getElementById('btn-limpar').addEventListener('click', clearFilters);
  document.getElementById('btn-export').addEventListener('click', exportCSV);

  document.getElementById('btn-nova-ordem').addEventListener('click', () => openOrdem());
  document.getElementById('btn-nova-despesa').addEventListener('click', () => openDespesa());
  document.querySelectorAll('.btn-cancel-modal').forEach(b => b.addEventListener('click', () => closeAllModals()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

  document.getElementById('form-ordem').addEventListener('submit', saveOrdem);
  document.getElementById('form-despesa').addEventListener('submit', saveDespesa);
  document.getElementById('btn-senha').addEventListener('click', openSenha);
  document.getElementById('form-senha').addEventListener('submit', saveSenha);
  document.getElementById('senha-nova').addEventListener('input', e => updatePwMeter(e.target.value));

  document.querySelectorAll('#tbl-tickets th[data-sort]').forEach(th =>
    th.addEventListener('click', () => sortTickets(th.dataset.sort)));

  window.addEventListener('resize', () => {
    if (!document.getElementById('app').classList.contains('hidden')) renderBalanco(filteredOrdens());
  });
}

// === FILTERS =================================================

function applyFilters() {
  filters.regiao = document.getElementById('filter-regiao').value;
  filters.equipe = document.getElementById('filter-equipe').value;
  filters.linha  = document.getElementById('filter-linha').value;
  filters.de     = document.getElementById('filter-de').value;
  filters.ate    = document.getElementById('filter-ate').value;
  filters.busca  = document.getElementById('filter-busca').value;
  ticketsPage = 1;
  saveFilters();
  renderAll();
}
function clearFilters() {
  ['filter-regiao','filter-equipe','filter-linha','filter-de','filter-ate','filter-busca']
    .forEach(id => document.getElementById(id).value = '');
  filters = { regiao:'', equipe:'', linha:'', de:'', ate:'', busca:'' };
  ticketsPage = 1;
  saveFilters();
  renderAll();
}

function saveFilters() {
  localStorage.setItem('bb-filters', JSON.stringify(filters));
}
function restoreFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem('bb-filters') || '{}');
    filters = { regiao:'', equipe:'', linha:'', de:'', ate:'', busca:'', ...saved };
    const map = { regiao:'filter-regiao', equipe:'filter-equipe', linha:'filter-linha',
                  de:'filter-de', ate:'filter-ate', busca:'filter-busca' };
    Object.entries(map).forEach(([k, id]) => {
      const el = document.getElementById(id);
      if (el) el.value = filters[k] || '';
    });
  } catch { /* ignora json inválido */ }
}
window.applyFilterFromBar = function(field, val) {
  const map = { regiao:'filter-regiao', equipe:'filter-equipe', linha:'filter-linha' };
  document.getElementById(map[field]).value = val;
  applyFilters();
};

// === TABS ====================================================

function switchTab(id) {
  const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
  localStorage.setItem('bb-tab', id);
}

function restoreTab() {
  const id = localStorage.getItem('bb-tab');
  if (id && document.querySelector(`.tab-btn[data-tab="${id}"]`)) switchTab(id);
}

// === MODALS ==================================================

function openOrdem(o) {
  const f = document.getElementById('form-ordem');
  f.reset();
  f.querySelector('[name="id"]').value = '';
  document.getElementById('modal-ordem-title').textContent = 'Nova Ordem';
  if (o) {
    document.getElementById('modal-ordem-title').textContent = 'Editar Ordem';
    f.querySelector('[name="id"]').value = o.id;
    for (const k of ['data','status','regiao','equipe','linha_servico','cliente','valor_venda','despesa_direta','resumo'])
      if (f.querySelector(`[name="${k}"]`)) f.querySelector(`[name="${k}"]`).value = o[k] ?? '';
    f.querySelector('[name="tempo_execucao_h"]').value = o.tempo_execucao_h ?? '';
    f.querySelector('[name="qualidade"]').value = o.qualidade ?? '';
  } else {
    f.querySelector('[name="data"]').value = todayISO();
  }
  document.getElementById('modal-ordem').classList.add('open');
}
function openDespesa(d) {
  const f = document.getElementById('form-despesa');
  f.reset();
  f.querySelector('[name="id"]').value = '';
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa Geral';
  if (d) {
    document.getElementById('modal-despesa-title').textContent = 'Editar Despesa';
    f.querySelector('[name="id"]').value = d.id;
    f.querySelector('[name="data"]').value = d.data;
    f.querySelector('[name="categoria"]').value = d.categoria;
    f.querySelector('[name="descricao"]').value = d.descricao || '';
    f.querySelector('[name="valor"]').value = d.valor;
  } else {
    f.querySelector('[name="data"]').value = todayISO();
  }
  document.getElementById('modal-despesa').classList.add('open');
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

// === ALTERAR SENHA ===========================================

const PW_RULES = {
  len:   s => s.length >= 8,
  upper: s => /[A-Z]/.test(s),
  lower: s => /[a-z]/.test(s),
  num:   s => /[0-9]/.test(s),
};

function openSenha() {
  const f = document.getElementById('form-senha');
  f.reset();
  document.getElementById('senha-error').textContent = '';
  updatePwMeter('');
  document.getElementById('modal-senha').classList.add('open');
}

function pwScore(s) {
  return Object.values(PW_RULES).reduce((n, fn) => n + (fn(s) ? 1 : 0), 0);
}

function updatePwMeter(s) {
  const score = pwScore(s);
  const fill = document.getElementById('pw-meter-fill');
  const pct = (score / 4) * 100;
  const cls = score <= 1 ? 'weak' : score === 2 ? 'mid' : score === 3 ? 'ok' : 'strong';
  fill.style.width = pct + '%';
  fill.className = 'pw-meter-fill ' + cls;
  document.querySelectorAll('#pw-rules li').forEach(li => {
    li.classList.toggle('ok', PW_RULES[li.dataset.rule](s));
  });
}

async function saveSenha(e) {
  e.preventDefault();
  const senha = document.getElementById('senha-nova').value;
  const confirma = document.getElementById('senha-confirma').value;
  const errEl = document.getElementById('senha-error');
  errEl.textContent = '';

  if (pwScore(senha) < 4) { errEl.textContent = 'A senha não atende a todos os requisitos.'; return; }
  if (senha !== confirma) { errEl.textContent = 'As senhas não coincidem.'; return; }

  const btn = e.target.querySelector('.btn-primary');
  btn.disabled = true; btn.textContent = 'Salvando...';
  const { error } = await sb.auth.updateUser({ password: senha });
  btn.disabled = false; btn.textContent = 'Salvar';
  if (error) { errEl.textContent = 'Erro: ' + error.message; return; }
  closeAllModals();
  toast('Senha alterada com sucesso.');
}

function confirmDialog(msg) {
  return new Promise(resolve => {
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('modal-confirm').classList.add('open');
    const yes = document.getElementById('confirm-yes');
    const no = document.getElementById('confirm-no');
    function cleanup(val) { document.getElementById('modal-confirm').classList.remove('open'); yes.replaceWith(yes.cloneNode(true)); no.replaceWith(no.cloneNode(true)); resolve(val); }
    document.getElementById('confirm-yes').addEventListener('click', () => cleanup(true), { once: true });
    document.getElementById('confirm-no').addEventListener('click', () => cleanup(false), { once: true });
  });
}

// === CRUD ====================================================

async function saveOrdem(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.btn-primary');
  if (btn.disabled) return;
  btn.disabled = true; btn.textContent = 'Salvando...';

  const fd = new FormData(e.target);
  const id = fd.get('id');
  const rec = {
    data: fd.get('data'), regiao: fd.get('regiao'), equipe: fd.get('equipe'),
    linha_servico: fd.get('linha_servico'), cliente: fd.get('cliente') || null,
    valor_venda: parseFloat(fd.get('valor_venda')) || 0,
    despesa_direta: parseFloat(fd.get('despesa_direta')) || 0,
    status: fd.get('status'),
    tempo_execucao_h: fd.get('tempo_execucao_h') ? parseFloat(fd.get('tempo_execucao_h')) : null,
    qualidade: fd.get('qualidade') ? parseInt(fd.get('qualidade')) : null,
    resumo: fd.get('resumo') || null,
  };

  let error;
  if (id) ({ error } = await sb.from('ordens').update(rec).eq('id', id));
  else { rec.created_by = user.id; ({ error } = await sb.from('ordens').insert([rec])); }

  btn.disabled = false; btn.textContent = 'Salvar';
  if (error) { toast('Erro: ' + error.message, true); return; }
  closeAllModals();
  await loadData(); renderAll();
  toast(id ? 'Ordem atualizada.' : 'Ordem salva.');
}

async function saveDespesa(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.btn-primary');
  if (btn.disabled) return;
  btn.disabled = true; btn.textContent = 'Salvando...';

  const fd = new FormData(e.target);
  const id = fd.get('id');
  const rec = {
    data: fd.get('data'), categoria: fd.get('categoria'),
    descricao: fd.get('descricao') || null, valor: parseFloat(fd.get('valor')) || 0,
  };

  let error;
  if (id) ({ error } = await sb.from('despesas_gerais').update(rec).eq('id', id));
  else { rec.created_by = user.id; ({ error } = await sb.from('despesas_gerais').insert([rec])); }

  btn.disabled = false; btn.textContent = 'Salvar';
  if (error) { toast('Erro: ' + error.message, true); return; }
  closeAllModals();
  await loadData(); renderAll();
  toast(id ? 'Despesa atualizada.' : 'Despesa salva.');
}

window.editOrdem = id => { const o = ordens.find(x => x.id === id); if (o) openOrdem(o); };
window.deleteOrdem = async id => {
  if (!await confirmDialog('Excluir esta ordem permanentemente?')) return;
  const { error } = await sb.from('ordens').delete().eq('id', id);
  if (error) { toast('Erro: ' + error.message, true); return; }
  await loadData(); renderAll(); toast('Ordem excluída.');
};
window.setTicketsPage = p => { ticketsPage = p; renderOps(filteredOrdens()); };

// === SORT ====================================================

function sortTickets(col) {
  if (ticketsSort.col === col) ticketsSort.asc = !ticketsSort.asc;
  else { ticketsSort.col = col; ticketsSort.asc = true; }
  document.querySelectorAll('#tbl-tickets th').forEach(th => th.classList.remove('sorted'));
  const th = document.querySelector(`#tbl-tickets th[data-sort="${col}"]`);
  if (th) { th.classList.add('sorted'); th.querySelector('.sort-arrow').textContent = ticketsSort.asc ? '^' : 'v'; }
  renderOps(filteredOrdens());
}

// === EXPORT ==================================================

function exportCSV() {
  const data = filteredOrdens();
  if (!data.length) { toast('Sem dados para exportar.', true); return; }
  const h = ['Data','Região','Equipe','Linha','Cliente','Valor Venda','Despesa Direta','Status','Tempo (h)','Qualidade','Resumo'];
  const rows = data.map(o => [o.data, o.regiao, o.equipe, o.linha_servico, o.cliente||'',
    o.valor_venda, o.despesa_direta, statusLabel(o.status), o.tempo_execucao_h??'', o.qualidade??'',
    (o.resumo||'').replace(/"/g,'""')]);
  const csv = '﻿' + [h.join(';'), ...rows.map(r => r.map(v => `"${v}"`).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
  a.download = `build-brasil-${todayISO()}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('CSV exportado.');
}

// === CALC ====================================================

function calcVendas(d) {
  const total = sum(d, 'valor_venda'), n = d.length;
  return { total, n, ticket: n ? total / n : 0 };
}
function calcOps(d) {
  const done = d.filter(o => o.status === 'concluido');
  const ct = done.filter(o => o.tempo_execucao_h != null);
  const cq = d.filter(o => o.qualidade != null);
  const andamento = d.filter(o => o.status === 'em_andamento').length;
  return {
    tempoMedio: ct.length ? ct.reduce((s,o) => s + +o.tempo_execucao_h, 0) / ct.length : 0,
    qualMedia: cq.length ? cq.reduce((s,o) => s + +o.qualidade, 0) / cq.length : 0,
    taxaConc: d.length ? (done.length / d.length) * 100 : 0,
    andamento, concluidas: done.length,
  };
}
function calcRateio(d) {
  const recTotal = sum(d, 'valor_venda');
  const despTotal = despesas.reduce((s,x) => s + +x.valor, 0);
  const byEq = groupBy(d, 'equipe');
  const res = {};
  lookups.equipes.forEach(eq => {
    const items = byEq[eq] || [];
    const rec = sum(items, 'valor_venda');
    const dd = sum(items, 'despesa_direta');
    const prop = recTotal > 0 ? rec / recTotal : 0;
    const dr = despTotal * prop;
    const saldo = rec - dd - dr;
    const margem = rec > 0 ? (saldo / rec) * 100 : 0;
    res[eq] = { rec, dd, dr, saldo, margem, n: items.length };
  });
  return { res, recTotal, despTotal };
}
function groupBy(a, k) { const m = {}; a.forEach(i => { (m[i[k]] = m[i[k]] || []).push(i); }); return m; }
function sum(a, f) { return a.reduce((s,o) => s + (+o[f] || 0), 0); }

// === RENDER ==================================================

function renderAll() {
  const d = filteredOrdens();
  renderGeral(d);
  renderVendas(d);
  renderOps(d);
  renderFin(d);
  const andamento = d.filter(o => o.status === 'em_andamento').length;
  const badge = document.getElementById('badge-andamento');
  if (andamento > 0) { badge.textContent = andamento; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

// --- Geral ---
function renderGeral(d) {
  const v = calcVendas(d), op = calcOps(d);
  const { res, recTotal, despTotal } = calcRateio(d);
  const saldo = recTotal - sum(d, 'despesa_direta') - despTotal;

  document.getElementById('kpi-geral').innerHTML = kpi([
    { val: cur(recTotal), lbl: 'Receita Total', cls: '' },
    { val: cur(saldo), lbl: 'Saldo Geral', cls: saldo >= 0 ? 'verde' : 'erro' },
    { val: v.n, lbl: 'Ordens', cls: 'teal' },
    { val: op.qualMedia.toFixed(0), lbl: 'Qualidade Média', cls: op.qualMedia < 80 ? 'laranja' : 'teal' },
    { val: op.andamento, lbl: 'Em Andamento', cls: op.andamento > 0 ? 'laranja' : '' },
  ]);

  const alerts = [];
  const entries = Object.entries(res).filter(([,v]) => v.n > 0);
  if (entries.length) {
    const lider = entries.sort((a,b) => b[1].saldo - a[1].saldo)[0];
    alerts.push({ t: `Equipe líder: ${lider[0]} (${cur(lider[1].saldo)})`, c: 'positivo', i: '+' });
    entries.forEach(([eq,x]) => { if (x.saldo < 0) alerts.push({ t: `${eq}: saldo negativo (${cur(x.saldo)})`, c: 'critico', i: '!' }); });
  }
  if (op.qualMedia > 0 && op.qualMedia < 80) alerts.push({ t: `Qualidade geral abaixo de 80 (${op.qualMedia.toFixed(0)})`, c: 'atencao', i: '!' });
  if (op.tempoMedio > 80) alerts.push({ t: `Tempo médio alto: ${op.tempoMedio.toFixed(1)}h`, c: 'atencao', i: '!' });
  if (op.andamento > 3) alerts.push({ t: `${op.andamento} ordens em aberto`, c: 'atencao', i: '!' });
  const byEqQ = groupBy(d.filter(o => o.qualidade != null), 'equipe');
  Object.entries(byEqQ).forEach(([eq, items]) => {
    const m = items.reduce((s,o) => s + +o.qualidade, 0) / items.length;
    if (m < 80) alerts.push({ t: `${eq}: qualidade ${m.toFixed(0)}/100`, c: 'atencao', i: '!' });
  });

  document.getElementById('alerts-container').innerHTML = alerts.length
    ? alerts.map(a => `<span class="alert-tag ${a.c}"><i class="alert-icon">${a.i}</i>${esc(a.t)}</span>`).join('')
    : '<span class="text-muted mono" style="font-size:0.75rem;">Nenhum alerta no período.</span>';

  const tbody = document.querySelector('#tbl-equipe-geral tbody');
  tbody.innerHTML = lookups.equipes.map(eq => {
    const x = res[eq], items = (groupBy(d,'equipe')[eq] || []);
    const cq = items.filter(o => o.qualidade != null);
    const qm = cq.length ? (cq.reduce((s,o) => s + +o.qualidade, 0) / cq.length) : null;
    return `<tr>
      <td class="fw-600">${esc(eq)}</td>
      <td class="text-right">${cur(x.rec)}</td>
      <td class="text-right">${cur(x.dd)}</td>
      <td class="text-right">${cur(x.dr)}</td>
      <td class="text-right fw-600" style="color:${x.saldo >= 0 ? 'var(--verde)' : 'var(--erro)'}">${cur(x.saldo)}</td>
      <td class="text-right">${x.n}</td>
      <td class="text-right">${qm != null ? qualityBar(qm) : '—'}</td>
    </tr>`;
  }).join('');
}

// --- Vendas ---
function renderVendas(d) {
  const v = calcVendas(d);
  document.getElementById('kpi-vendas').innerHTML = kpi([
    { val: cur(v.total), lbl: 'Total de Vendas', cls: '' },
    { val: cur(v.ticket), lbl: 'Ticket Médio', cls: 'teal' },
    { val: v.n, lbl: 'Nº de Ordens', cls: '' },
  ]);
  barChart('chart-vendas-regiao', groupBy(d,'regiao'), 'valor_venda', '', 'regiao');
  barChart('chart-vendas-equipe', groupBy(d,'equipe'), 'valor_venda', 'teal', 'equipe');
  barChart('chart-vendas-linha', groupBy(d,'linha_servico'), 'valor_venda', 'verde');
}

// --- Operações ---
function renderOps(d) {
  const op = calcOps(d);
  document.getElementById('kpi-ops').innerHTML = kpi([
    { val: op.tempoMedio.toFixed(1) + 'h', lbl: 'Tempo Médio', cls: '' },
    { val: op.qualMedia.toFixed(0), lbl: 'Qualidade Média', cls: 'teal' },
    { val: op.taxaConc.toFixed(0) + '%', lbl: 'Taxa Conclusão', cls: 'verde' },
    { val: op.andamento, lbl: 'Em Andamento', cls: op.andamento > 0 ? 'laranja' : '' },
  ]);

  const byEq = groupBy(d, 'equipe');
  const tempoMap = {}, qualMap = {};
  Object.entries(byEq).forEach(([eq, items]) => {
    const c = items.filter(o => o.status === 'concluido' && o.tempo_execucao_h != null);
    if (c.length) tempoMap[eq] = c.reduce((s,o) => s + +o.tempo_execucao_h, 0) / c.length;
    const q = items.filter(o => o.qualidade != null);
    if (q.length) qualMap[eq] = q.reduce((s,o) => s + +o.qualidade, 0) / q.length;
  });
  valueBarChart('chart-tempo', tempoMap, 'h', 'teal');
  valueBarChart('chart-qualidade', qualMap, '', 'verde', 100);

  // Tickets com sort
  let sorted = [...d];
  const sc = ticketsSort.col, sa = ticketsSort.asc;
  sorted.sort((a,b) => {
    let va = a[sc] ?? '', vb = b[sc] ?? '';
    if (typeof va === 'number') return sa ? va - vb : vb - va;
    va = String(va); vb = String(vb);
    return sa ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const total = sorted.length, pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (ticketsPage > pages) ticketsPage = pages;
  const page = sorted.slice((ticketsPage - 1) * PER_PAGE, ticketsPage * PER_PAGE);

  document.querySelector('#tbl-tickets tbody').innerHTML = page.length
    ? page.map(o => {
      const own = user && o.created_by === user.id;
      const q = o.qualidade != null ? qualityBar(o.qualidade) : '—';
      return `<tr>
        <td>${fmtDate(o.data)}</td>
        <td>${esc(o.equipe)}</td>
        <td>${esc(o.regiao)}</td>
        <td>${esc(o.cliente || '—')}</td>
        <td class="text-right">${cur(o.valor_venda)}</td>
        <td><span class="status-tag ${o.status}">${statusLabel(o.status)}</span></td>
        <td>${q}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(o.resumo||'')}">${esc(o.resumo || '—')}</td>
        <td>${own ? `<div class="row-actions"><button class="btn-row" onclick="editOrdem('${o.id}')">Edit</button><button class="btn-row danger" onclick="deleteOrdem('${o.id}')">Del</button></div>` : ''}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="9" class="empty-state">Nenhuma ordem encontrada.</td></tr>';

  document.getElementById('pag-tickets').innerHTML = pages > 1
    ? `<button onclick="setTicketsPage(${ticketsPage-1})" ${ticketsPage<=1?'disabled':''}>&lt; Ant.</button>
       <span class="page-info">${ticketsPage} / ${pages}</span>
       <button onclick="setTicketsPage(${ticketsPage+1})" ${ticketsPage>=pages?'disabled':''}>Próx. &gt;</button>`
    : '';
}

// --- Financeiro ---
function renderFin(d) {
  const { res, recTotal, despTotal } = calcRateio(d);
  const ddTotal = sum(d, 'despesa_direta');
  const saldo = recTotal - ddTotal - despTotal;
  const margem = recTotal > 0 ? (saldo / recTotal) * 100 : 0;

  document.getElementById('kpi-fin').innerHTML = kpi([
    { val: cur(recTotal), lbl: 'Receita', cls: '' },
    { val: cur(ddTotal + despTotal), lbl: 'Despesas Totais', cls: 'laranja' },
    { val: cur(saldo), lbl: 'Saldo', cls: saldo >= 0 ? 'verde' : 'erro' },
    { val: margem.toFixed(1) + '%', lbl: 'Margem', cls: margem >= 0 ? 'verde' : 'erro' },
    { val: cur(despTotal), lbl: 'Desp. Gerais', cls: 'teal' },
  ]);

  document.querySelector('#tbl-fin-equipe tbody').innerHTML = lookups.equipes.map(eq => {
    const x = res[eq];
    return `<tr>
      <td class="fw-600">${esc(eq)}</td>
      <td class="text-right">${cur(x.rec)}</td>
      <td class="text-right">${cur(x.dd)}</td>
      <td class="text-right">${cur(x.dr)}</td>
      <td class="text-right fw-600" style="color:${x.saldo>=0?'var(--verde)':'var(--erro)'}">${cur(x.saldo)}</td>
      <td class="text-right" style="color:${x.margem>=0?'var(--verde)':'var(--erro)'}">${x.rec > 0 ? x.margem.toFixed(1)+'%' : '—'}</td>
    </tr>`;
  }).join('');

  renderBalanco(d);
}

// === BAR CHARTS ==============================================

function barChart(containerId, grouped, field, css, filterField) {
  const entries = Object.entries(grouped).map(([l, items]) => ({ l, v: sum(items, field) }));
  entries.sort((a,b) => b.v - a.v);
  const max = entries.length ? Math.max(...entries.map(e => e.v)) : 1;
  const total = entries.reduce((s,e) => s + e.v, 0);
  const el = document.getElementById(containerId);
  if (!entries.length) { el.innerHTML = '<div class="empty-state">Sem dados.</div>'; return; }
  el.innerHTML = '<div class="bar-chart">' + entries.map(e => {
    const pct = max > 0 ? (e.v / max) * 100 : 0;
    const pctT = total > 0 ? ((e.v / total) * 100).toFixed(1) : '0';
    const active = filterField && filters[filterField] === e.l ? ' active' : '';
    const click = filterField ? ` onclick="applyFilterFromBar('${filterField}','${esc(e.l)}')"` : '';
    return `<div class="bar-row${active}"${click}>
      <span class="bar-label">${esc(e.l)}</span>
      <div class="bar-track"><div class="bar-fill ${css}" style="width:${pct}%"></div><span class="bar-pct">${pctT}%</span></div>
      <span class="bar-value">${cur(e.v)}</span>
    </div>`;
  }).join('') + '</div>';
}

function valueBarChart(containerId, dataMap, suffix, css, maxOverride) {
  const entries = Object.entries(dataMap).map(([l,v]) => ({ l, v }));
  entries.sort((a,b) => b.v - a.v);
  const max = maxOverride || (entries.length ? Math.max(...entries.map(e => e.v)) : 1);
  const el = document.getElementById(containerId);
  if (!entries.length) { el.innerHTML = '<div class="empty-state">Sem dados.</div>'; return; }
  el.innerHTML = '<div class="bar-chart">' + entries.map(e => {
    const pct = max > 0 ? (e.v / max) * 100 : 0;
    return `<div class="bar-row">
      <span class="bar-label">${esc(e.l)}</span>
      <div class="bar-track"><div class="bar-fill ${css}" style="width:${pct}%"></div></div>
      <span class="bar-value">${e.v.toFixed(1)}${suffix}</span>
    </div>`;
  }).join('') + '</div>';
}

// === CANVAS CHART ============================================

function renderBalanco(data) {
  const canvas = document.getElementById('canvas-balanco');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const txt = dark ? '#D0D8E0' : '#14202E';
  const grid = dark ? '#253545' : '#B0BEC5';
  const lbl = dark ? '#7A8FA0' : '#607D8B';

  const byM = {};
  data.forEach(o => {
    const m = o.data.substring(0,7);
    if (!byM[m]) byM[m] = { r:0, dd:0, dg:0 };
    byM[m].r += +o.valor_venda; byM[m].dd += +o.despesa_direta;
  });
  despesas.forEach(d => {
    const m = d.data.substring(0,7);
    if (!byM[m]) byM[m] = { r:0, dd:0, dg:0 };
    byM[m].dg += +d.valor;
  });

  const months = Object.keys(byM).sort();
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width; canvas.height = 260;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!months.length) return;

  const pad = { t:25, r:20, b:35, l:65 };
  const w = canvas.width - pad.l - pad.r, h = canvas.height - pad.t - pad.b;
  const vals = months.map(m => ({ m, r: byM[m].r, d: byM[m].dd + byM[m].dg, s: byM[m].r - byM[m].dd - byM[m].dg }));
  const all = vals.flatMap(v => [v.r, v.d, v.s]);
  const mx = Math.max(...all, 1), mn = Math.min(...all, 0), rng = mx - mn || 1;

  ctx.font = '10px "IBM Plex Mono"'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const val = mn + (rng * i / 4);
    const y = pad.t + h - (h * (val - mn) / rng);
    ctx.strokeStyle = grid; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
    ctx.fillStyle = lbl; ctx.textAlign = 'right';
    ctx.fillText(shortCur(val), pad.l - 6, y);
  }

  const gw = w / months.length, bw = Math.min(gw * 0.22, 26), gap = bw * 0.15;
  const colors = dark
    ? { r:'#4D8FE0', d:'#E8845A', s:'#2BAA6A' }
    : { r:'#1B4D96', d:'#D4531A', s:'#157A4E' };
  const zeroY = pad.t + h - (h * (0 - mn) / rng);

  vals.forEach((v, i) => {
    const cx = pad.l + gw * i + gw / 2;
    const ry = pad.t + h - (h * (v.r - mn) / rng);
    ctx.fillStyle = colors.r; ctx.fillRect(cx - bw*1.5 - gap, ry, bw, zeroY - ry);
    const dy = pad.t + h - (h * (v.d - mn) / rng);
    ctx.fillStyle = colors.d; ctx.fillRect(cx - bw/2, dy, bw, zeroY - dy);
    const sy = pad.t + h - (h * (v.s - mn) / rng);
    ctx.fillStyle = colors.s;
    v.s >= 0 ? ctx.fillRect(cx + bw/2 + gap, sy, bw, zeroY - sy) : ctx.fillRect(cx + bw/2 + gap, zeroY, bw, Math.abs(zeroY - sy));
    ctx.fillStyle = txt; ctx.textAlign = 'center';
    ctx.fillText(v.m, cx, pad.t + h + 18);
  });

  let lx = pad.l;
  [{ l:'Receita', c:colors.r },{ l:'Despesa', c:colors.d },{ l:'Saldo', c:colors.s }].forEach(it => {
    ctx.fillStyle = it.c; ctx.fillRect(lx, 6, 10, 10);
    ctx.fillStyle = txt; ctx.textAlign = 'left';
    ctx.fillText(it.l, lx + 14, 11);
    lx += ctx.measureText(it.l).width + 28;
  });
}

// === KPI HELPER ==============================================

function kpi(items) {
  return items.map(i => `<div class="kpi-item"><div class="kpi-lbl">${i.lbl}</div><div class="kpi-val ${i.cls}">${i.val}</div></div>`).join('');
}

function qualityBar(val) {
  const v = +val;
  const cls = v >= 85 ? 'high' : v >= 70 ? 'mid' : 'low';
  return `<span class="quality-bar"><span class="quality-track"><span class="quality-fill ${cls}" style="width:${v}%"></span></span> ${v}</span>`;
}

// === UTIL ====================================================

function cur(v) { return 'R$ ' + (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function shortCur(v) { return Math.abs(v) >= 1000 ? 'R$ ' + (v/1000).toFixed(0) + 'k' : 'R$ ' + v.toFixed(0); }
function fmtDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }
function todayISO() { return new Date().toISOString().split('T')[0]; }
function todayBR() { const d = new Date(); return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`; }
function statusLabel(s) { return { concluido:'Concluído', execucao_parcial:'Exec. Parcial', em_andamento:'Em Andamento' }[s] || s; }
function esc(s) { const e = document.createElement('span'); e.textContent = s; return e.innerHTML; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
