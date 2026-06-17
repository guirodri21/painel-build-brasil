// ============================================================
// Build Brasil — App principal
// ============================================================

// --- Estado global ---
let sb = null;
let currentUser = null;
let ordens = [];
let despesasGerais = [];
let lookups = { equipes: [], regioes: [], linhas: [] };
let filters = { regiao: '', equipe: '', linha: '', dataInicio: '', dataFim: '', busca: '' };
let ticketsPage = 1;
const TICKETS_PER_PAGE = 10;

function initSupabase() {
  const lib = window.supabase;
  if (!lib || !lib.createClient) {
    console.error('Supabase JS não carregou. Verifique a conexão.');
    return null;
  }
  return lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  try {
    sb = initSupabase();
    if (!sb) throw new Error('Supabase indisponível');
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (data.session) {
      await enterApp(data.session.user);
    } else {
      showLogin();
    }
    setupEventListeners();
  } catch (err) {
    console.error('Erro na inicialização:', err);
    showLogin();
    setupEventListeners();
  }
  hideLoading();
});

// ============================================================
// LOADING
// ============================================================

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  el.classList.add('fade-out');
  setTimeout(() => el.style.display = 'none', 400);
}

// ============================================================
// TEMA (claro/escuro)
// ============================================================

function loadTheme() {
  const saved = localStorage.getItem('bb-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('bb-theme', next);
  updateThemeIcon(next);
  const data = filteredOrdens();
  renderBalancoChart(data);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
}

// ============================================================
// TOAST
// ============================================================

function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function enterApp(user) {
  currentUser = user;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-email').textContent = user.email;
  await loadLookups();
  populateFilterDropdowns();
  populateFormDropdowns();
  await loadData();
  renderAll();
}

function setupEventListeners() {
  // Login
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('login-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // Tema
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  // Abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Filtros
  document.getElementById('filter-regiao').addEventListener('change', applyFilters);
  document.getElementById('filter-equipe').addEventListener('change', applyFilters);
  document.getElementById('filter-linha').addEventListener('change', applyFilters);
  document.getElementById('filter-data-inicio').addEventListener('change', applyFilters);
  document.getElementById('filter-data-fim').addEventListener('change', applyFilters);
  document.getElementById('filter-busca').addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);

  // Exportar
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  // Modais
  document.getElementById('btn-nova-ordem').addEventListener('click', () => openOrdemModal());
  document.getElementById('btn-nova-despesa').addEventListener('click', () => openDespesaModal());
  document.getElementById('btn-cancel-ordem').addEventListener('click', () => closeModal('modal-ordem'));
  document.getElementById('btn-cancel-despesa').addEventListener('click', () => closeModal('modal-despesa'));

  // Forms
  document.getElementById('form-ordem').addEventListener('submit', handleSaveOrdem);
  document.getElementById('form-despesa').addEventListener('submit', handleSaveDespesa);

  // Fechar modal com Esc
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modal-ordem');
      closeModal('modal-despesa');
    }
  });

  // Redimensionar gráfico canvas
  window.addEventListener('resize', () => {
    if (!document.getElementById('app').classList.contains('hidden')) {
      renderBalancoChart(filteredOrdens());
    }
  });
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  if (!email || !password) {
    errorEl.textContent = 'Preencha e-mail e senha.';
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = 'Credenciais inválidas.';
    return;
  }
  await enterApp(data.user);
}

async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null;
  showLogin();
}

// ============================================================
// DADOS
// ============================================================

async function loadLookups() {
  const [eq, rg, ls] = await Promise.all([
    sb.from('equipes').select('nome').order('nome'),
    sb.from('regioes').select('nome').order('nome'),
    sb.from('linhas_servico').select('nome').order('nome'),
  ]);
  lookups.equipes = (eq.data || []).map(r => r.nome);
  lookups.regioes = (rg.data || []).map(r => r.nome);
  lookups.linhas  = (ls.data || []).map(r => r.nome);
}

async function loadData() {
  const [ord, desp] = await Promise.all([
    sb.from('ordens').select('*').order('data', { ascending: false }),
    sb.from('despesas_gerais').select('*').order('data', { ascending: false }),
  ]);
  ordens = ord.data || [];
  despesasGerais = desp.data || [];
}

