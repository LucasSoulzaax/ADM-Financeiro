const API = '/api/transacoes';
const API_CARTOES = '/api/cartoes';

let mesAtual = new Date().toISOString().slice(0, 7);
let transacoesCache = [];
let categoriasCache = [];
let filtroAtual = 'todas';

let cartoes = [];
let comprasCartao = [];
let cartaoAtivoId = null;
let modoEdicaoCartaoId = null;
let modoEdicaoCompraId = null;

const filtroMes = document.getElementById('filtroMes');
const listaTransacoes = document.getElementById('listaTransacoes');
const listaCategorias = document.getElementById('listaCategorias');
const statusMesInfo = document.getElementById('statusMesInfo');
const selectTipo = document.getElementById('tipo');
const selectCategoria = document.getElementById('categoria_id');
const listaComprasCartao = document.getElementById('listaComprasCartao');
const listaCartoes = document.getElementById('listaCartoes');
const formNovoCartao = document.getElementById('formNovoCartao');
const formCompraCartao = document.getElementById('formCompraCartao');
const btnSalvarCartao = document.getElementById('btnSalvarCartao');
const btnSalvarCompraCartao = document.getElementById('btnSalvarCompraCartao');

if (filtroMes) filtroMes.value = mesAtual;

if (document.getElementById('data_transacao')) {
  document.getElementById('data_transacao').value = new Date().toISOString().split('T')[0];
}
if (document.getElementById('dataCompraCartao')) {
  document.getElementById('dataCompraCartao').value = new Date().toISOString().split('T')[0];
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const screen = btn.dataset.screen;
    if (!screen) return;

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.screen').forEach(section => section.classList.remove('active'));
    const screenEl = document.getElementById(`screen-${screen}`);
    if (screenEl) screenEl.classList.add('active');
  });
});

filtroMes?.addEventListener('change', async e => {
  mesAtual = e.target.value;
  await atualizarTudo();
  await carregarCartoes();
});

document.getElementById('btnRefreshTransacoes')?.addEventListener('click', async () => {
  await carregarTransacoes();
  await carregarDashboard();
});

document.querySelectorAll('.pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    filtroAtual = btn.dataset.filter;
    renderizarTransacoes();
  });
});

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    const tipoEscolhido = btn.dataset.typeChoice;
    if (selectTipo) selectTipo.value = tipoEscolhido;
    preencherCategoriasPorTipo(tipoEscolhido);
  });
});

selectTipo?.addEventListener('change', () => {
  sincronizarBotoesTipo(selectTipo.value);
  preencherCategoriasPorTipo(selectTipo.value);
});

async function carregarDashboard() {
  try {
    const res = await fetch(`${API}/dashboard/${mesAtual}`);
    const data = await res.json();

    document.getElementById('totalGanhos').textContent = formatMoney(data.ganhos || 0);
    document.getElementById('totalGastos').textContent = formatMoney(data.gastos || 0);
    document.getElementById('totalPendentes').textContent = formatMoney(data.pendentes || 0);
    document.getElementById('saldoResumo').textContent = formatMoney(data.saldo || 0);
    document.getElementById('mensagemSaldo').textContent = data.mensagem || 'Sem análise disponível.';
    if (statusMesInfo) statusMesInfo.textContent = Number(data.saldo || 0) >= 0 ? 'Mês positivo' : 'Mês negativo';
  } catch {
    document.getElementById('mensagemSaldo').textContent = 'Não foi possível carregar o dashboard.';
    if (statusMesInfo) statusMesInfo.textContent = 'Erro ao carregar';
  }
}

async function carregarCategorias() {
  try {
    const res = await fetch(`${API}/categorias/lista`);
    categoriasCache = await res.json();
    renderizarListaCategorias();
    preencherCategoriasPorTipo(selectTipo?.value || 'ganho');
  } catch {
    if (listaCategorias) listaCategorias.innerHTML = `<div class="empty-state">Erro ao carregar categorias.</div>`;
    if (selectCategoria) selectCategoria.innerHTML = `<option value="">Erro ao carregar categorias</option>`;
  }
}