function filteredOrdens() {
  const q = filters.busca.toLowerCase();
  return ordens.filter(o => {
    if (filters.regiao && o.regiao !== filters.regiao) return false;
    if (filters.equipe && o.equipe !== filters.equipe) return false;
    if (filters.linha && o.linha_servico !== filters.linha) return false;
    if (filters.dataInicio && o.data < filters.dataInicio) return false;
    if (filters.dataFim && o.data > filters.dataFim) return false;
    if (q) {
      const haystack = [o.cliente, o.resumo, o.equipe, o.regiao, o.linha_servico]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ============================================================
// DROPDOWNS
// ============================================================

function populateFilterDropdowns() {
  fillSelect('filter-regiao', lookups.regioes, 'Todas');
  fillSelect('filter-equipe', lookups.equipes, 'Todas');
  fillSelect('filter-linha', lookups.linhas, 'Todas');
}

function populateFormDropdowns() {
  const formOrdem = document.getElementById('form-ordem');
  fillSelect(formOrdem.querySelector('[name="regiao"]'), lookups.regioes, 'Selecione');
  fillSelect(formOrdem.querySelector('[name="equipe"]'), lookups.equipes, 'Selecione');
  fillSelect(formOrdem.querySelector('[name="linha_servico"]'), lookups.linhas, 'Selecione');
}

function fillSelect(elOrId, items, placeholder) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  el.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
}

// ============================================================
// FILTROS
// ============================================================

function applyFilters() {
  filters.regiao     = document.getElementById('filter-regiao').value;
  filters.equipe     = document.getElementById('filter-equipe').value;
  filters.linha      = document.getElementById('filter-linha').value;
  filters.dataInicio = document.getElementById('filter-data-inicio').value;
  filters.dataFim    = document.getElementById('filter-data-fim').value;
  filters.busca      = document.getElementById('filter-busca').value;
  ticketsPage = 1;
  renderAll();
}

function clearFilters() {
  document.getElementById('filter-regiao').value = '';
  document.getElementById('filter-equipe').value = '';
  document.getElementById('filter-linha').value = '';
  document.getElementById('filter-data-inicio').value = '';
  document.getElementById('filter-data-fim').value = '';
  document.getElementById('filter-busca').value = '';
  filters = { regiao: '', equipe: '', linha: '', dataInicio: '', dataFim: '', busca: '' };
  ticketsPage = 1;
  renderAll();
}

function applyFilterFromBar(field, value) {
  const map = { regiao: 'filter-regiao', equipe: 'filter-equipe', linha: 'filter-linha' };
  const el = document.getElementById(map[field]);
  if (el) {
    el.value = value;
    applyFilters();
  }
}

// ============================================================
// EXPORTAR CSV
// ============================================================

function exportCSV() {
  const data = filteredOrdens();
  if (data.length === 0) { toast('Nenhum dado para exportar.', true); return; }

  const headers = ['Data','Região','Equipe','Linha de Serviço','Cliente','Valor Venda','Despesa Direta','Status','Tempo (h)','Qualidade','Resumo'];
  const rows = data.map(o => [
    o.data, o.regiao, o.equipe, o.linha_servico, o.cliente || '',
    o.valor_venda, o.despesa_direta, statusLabel(o.status),
    o.tempo_execucao_h ?? '', o.qualidade ?? '', (o.resumo || '').replace(/"/g, '""'),
  ]);

  const csv = [headers.join(';'), ...rows.map(r => r.map(v => `"${v}"`).join(';'))].join('\n');
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `build-brasil-ordens-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado.');
}

// ============================================================
// ABAS
// ============================================================

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
}

// ============================================================
// MODAIS
// ============================================================

function openOrdemModal(existingOrdem) {
  const form = document.getElementById('form-ordem');
  form.reset();
  form.querySelector('[name="id"]').value = '';
  document.getElementById('modal-ordem-title').textContent = 'Nova Ordem';

  if (existingOrdem) {
    document.getElementById('modal-ordem-title').textContent = 'Editar Ordem';
    form.querySelector('[name="id"]').value = existingOrdem.id;
    form.querySelector('[name="data"]').value = existingOrdem.data;
    form.querySelector('[name="status"]').value = existingOrdem.status;
    form.querySelector('[name="regiao"]').value = existingOrdem.regiao;
    form.querySelector('[name="equipe"]').value = existingOrdem.equipe;
    form.querySelector('[name="linha_servico"]').value = existingOrdem.linha_servico;
    form.querySelector('[name="cliente"]').value = existingOrdem.cliente || '';
    form.querySelector('[name="valor_venda"]').value = existingOrdem.valor_venda;
    form.querySelector('[name="despesa_direta"]').value = existingOrdem.despesa_direta;
    form.querySelector('[name="tempo_execucao_h"]').value = existingOrdem.tempo_execucao_h ?? '';
    form.querySelector('[name="qualidade"]').value = existingOrdem.qualidade ?? '';
    form.querySelector('[name="resumo"]').value = existingOrdem.resumo || '';
  } else {
    form.querySelector('[name="data"]').value = todayISO();
  }
  document.getElementById('modal-ordem').classList.add('open');
}

function openDespesaModal(existingDespesa) {
  const form = document.getElementById('form-despesa');
  form.reset();
  form.querySelector('[name="id"]').value = '';
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa Geral';

  if (existingDespesa) {
    document.getElementById('modal-despesa-title').textContent = 'Editar Despesa';
    form.querySelector('[name="id"]').value = existingDespesa.id;
    form.querySelector('[name="data"]').value = existingDespesa.data;
    form.querySelector('[name="categoria"]').value = existingDespesa.categoria;
    form.querySelector('[name="descricao"]').value = existingDespesa.descricao || '';
    form.querySelector('[name="valor"]').value = existingDespesa.valor;
  } else {
    form.querySelector('[name="data"]').value = todayISO();
  }
  document.getElementById('modal-despesa').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ============================================================
// CRUD
// ============================================================

async function handleSaveOrdem(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.btn-save');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const f = new FormData(e.target);
  const id = f.get('id');
  const record = {
    data:             f.get('data'),
    regiao:           f.get('regiao'),
    equipe:           f.get('equipe'),
    linha_servico:    f.get('linha_servico'),
    cliente:          f.get('cliente') || null,
    valor_venda:      parseFloat(f.get('valor_venda')) || 0,
    despesa_direta:   parseFloat(f.get('despesa_direta')) || 0,
    status:           f.get('status'),
    tempo_execucao_h: f.get('tempo_execucao_h') ? parseFloat(f.get('tempo_execucao_h')) : null,
    qualidade:        f.get('qualidade') ? parseInt(f.get('qualidade')) : null,
    resumo:           f.get('resumo') || null,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('ordens').update(record).eq('id', id));
  } else {
    record.created_by = currentUser.id;
    ({ error } = await sb.from('ordens').insert([record]));
  }

  btn.disabled = false;
  btn.textContent = 'Salvar';
  if (error) {
    toast('Erro: ' + error.message, true);
    return;
  }
  closeModal('modal-ordem');
  await loadData();
  renderAll();
  toast(id ? 'Ordem atualizada.' : 'Ordem salva.');
}

async function handleSaveDespesa(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.btn-save');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const f = new FormData(e.target);
  const id = f.get('id');
  const record = {
    data:       f.get('data'),
    categoria:  f.get('categoria'),
    descricao:  f.get('descricao') || null,
    valor:      parseFloat(f.get('valor')) || 0,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('despesas_gerais').update(record).eq('id', id));
  } else {
    record.created_by = currentUser.id;
    ({ error } = await sb.from('despesas_gerais').insert([record]));
  }

  btn.disabled = false;
  btn.textContent = 'Salvar';
  if (error) {
    toast('Erro: ' + error.message, true);
    return;
  }
  closeModal('modal-despesa');
  await loadData();
  renderAll();
  toast(id ? 'Despesa atualizada.' : 'Despesa salva.');
}

async function deleteOrdem(id) {
  const { error } = await sb.from('ordens').delete().eq('id', id);
  if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
  await loadData();
  renderAll();
  toast('Ordem excluída.');
}

async function deleteDespesa(id) {
  const { error } = await sb.from('despesas_gerais').delete().eq('id', id);
  if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
  await loadData();
  renderAll();
  toast('Despesa excluída.');
}

// Expose to inline onclick handlers
window.editOrdem = function(id) {
  const o = ordens.find(x => x.id === id);
  if (o) openOrdemModal(o);
};
window.confirmDeleteOrdem = function(id) {
  if (confirm('Excluir esta ordem?')) deleteOrdem(id);
};
window.applyFilterFromBar = applyFilterFromBar;
window.setTicketsPage = function(p) {
  ticketsPage = p;
  renderOperacoes(filteredOrdens());
};

// ============================================================
// CÁLCULOS
// ============================================================

function calcVendas(data) {
  const total = data.reduce((s, o) => s + Number(o.valor_venda), 0);
  const count = data.length;
  const ticketMedio = count > 0 ? total / count : 0;
  return { total, count, ticketMedio };
}

function calcOperacoes(data) {
  const concluidas = data.filter(o => o.status === 'concluido');
  const comTempo = concluidas.filter(o => o.tempo_execucao_h != null);
  const comQualidade = data.filter(o => o.qualidade != null);
  const emAndamento = data.filter(o => o.status === 'em_andamento').length;

  const tempoMedio = comTempo.length > 0
    ? comTempo.reduce((s, o) => s + Number(o.tempo_execucao_h), 0) / comTempo.length
    : 0;
  const qualidadeMedia = comQualidade.length > 0
    ? comQualidade.reduce((s, o) => s + Number(o.qualidade), 0) / comQualidade.length
    : 0;
  const taxaConclusao = data.length > 0 ? (concluidas.length / data.length) * 100 : 0;

  return { tempoMedio, qualidadeMedia, taxaConclusao, emAndamento, concluidas: concluidas.length };
}

function groupBy(arr, key) {
  const map = {};
  arr.forEach(item => {
    const k = item[key];
    if (!map[k]) map[k] = [];
    map[k].push(item);
  });
  return map;
}

function sumField(arr, field) {
  return arr.reduce((s, o) => s + Number(o[field] || 0), 0);
}

// Validar com o financeiro antes de oficializar esta regra.
function calcRateio(ordensData) {
  const receitaTotal = sumField(ordensData, 'valor_venda');
  const totalDespGerais = despesasGerais.reduce((s, d) => s + Number(d.valor), 0);
  const porEquipe = groupBy(ordensData, 'equipe');
  const resultado = {};

  lookups.equipes.forEach(eq => {
    const eqOrdens = porEquipe[eq] || [];
    const receita = sumField(eqOrdens, 'valor_venda');
    const despDireta = sumField(eqOrdens, 'despesa_direta');
    const proporcao = receitaTotal > 0 ? receita / receitaTotal : 0;
    const despRateada = totalDespGerais * proporcao;
    resultado[eq] = {
      receita,
      despDireta,
      despRateada,
      saldo: receita - despDireta - despRateada,
      ordens: eqOrdens.length,
    };
  });

  return { resultado, receitaTotal, totalDespGerais };
}

// ============================================================
// RENDERIZAÇÃO
// ============================================================

function renderAll() {
  const data = filteredOrdens();
  renderVisaoGeral(data);
  renderVendas(data);
  renderOperacoes(data);
  renderFinanceiro(data);
}

// --- Animação de KPI ---
function animateValue(el, target, prefix, suffix) {
  const start = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  if (start === Math.round(target)) return;
  const duration = 400;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const current = Math.round(start + (target - start) * progress);
    el.textContent = prefix + current.toLocaleString('pt-BR') + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// --- Visão Geral ---
function renderVisaoGeral(data) {
  const v = calcVendas(data);
  const op = calcOperacoes(data);
  const { resultado, receitaTotal, totalDespGerais } = calcRateio(data);
  const saldoGeral = receitaTotal - sumField(data, 'despesa_direta') - totalDespGerais;

  document.getElementById('kpi-geral').innerHTML = `
    <div class="kpi-item"><div class="kpi-value">${fmtCurrency(v.total)}</div><div class="kpi-label">Receita Total</div></div>
    <div class="kpi-item"><div class="kpi-value verde">${fmtCurrency(saldoGeral)}</div><div class="kpi-label">Saldo Geral</div></div>
    <div class="kpi-item"><div class="kpi-value teal">${v.count}</div><div class="kpi-label">Ordens</div></div>
    <div class="kpi-item"><div class="kpi-value">${op.qualidadeMedia.toFixed(0)}</div><div class="kpi-label">Qualidade Média</div></div>
    <div class="kpi-item"><div class="kpi-value${op.emAndamento > 0 ? ' destaque' : ''}">${op.emAndamento}</div><div class="kpi-label">Em Andamento</div></div>
  `;

  // Alertas
  const alerts = [];
  const equipeEntries = Object.entries(resultado).filter(([, v]) => v.ordens > 0);

  if (equipeEntries.length > 0) {
    const lider = equipeEntries.sort((a, b) => b[1].saldo - a[1].saldo)[0];
    alerts.push({ text: `Equipe líder em saldo: ${lider[0]} (${fmtCurrency(lider[1].saldo)})`, type: 'positivo' });

    equipeEntries.forEach(([eq, d]) => {
      if (d.saldo < 0) alerts.push({ text: `${eq}: saldo negativo (${fmtCurrency(d.saldo)})`, type: 'critico' });
    });
  }

  if (op.qualidadeMedia > 0 && op.qualidadeMedia < 80) {
    alerts.push({ text: `Qualidade abaixo da meta (${op.qualidadeMedia.toFixed(0)}/100)`, type: 'atencao' });
  }
  if (op.tempoMedio > 80) {
    alerts.push({ text: `Tempo médio de execução alto (${op.tempoMedio.toFixed(1)}h)`, type: 'atencao' });
  }
  if (op.emAndamento > 3) {
    alerts.push({ text: `${op.emAndamento} ordens em aberto`, type: 'atencao' });
  }

  const porEquipeQual = groupBy(data.filter(o => o.qualidade != null), 'equipe');
  Object.entries(porEquipeQual).forEach(([eq, eqOrdens]) => {
    const media = eqOrdens.reduce((s, o) => s + Number(o.qualidade), 0) / eqOrdens.length;
    if (media < 80) {
      alerts.push({ text: `${eq}: qualidade abaixo da meta (${media.toFixed(0)})`, type: 'atencao' });
    }
  });

  document.getElementById('alerts-container').innerHTML = alerts.length > 0
    ? alerts.map(a => `<span class="alert-tag ${a.type}">${esc(a.text)}</span>`).join('')
    : '<span class="mono" style="font-size:0.75rem;color:#607D8B;">Nenhum alerta.</span>';

  // Tabela por equipe
  const tbody = document.querySelector('#table-equipe-geral tbody');
  tbody.innerHTML = lookups.equipes.map(eq => {
    const d = resultado[eq];
    const eqOrdens = (groupBy(data, 'equipe')[eq] || []);
    const comQual = eqOrdens.filter(o => o.qualidade != null);
    const qualMedia = comQual.length > 0
      ? (comQual.reduce((s, o) => s + Number(o.qualidade), 0) / comQual.length).toFixed(0)
      : '—';
    return `<tr>
      <td>${esc(eq)}</td>
      <td class="text-right">${fmtCurrency(d.receita)}</td>
      <td class="text-right">${fmtCurrency(d.despDireta)}</td>
      <td class="text-right">${fmtCurrency(d.despRateada)}</td>
      <td class="text-right" style="font-weight:600;color:${d.saldo >= 0 ? 'var(--verde)' : 'var(--erro)'}">${fmtCurrency(d.saldo)}</td>
      <td class="text-right">${d.ordens}</td>
      <td class="text-right">${qualMedia}</td>
    </tr>`;
  }).join('');
}

// --- Vendas ---
function renderVendas(data) {
  const v = calcVendas(data);
  document.getElementById('kpi-vendas').innerHTML = `
    <div class="kpi-item"><div class="kpi-value">${fmtCurrency(v.total)}</div><div class="kpi-label">Total de Vendas</div></div>
    <div class="kpi-item"><div class="kpi-value teal">${fmtCurrency(v.ticketMedio)}</div><div class="kpi-label">Ticket Médio</div></div>
    <div class="kpi-item"><div class="kpi-value">${v.count}</div><div class="kpi-label">Nº de Ordens</div></div>
  `;

  const byRegiao = groupBy(data, 'regiao');
  const byEquipe = groupBy(data, 'equipe');
  const byLinha  = groupBy(data, 'linha_servico');

  renderBarChart('chart-vendas-regiao', byRegiao, 'valor_venda', '', 'regiao');
  renderBarChart('chart-vendas-equipe', byEquipe, 'valor_venda', 'teal', 'equipe');
  renderBarChart('chart-vendas-linha',  byLinha,  'valor_venda', 'verde');
}

// --- Operações ---
function renderOperacoes(data) {
  const op = calcOperacoes(data);
  document.getElementById('kpi-operacoes').innerHTML = `
    <div class="kpi-item"><div class="kpi-value">${op.tempoMedio.toFixed(1)}h</div><div class="kpi-label">Tempo Médio Exec.</div></div>
    <div class="kpi-item"><div class="kpi-value teal">${op.qualidadeMedia.toFixed(0)}</div><div class="kpi-label">Qualidade Média</div></div>
    <div class="kpi-item"><div class="kpi-value verde">${op.taxaConclusao.toFixed(0)}%</div><div class="kpi-label">Taxa Conclusão</div></div>
    <div class="kpi-item"><div class="kpi-value${op.emAndamento > 0 ? ' destaque' : ''}">${op.emAndamento}</div><div class="kpi-label">Em Andamento</div></div>
  `;

  // Tempo médio por equipe
  const byEquipe = groupBy(data, 'equipe');
  const tempoData = {};
  Object.entries(byEquipe).forEach(([eq, items]) => {
    const concluidas = items.filter(o => o.status === 'concluido' && o.tempo_execucao_h != null);
    if (concluidas.length > 0) {
      tempoData[eq] = concluidas.reduce((s, o) => s + Number(o.tempo_execucao_h), 0) / concluidas.length;
    }
  });
  renderValueBarChart('chart-tempo-equipe', tempoData, 'h', 'teal');

  // Qualidade média por equipe
  const qualData = {};
  Object.entries(byEquipe).forEach(([eq, items]) => {
    const comQual = items.filter(o => o.qualidade != null);
    if (comQual.length > 0) {
      qualData[eq] = comQual.reduce((s, o) => s + Number(o.qualidade), 0) / comQual.length;
    }
  });
  renderValueBarChart('chart-qualidade-equipe', qualData, '', 'verde', 100);

  // Tabela de tickets com paginação
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / TICKETS_PER_PAGE));
  if (ticketsPage > totalPages) ticketsPage = totalPages;
  const start = (ticketsPage - 1) * TICKETS_PER_PAGE;
  const pageData = data.slice(start, start + TICKETS_PER_PAGE);

  const tbody = document.querySelector('#table-tickets tbody');
  tbody.innerHTML = pageData.map(o => {
    const isOwner = currentUser && o.created_by === currentUser.id;
    const actions = isOwner
      ? `<div class="row-actions">
          <button class="btn-row" onclick="editOrdem('${o.id}')">Editar</button>
          <button class="btn-row danger" onclick="confirmDeleteOrdem('${o.id}')">Excluir</button>
        </div>`
      : '<span style="font-size:0.65rem;color:#607D8B;">—</span>';
    return `<tr>
      <td>${fmtDate(o.data)}</td>
      <td>${esc(o.equipe)}</td>
      <td>${esc(o.regiao)}</td>
      <td>${esc(o.cliente || '—')}</td>
      <td><span class="status-tag ${o.status}">${statusLabel(o.status)}</span></td>
      <td>${esc(o.resumo || '—')}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');

  // Paginação
  const pagEl = document.getElementById('pagination-tickets');
  if (totalPages > 1) {
    pagEl.innerHTML = `
      <button onclick="setTicketsPage(${ticketsPage - 1})" ${ticketsPage <= 1 ? 'disabled' : ''}>&#9664; Ant.</button>
      <span class="page-info">${ticketsPage}/${totalPages}</span>
      <button onclick="setTicketsPage(${ticketsPage + 1})" ${ticketsPage >= totalPages ? 'disabled' : ''}>Prox. &#9654;</button>
    `;
  } else {
    pagEl.innerHTML = '';
  }
}

// --- Financeiro ---
function renderFinanceiro(data) {
  const { resultado, receitaTotal, totalDespGerais } = calcRateio(data);
  const despDiretaTotal = sumField(data, 'despesa_direta');
  const saldoGeral = receitaTotal - despDiretaTotal - totalDespGerais;

  document.getElementById('kpi-financeiro').innerHTML = `
    <div class="kpi-item"><div class="kpi-value">${fmtCurrency(receitaTotal)}</div><div class="kpi-label">Receita</div></div>
    <div class="kpi-item"><div class="kpi-value destaque">${fmtCurrency(despDiretaTotal + totalDespGerais)}</div><div class="kpi-label">Despesas Totais</div></div>
    <div class="kpi-item"><div class="kpi-value verde">${fmtCurrency(saldoGeral)}</div><div class="kpi-label">Saldo</div></div>
    <div class="kpi-item"><div class="kpi-value teal">${fmtCurrency(totalDespGerais)}</div><div class="kpi-label">Desp. Gerais</div></div>
  `;

  // Tabela por equipe
  const tbody = document.querySelector('#table-financeiro-equipe tbody');
  tbody.innerHTML = lookups.equipes.map(eq => {
    const d = resultado[eq];
    return `<tr>
      <td>${esc(eq)}</td>
      <td class="text-right">${fmtCurrency(d.receita)}</td>
      <td class="text-right">${fmtCurrency(d.despDireta)}</td>
      <td class="text-right">${fmtCurrency(d.despRateada)}</td>
      <td class="text-right" style="font-weight:600;color:${d.saldo >= 0 ? 'var(--verde)' : 'var(--erro)'}">${fmtCurrency(d.saldo)}</td>
    </tr>`;
  }).join('');

  renderBalancoChart(data);
}

// ============================================================
// GRÁFICOS DE BARRAS (HTML)
// ============================================================

function renderBarChart(containerId, grouped, sumField_, cssClass, filterField) {
  const container = document.getElementById(containerId);
  const entries = Object.entries(grouped).map(([label, items]) => ({
    label,
    value: items.reduce((s, o) => s + Number(o[sumField_] || 0), 0),
  }));
  entries.sort((a, b) => b.value - a.value);
  const max = entries.length > 0 ? Math.max(...entries.map(e => e.value)) : 1;
  const total = entries.reduce((s, e) => s + e.value, 0);

  container.innerHTML = '<div class="bar-chart">' + entries.map(e => {
    const pct = max > 0 ? (e.value / max) * 100 : 0;
    const pctTotal = total > 0 ? ((e.value / total) * 100).toFixed(1) : '0.0';
    const isActive = filterField && filters[filterField] === e.label ? ' active' : '';
    const onclick = filterField ? ` onclick="applyFilterFromBar('${filterField}','${esc(e.label)}')"` : '';
    return `<div class="bar-row${isActive}"${onclick}>
      <span class="bar-label">${esc(e.label)}</span>
      <div class="bar-track">
        <div class="bar-fill ${cssClass}" style="width:${pct}%"></div>
        <div class="bar-tooltip">${fmtCurrency(e.value)} (${pctTotal}%)</div>
      </div>
      <span class="bar-value">${fmtCurrency(e.value)}</span>
    </div>`;
  }).join('') + '</div>';
}

function renderValueBarChart(containerId, dataMap, suffix, cssClass, maxOverride) {
  const container = document.getElementById(containerId);
  const entries = Object.entries(dataMap).map(([label, value]) => ({ label, value }));
  entries.sort((a, b) => b.value - a.value);
  const max = maxOverride || (entries.length > 0 ? Math.max(...entries.map(e => e.value)) : 1);

  container.innerHTML = '<div class="bar-chart">' + entries.map(e => {
    const pct = max > 0 ? (e.value / max) * 100 : 0;
    return `<div class="bar-row">
      <span class="bar-label">${esc(e.label)}</span>
      <div class="bar-track">
        <div class="bar-fill ${cssClass}" style="width:${pct}%"></div>
        <div class="bar-tooltip">${e.value.toFixed(1)}${suffix}</div>
      </div>
      <span class="bar-value">${e.value.toFixed(1)}${suffix}</span>
    </div>`;
  }).join('') + '</div>';
}

// ============================================================
// GRÁFICO DE BALANÇO (Canvas)
// ============================================================

function renderBalancoChart(data) {
  const canvas = document.getElementById('canvas-balanco');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#D8DEE4' : '#14202E';
  const gridColor = isDark ? '#2A3A4A' : '#B0BEC5';
  const labelColor = isDark ? '#8899A6' : '#607D8B';

  const byMonth = {};
  data.forEach(o => {
    const month = o.data.substring(0, 7);
    if (!byMonth[month]) byMonth[month] = { receita: 0, despDireta: 0, despGeral: 0 };
    byMonth[month].receita += Number(o.valor_venda);
    byMonth[month].despDireta += Number(o.despesa_direta);
  });

  despesasGerais.forEach(d => {
    const month = d.data.substring(0, 7);
    if (!byMonth[month]) byMonth[month] = { receita: 0, despDireta: 0, despGeral: 0 };
    byMonth[month].despGeral += Number(d.valor);
  });

  const months = Object.keys(byMonth).sort();
  if (months.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 260;

  const padding = { top: 20, right: 20, bottom: 40, left: 70 };
  const w = canvas.width - padding.left - padding.right;
  const h = canvas.height - padding.top - padding.bottom;

  const values = months.map(m => {
    const d = byMonth[m];
    return {
      month: m,
      receita: d.receita,
      despesa: d.despDireta + d.despGeral,
      saldo: d.receita - d.despDireta - d.despGeral,
    };
  });

  const allVals = values.flatMap(v => [v.receita, v.despesa, v.saldo]);
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'middle';

  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const val = minVal + (range * i / steps);
    const y = padding.top + h - (h * (val - minVal) / range);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + w, y);
    ctx.stroke();
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'right';
    ctx.fillText(fmtShortCurrency(val), padding.left - 8, y);
  }

  const barGroupWidth = w / months.length;
  const barWidth = Math.min(barGroupWidth * 0.25, 30);
  const gap = barWidth * 0.2;

  const colors = isDark
    ? { receita: '#5B8FD9', despesa: '#F0845A', saldo: '#2EAE6D' }
    : { receita: '#1E4FA0', despesa: '#EC5C1E', saldo: '#157A4E' };

  const zeroY = padding.top + h - (h * (0 - minVal) / range);

  values.forEach((v, i) => {
    const cx = padding.left + barGroupWidth * i + barGroupWidth / 2;

    const ry = padding.top + h - (h * (v.receita - minVal) / range);
    ctx.fillStyle = colors.receita;
    ctx.fillRect(cx - barWidth * 1.5 - gap, ry, barWidth, zeroY - ry);

    const dy = padding.top + h - (h * (v.despesa - minVal) / range);
    ctx.fillStyle = colors.despesa;
    ctx.fillRect(cx - barWidth / 2, dy, barWidth, zeroY - dy);

    const sy = padding.top + h - (h * (v.saldo - minVal) / range);
    ctx.fillStyle = colors.saldo;
    if (v.saldo >= 0) {
      ctx.fillRect(cx + barWidth / 2 + gap, sy, barWidth, zeroY - sy);
    } else {
      ctx.fillRect(cx + barWidth / 2 + gap, zeroY, barWidth, Math.abs(zeroY - sy));
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.fillText(v.month, cx, padding.top + h + 20);
  });

  const legendY = 10;
  const legendItems = [
    { label: 'Receita', color: colors.receita },
    { label: 'Despesa', color: colors.despesa },
    { label: 'Saldo', color: colors.saldo },
  ];
  let lx = padding.left;
  legendItems.forEach(item => {
    ctx.fillStyle = item.color;
    ctx.fillRect(lx, legendY, 12, 12);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.fillText(item.label, lx + 16, legendY + 6);
    lx += ctx.measureText(item.label).width + 32;
  });
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function fmtCurrency(val) {
  return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtShortCurrency(val) {
  if (Math.abs(val) >= 1000) return 'R$ ' + (val / 1000).toFixed(0) + 'k';
  return 'R$ ' + val.toFixed(0);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function statusLabel(s) {
  const map = { concluido: 'Concluído', execucao_parcial: 'Exec. Parcial', em_andamento: 'Em Andamento' };
  return map[s] || s;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