function renderizarListaCategorias() {
  if (!listaCategorias) return;
  if (!categoriasCache.length) {
    listaCategorias.innerHTML = `<div class="empty-state">Nenhuma categoria cadastrada ainda.</div>`;
    return;
  }

  listaCategorias.innerHTML = categoriasCache.map(c => `
    <div class="category-item">
      <strong>${c.nome}</strong>
      <span class="category-type">${c.tipo}</span>
    </div>
  `).join('');
}

function preencherCategoriasPorTipo(tipo) {
  if (!selectCategoria) return;
  const categoriasFiltradas = categoriasCache.filter(c => c.tipo === tipo);

  if (!categoriasFiltradas.length) {
    selectCategoria.innerHTML = `<option value="">Nenhuma categoria de ${tipo} cadastrada</option>`;
    return;
  }

  selectCategoria.innerHTML = `
    <option value="">Selecione uma categoria</option>
    ${categoriasFiltradas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
  `;
}

function sincronizarBotoesTipo(tipo) {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.typeChoice === tipo);
  });
}

async function carregarTransacoes() {
  try {
    const res = await fetch(`${API}?mes=${mesAtual}`);
    transacoesCache = await res.json();
    renderizarTransacoes();
  } catch {
    if (listaTransacoes) listaTransacoes.innerHTML = `<div class="empty-state">Erro ao carregar transações.</div>`;
  }
}

function renderizarTransacoes() {
  if (!listaTransacoes) return;
  let lista = [...transacoesCache];
  if (filtroAtual !== 'todas') lista = lista.filter(item => item.tipo === filtroAtual);

  if (!lista.length) {
    listaTransacoes.innerHTML = `<div class="empty-state">Nenhuma transação encontrada para este filtro.</div>`;
    return;
  }

  listaTransacoes.innerHTML = lista.map(item => {
    const valorNumero = Number(item.valor || 0);
    const isGanho = item.tipo === 'ganho';
    const data = new Date(item.data_transacao).toLocaleDateString('pt-BR');

    return `
      <article class="transaction-card">
        <div class="tx-icon ${item.tipo}">${isGanho ? '↗' : '↘'}</div>
        <div class="tx-main">
          <h4>${item.descricao}</h4>
          <p class="tx-meta">
            <span>${item.categoria || 'Sem categoria'}</span>
            <span>•</span>
            <span>${data}</span>
            <span>•</span>
            <span>${item.natureza}</span>
          </p>
        </div>
        <div class="tx-value">
          <strong class="${item.tipo}">${isGanho ? '' : '- '}${formatMoney(valorNumero)}</strong>
          <span class="tx-status status-${item.status}">${formatStatus(item.status)}</span>
        </div>
      </article>
    `;
  }).join('');
}

document.getElementById('formTransacao')?.addEventListener('submit', async e => {
  e.preventDefault();
  const categoriaSelecionada = selectCategoria?.value;
  if (!categoriaSelecionada) {
    alert('Selecione uma categoria antes de salvar.');
    return;
  }

  const body = {
    descricao: document.getElementById('descricao').value,
    valor: parseFloat(document.getElementById('valor').value),
    tipo: selectTipo.value,
    natureza: document.getElementById('natureza').value,
    status: document.getElementById('status').value,
    categoria_id: categoriaSelecionada,
    data_transacao: document.getElementById('data_transacao').value
  };

  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    e.target.reset();
    document.getElementById('data_transacao').value = new Date().toISOString().split('T')[0];
    if (selectTipo) selectTipo.value = 'ganho';
    sincronizarBotoesTipo('ganho');
    preencherCategoriasPorTipo('ganho');
    await atualizarTudo();
  } catch {
    alert('Erro ao salvar transação.');
  }
});

document.getElementById('formCategoria')?.addEventListener('submit', async e => {
  e.preventDefault();
  const nome = document.getElementById('nomeCategoria').value.trim();
  const tipo = document.getElementById('tipoCategoria').value;

  if (!tipo) {
    alert('Selecione se a categoria é Gasto ou Ganho.');
    return;
  }

  try {
    await fetch(`${API}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, tipo })
    });

    e.target.reset();
    document.getElementById('tipoCategoria').value = '';
    await carregarCategorias();
  } catch {
    alert('Erro ao adicionar categoria.');
  }
});

document.getElementById('btnExportarTSV')?.addEventListener('click', async () => {
  try {
    const res = await fetch(`${API}/tsv/${mesAtual}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro_${mesAtual}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert('Erro ao exportar TSV.');
  }
});

formNovoCartao?.addEventListener('submit', async e => {
  e.preventDefault();

  const body = {
    nome: document.getElementById('inputNomeCartao').value.trim(),
    apelido: document.getElementById('inputApelidoCartao').value.trim(),
    final_cartao: document.getElementById('inputFinalCartao').value.trim(),
    limite_total: parseFloat(document.getElementById('inputLimiteCartao').value),
    dia_fechamento: parseInt(document.getElementById('inputFechamentoCartao').value, 10),
    dia_vencimento: parseInt(document.getElementById('inputVencimentoCartao').value, 10)
  };

  try {
    const url = modoEdicaoCartaoId ? `${API_CARTOES}/${modoEdicaoCartaoId}` : API_CARTOES;
    const method = modoEdicaoCartaoId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const cartaoSalvo = await res.json();
    cartaoAtivoId = cartaoSalvo.id;

    e.target.reset();
    resetarFormularioCartao();
    await carregarCartoes();
  } catch {
    alert('Erro ao salvar cartão.');
  }
});

document.getElementById('btnNovoCartao')?.addEventListener('click', () => {
  document.getElementById('inputNomeCartao')?.focus();
});

formCompraCartao?.addEventListener('submit', async e => {
  e.preventDefault();

  const cartaoAtivo = getCartaoAtivo();
  if (!cartaoAtivo) {
    alert('Cadastre um cartão primeiro.');
    return;
  }

  const body = {
    descricao: document.getElementById('descricaoCompraCartao').value.trim(),
    valor: parseFloat(document.getElementById('valorCompraCartao').value),
    categoria: document.getElementById('categoriaCompraCartao').value.trim(),
    data_compra: document.getElementById('dataCompraCartao').value
  };

  try {
    const url = modoEdicaoCompraId
      ? `${API_CARTOES}/compras/${modoEdicaoCompraId}`
      : `${API_CARTOES}/${cartaoAtivo.id}/compras`;

    const method = modoEdicaoCompraId ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    e.target.reset();
    document.getElementById('dataCompraCartao').value = new Date().toISOString().split('T')[0];
    resetarFormularioCompra();
    await atualizarCartaoUI();
  } catch {
    alert('Erro ao salvar compra.');
  }
});

document.getElementById('btnPagarFatura')?.addEventListener('click', async () => {
  const cartao = getCartaoAtivo();
  if (!cartao) {
    alert('Nenhum cartão selecionado.');
    return;
  }

  try {
    const resumo = await buscarResumoCartao(cartao.id);
    const restante = Number(resumo.restante_fatura || 0);

    if (restante <= 0) {
      alert('A fatura atual já está quitada.');
      return;
    }

    const valor = prompt(`Informe o valor pago da fatura atual (restante: ${formatMoney(restante)})`);
    if (valor === null) return;

    const pagamento = parseFloat(valor.replace(',', '.'));
    if (Number.isNaN(pagamento) || pagamento <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    await fetch(`${API_CARTOES}/${cartao.id}/pagamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valor: pagamento,
        data_pagamento: new Date().toISOString().split('T')[0],
        referencia_mes: mesAtual
      })
    });

    await atualizarCartaoUI();
  } catch {
    alert('Erro ao registrar pagamento da fatura.');
  }
});

async function carregarCartoes() {
  try {
    const res = await fetch(API_CARTOES);
    cartoes = await res.json();

    if (!cartoes.length) {
      cartaoAtivoId = null;
      comprasCartao = [];
      atualizarCartaoUIVazio();
      renderizarListaCartoes();
      return;
    }

    if (!cartaoAtivoId || !cartoes.some(c => c.id === cartaoAtivoId)) {
      cartaoAtivoId = cartoes[0].id;
    }

    renderizarListaCartoes();
    await atualizarCartaoUI();
  } catch {
    atualizarCartaoUIVazio();
    if (listaCartoes) listaCartoes.innerHTML = `<div class="empty-state">Erro ao carregar cartões.</div>`;
  }
}

function getCartaoAtivo() {
  return cartoes.find(c => c.id === cartaoAtivoId) || null;
}

function renderizarListaCartoes() {
  if (!listaCartoes) return;

  if (!cartoes.length) {
    listaCartoes.innerHTML = `<div class="empty-state">Nenhum cartão cadastrado.</div>`;
    return;
  }

  listaCartoes.innerHTML = cartoes.map(cartao => `
    <div class="mini-card-item ${cartao.id === cartaoAtivoId ? 'active' : ''}">
      <div class="mini-card-top">
        <strong>${cartao.nome}</strong>
        <div class="card-actions">
          <button class="tiny-btn" type="button" onclick="selecionarCartao(${cartao.id})">Abrir</button>
          <button class="tiny-btn" type="button" onclick="editarCartao(${cartao.id})">Editar</button>
          <button class="tiny-btn danger" type="button" onclick="removerCartao(${cartao.id})">Remover</button>
        </div>
      </div>
      <p class="mini-card-sub">${cartao.apelido} • Final ${cartao.final_cartao}</p>
      <div class="mini-card-bottom">
        <span>Limite: <strong>${formatMoney(cartao.limite_total)}</strong></span>
        <span>Fecha dia <strong>${cartao.dia_fechamento}</strong></span>
      </div>
    </div>
  `).join('');
}

async function selecionarCartao(id) {
  cartaoAtivoId = id;
  renderizarListaCartoes();
  await atualizarCartaoUI();
}

function editarCartao(id) {
  const cartao = cartoes.find(c => c.id === id);
  if (!cartao) return;

  modoEdicaoCartaoId = id;
  document.getElementById('inputNomeCartao').value = cartao.nome;
  document.getElementById('inputApelidoCartao').value = cartao.apelido;
  document.getElementById('inputFinalCartao').value = cartao.final_cartao;
  document.getElementById('inputLimiteCartao').value = cartao.limite_total;
  document.getElementById('inputFechamentoCartao').value = cartao.dia_fechamento;
  document.getElementById('inputVencimentoCartao').value = cartao.dia_vencimento;
  if (btnSalvarCartao) btnSalvarCartao.textContent = 'Salvar edição';
}

async function removerCartao(id) {
  const confirmar = confirm('Deseja realmente remover este cartão?');
  if (!confirmar) return;

  try {
    await fetch(`${API_CARTOES}/${id}`, { method: 'DELETE' });
    if (modoEdicaoCartaoId === id) resetarFormularioCartao();
    await carregarCartoes();
  } catch {
    alert('Erro ao remover cartão.');
  }
}

window.selecionarCartao = selecionarCartao;
window.editarCartao = editarCartao;
window.removerCartao = removerCartao;

async function buscarResumoCartao(cardId) {
  const res = await fetch(`${API_CARTOES}/${cardId}/resumo?mes=${mesAtual}`);
  return await res.json();
}

async function carregarComprasCartao(cardId) {
  const res = await fetch(`${API_CARTOES}/${cardId}/compras?mes=${mesAtual}`);
  comprasCartao = await res.json();
}

async function atualizarCartaoUI() {
  const cartao = getCartaoAtivo();
  if (!cartao) {
    atualizarCartaoUIVazio();
    return;
  }

  try {
    await carregarComprasCartao(cartao.id);
    const resumo = await buscarResumoCartao(cartao.id);

    document.getElementById('nomeCartao').textContent = cartao.nome;
    document.getElementById('apelidoCartao').textContent = cartao.apelido;
    document.getElementById('numeroCartao').textContent = `•••• •••• •••• ${cartao.final_cartao}`;
    document.getElementById('diaFechamento').textContent = cartao.dia_fechamento;
    document.getElementById('diaVencimento').textContent = cartao.dia_vencimento;
    document.getElementById('faturaAtual').textContent = formatMoney(resumo.fatura_atual || 0);
    document.getElementById('limiteDisponivel').textContent = formatMoney(resumo.limite_disponivel || 0);
    document.getElementById('limiteUsado').textContent = `${Number(resumo.percentual_usado || 0).toFixed(0)}%`;
    document.getElementById('valorPagoFatura').textContent = formatMoney(resumo.total_pago || 0);
    document.getElementById('resumoFaturaCartao').textContent = formatMoney(resumo.fatura_atual || 0);
    document.getElementById('resumoLimiteDisponivel').textContent = formatMoney(resumo.limite_disponivel || 0);

    renderizarComprasCartao();
  } catch {
    atualizarCartaoUIVazio('Erro ao carregar dados do cartão.');
  }
}

function atualizarCartaoUIVazio(mensagem = 'Cadastre um cartão para começar.') {
  const map = {
    nomeCartao: 'Sem cartão',
    apelidoCartao: 'Cadastre um cartão',
    numeroCartao: '•••• •••• •••• ••••',
    diaFechamento: '--',
    diaVencimento: '--',
    faturaAtual: formatMoney(0),
    limiteDisponivel: formatMoney(0),
    limiteUsado: '0%',
    valorPagoFatura: formatMoney(0),
    resumoFaturaCartao: formatMoney(0),
    resumoLimiteDisponivel: formatMoney(0)
  };

  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  if (listaComprasCartao) {
    listaComprasCartao.innerHTML = `<div class="empty-state">${mensagem}</div>`;
  }
}

function renderizarComprasCartao() {
  if (!listaComprasCartao) return;

  if (!comprasCartao.length) {
    listaComprasCartao.innerHTML = `<div class="empty-state">Nenhuma compra lançada neste cartão neste mês.</div>`;
    return;
  }

  listaComprasCartao.innerHTML = comprasCartao.map(item => `
    <article class="card-purchase-item">
      <div class="tx-icon cartao">💳</div>
      <div class="tx-main">
        <h4>${item.descricao}</h4>
        <p class="tx-meta">
          <span>${item.categoria || 'Sem categoria'}</span>
          <span>•</span>
          <span>${new Date(item.data_compra).toLocaleDateString('pt-BR')}</span>
        </p>
      </div>
      <div class="tx-value">
        <strong class="cartao">${formatMoney(item.valor)}</strong>
        <div class="card-actions" style="margin-top:8px; justify-content:flex-end;">
          <button class="tiny-btn" type="button" onclick="editarCompra(${item.id})">Editar</button>
          <button class="tiny-btn danger" type="button" onclick="removerCompra(${item.id})">Remover</button>
        </div>
      </div>
    </article>
  `).join('');
}

function editarCompra(id) {
  const compra = comprasCartao.find(c => c.id === id);
  if (!compra) return;

  modoEdicaoCompraId = id;
  document.getElementById('descricaoCompraCartao').value = compra.descricao;
  document.getElementById('valorCompraCartao').value = compra.valor;
  document.getElementById('categoriaCompraCartao').value = compra.categoria || '';
  document.getElementById('dataCompraCartao').value = compra.data_compra;
  if (btnSalvarCompraCartao) btnSalvarCompraCartao.textContent = 'Salvar edição';
}

async function removerCompra(id) {
  const confirmar = confirm('Deseja remover esta compra?');
  if (!confirmar) return;

  try {
    await fetch(`${API_CARTOES}/compras/${id}`, { method: 'DELETE' });
    if (modoEdicaoCompraId === id) resetarFormularioCompra();
    await atualizarCartaoUI();
  } catch {
    alert('Erro ao remover compra.');
  }
}

window.editarCompra = editarCompra;
window.removerCompra = removerCompra;

function resetarFormularioCartao() {
  modoEdicaoCartaoId = null;
  formNovoCartao?.reset();
  if (btnSalvarCartao) btnSalvarCartao.textContent = 'Adicionar cartão';
}

function resetarFormularioCompra() {
  modoEdicaoCompraId = null;
  formCompraCartao?.reset();
  if (document.getElementById('dataCompraCartao')) {
    document.getElementById('dataCompraCartao').value = new Date().toISOString().split('T')[0];
  }
  if (btnSalvarCompraCartao) btnSalvarCompraCartao.textContent = 'Adicionar compra';
}

function formatMoney(value) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatStatus(status) {
  const mapa = {
    pago: 'Pago',
    pendente: 'Pendente',
    urgente: 'Urgente',
    cancelado: 'Cancelado'
  };
  return mapa[status] || status;
}

async function atualizarTudo() {
  await Promise.all([
    carregarDashboard(),
    carregarCategorias(),
    carregarTransacoes()
  ]);
}

sincronizarBotoesTipo('ganho');
atualizarTudo();
carregarCartoes();
