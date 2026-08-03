const API = '/api/transacoes';

let mesAtual = new Date().toISOString().slice(0, 7);
let transacoesCache = [];
let categoriasCache = [];
let filtroAtual = 'todas';

let cartoes = [
  {
    id: 1,
    nome: 'Nubank',
    apelido: 'Roxinho da Mari',
    final: '4821',
    limite: 3000,
    fechamento: 10,
    vencimento: 17,
    pagoFatura: 0
  }
];

let comprasCartao = [];
let cartaoAtivoId = 1;

const filtroMes = document.getElementById('filtroMes');
const listaTransacoes = document.getElementById('listaTransacoes');
const listaCategorias = document.getElementById('listaCategorias');
const statusMesInfo = document.getElementById('statusMesInfo');
const selectTipo = document.getElementById('tipo');
const selectCategoria = document.getElementById('categoria_id');
const listaComprasCartao = document.getElementById('listaComprasCartao');
const listaCartoes = document.getElementById('listaCartoes');

filtroMes.value = mesAtual;
document.getElementById('data_transacao').value = new Date().toISOString().split('T')[0];
document.getElementById('dataCompraCartao').value = new Date().toISOString().split('T')[0];

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const screen = btn.dataset.screen;
    if (!screen) return;

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.screen').forEach(section => section.classList.remove('active'));
    document.getElementById(`screen-${screen}`).classList.add('active');
  });
});

filtroMes.addEventListener('change', e => {
  mesAtual = e.target.value;
  atualizarTudo();
  atualizarCartaoUI();
});

document.getElementById('btnRefreshTransacoes').addEventListener('click', () => {
  carregarTransacoes();
  carregarDashboard();
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
    selectTipo.value = tipoEscolhido;
    preencherCategoriasPorTipo(tipoEscolhido);
  });
});

selectTipo.addEventListener('change', () => {
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
    statusMesInfo.textContent = Number(data.saldo || 0) >= 0 ? 'Mês positivo' : 'Mês negativo';
  } catch {
    document.getElementById('mensagemSaldo').textContent = 'Não foi possível carregar o dashboard.';
    statusMesInfo.textContent = 'Erro ao carregar';
  }
}

async function carregarCategorias() {
  try {
    const res = await fetch(`${API}/categorias/lista`);
    categoriasCache = await res.json();
    renderizarListaCategorias();
    preencherCategoriasPorTipo(selectTipo.value || 'ganho');
  } catch {
    listaCategorias.innerHTML = `<div class="empty-state">Erro ao carregar categorias.</div>`;
    selectCategoria.innerHTML = `<option value="">Erro ao carregar categorias</option>`;
  }
}

function renderizarListaCategorias() {
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
    listaTransacoes.innerHTML = `<div class="empty-state">Erro ao carregar transações.</div>`;
  }
}

function renderizarTransacoes() {
  let lista = [...transacoesCache];

  if (filtroAtual !== 'todas') {
    lista = lista.filter(item => item.tipo === filtroAtual);
  }

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
        <div class="tx-icon ${item.tipo}">
          ${isGanho ? '↗' : '↘'}
        </div>
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
          <strong class="${item.tipo}">
            ${isGanho ? '' : '- '}${formatMoney(valorNumero)}
          </strong>
          <span class="tx-status status-${item.status}">${formatStatus(item.status)}</span>
        </div>
      </article>
    `;
  }).join('');
}

document.getElementById('formTransacao').addEventListener('submit', async e => {
  e.preventDefault();

  const categoriaSelecionada = selectCategoria.value;
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
    selectTipo.value = 'ganho';
    sincronizarBotoesTipo('ganho');
    preencherCategoriasPorTipo('ganho');

    await atualizarTudo();

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('.nav-item[data-screen="transacoes"]').classList.add('active');
    document.querySelectorAll('.screen').forEach(section => section.classList.remove('active'));
    document.getElementById('screen-transacoes').classList.add('active');
  } catch {
    alert('Erro ao salvar transação.');
  }
});

document.getElementById('formCategoria').addEventListener('submit', async e => {
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

document.getElementById('btnExportarTSV').addEventListener('click', async () => {
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

document.getElementById('formNovoCartao').addEventListener('submit', e => {
  e.preventDefault();

  const novoCartao = {
    id: Date.now(),
    nome: document.getElementById('inputNomeCartao').value.trim(),
    apelido: document.getElementById('inputApelidoCartao').value.trim(),
    final: document.getElementById('inputFinalCartao').value.trim(),
    limite: parseFloat(document.getElementById('inputLimiteCartao').value),
    fechamento: parseInt(document.getElementById('inputFechamentoCartao').value, 10),
    vencimento: parseInt(document.getElementById('inputVencimentoCartao').value, 10),
    pagoFatura: 0
  };

  cartoes.unshift(novoCartao);
  cartaoAtivoId = novoCartao.id;
  e.target.reset();
  renderizarListaCartoes();
  atualizarCartaoUI();
});

document.getElementById('btnNovoCartao').addEventListener('click', () => {
  document.getElementById('inputNomeCartao').focus();
});

document.getElementById('formCompraCartao').addEventListener('submit', e => {
  e.preventDefault();

  const cartaoAtivo = getCartaoAtivo();
  if (!cartaoAtivo) {
    alert('Cadastre um cartão primeiro.');
    return;
  }

  const descricao = document.getElementById('descricaoCompraCartao').value.trim();
  const valor = parseFloat(document.getElementById('valorCompraCartao').value);
  const categoria = document.getElementById('categoriaCompraCartao').value.trim();
  const data = document.getElementById('dataCompraCartao').value;

  if (!descricao || Number.isNaN(valor) || !categoria || !data) {
    alert('Preencha todos os dados da compra.');
    return;
  }

  comprasCartao.unshift({
    id: Date.now(),
    cardId: cartaoAtivo.id,
    descricao,
    valor,
    categoria,
    data
  });

  e.target.reset();
  document.getElementById('dataCompraCartao').value = new Date().toISOString().split('T')[0];
  atualizarCartaoUI();
});

document.getElementById('btnPagarFatura').addEventListener('click', () => {
  const cartao = getCartaoAtivo();
  if (!cartao) {
    alert('Nenhum cartão selecionado.');
    return;
  }

  const fatura = calcularFaturaAtual(cartao.id);
  const restante = Math.max(fatura - cartao.pagoFatura, 0);

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

  cartao.pagoFatura += pagamento;
  if (cartao.pagoFatura > fatura) {
    cartao.pagoFatura = fatura;
  }

  atualizarCartaoUI();
});

function getCartaoAtivo() {
  return cartoes.find(c => c.id === cartaoAtivoId) || null;
}

function renderizarListaCartoes() {
  if (!cartoes.length) {
    listaCartoes.innerHTML = `<div class="empty-state">Nenhum cartão cadastrado.</div>`;
    return;
  }

  listaCartoes.innerHTML = cartoes.map(cartao => {
    const fatura = calcularFaturaAtual(cartao.id);
    const disponivel = Math.max(cartao.limite - fatura, 0);

    return `
      <div class="mini-card-item ${cartao.id === cartaoAtivoId ? 'active' : ''}">
        <div class="mini-card-top">
          <strong>${cartao.nome}</strong>
          <div class="card-actions">
            <button class="tiny-btn" type="button" onclick="selecionarCartao(${cartao.id})">Abrir</button>
            <button class="tiny-btn danger" type="button" onclick="removerCartao(${cartao.id})">Remover</button>
          </div>
        </div>
        <p class="mini-card-sub">${cartao.apelido} • Final ${cartao.final}</p>
        <div class="mini-card-bottom">
          <span>Fatura: <strong>${formatMoney(fatura)}</strong></span>
          <span>Disponível: <strong>${formatMoney(disponivel)}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

function selecionarCartao(id) {
  cartaoAtivoId = id;
  renderizarListaCartoes();
  atualizarCartaoUI();
}

function removerCartao(id) {
  const confirmar = confirm('Deseja realmente remover este cartão?');
  if (!confirmar) return;

  cartoes = cartoes.filter(c => c.id !== id);
  comprasCartao = comprasCartao.filter(c => c.cardId !== id);

  if (!cartoes.length) {
    cartaoAtivoId = null;
  } else if (!cartoes.some(c => c.id === cartaoAtivoId)) {
    cartaoAtivoId = cartoes[0].id;
  }

  renderizarListaCartoes();
  atualizarCartaoUI();
}

window.selecionarCartao = selecionarCartao;
window.removerCartao = removerCartao;

function atualizarCartaoUI() {
  renderizarListaCartoes();

  const cartao = getCartaoAtivo();

  if (!cartao) {
    document.getElementById('nomeCartao').textContent = 'Sem cartão';
    document.getElementById('apelidoCartao').textContent = 'Cadastre um cartão';
    document.getElementById('numeroCartao').textContent = '•••• •••• •••• ••••';
    document.getElementById('diaFechamento').textContent = '--';
    document.getElementById('diaVencimento').textContent = '--';
    document.getElementById('faturaAtual').textContent = formatMoney(0);
    document.getElementById('limiteDisponivel').textContent = formatMoney(0);
    document.getElementById('limiteUsado').textContent = '0%';
    document.getElementById('valorPagoFatura').textContent = formatMoney(0);
    document.getElementById('resumoFaturaCartao').textContent = formatMoney(0);
    document.getElementById('resumoLimiteDisponivel').textContent = formatMoney(0);
    listaComprasCartao.innerHTML = `<div class="empty-state">Cadastre um cartão para começar.</div>`;
    return;
  }

  document.getElementById('nomeCartao').textContent = cartao.nome;
  document.getElementById('apelidoCartao').textContent = cartao.apelido;
  document.getElementById('numeroCartao').textContent = `•••• •••• •••• ${cartao.final}`;
  document.getElementById('diaFechamento').textContent = cartao.fechamento;
  document.getElementById('diaVencimento').textContent = cartao.vencimento;

  const fatura = calcularFaturaAtual(cartao.id);
  const pago = Math.min(cartao.pagoFatura, fatura);
  const disponivel = Math.max(cartao.limite - fatura, 0);
  const uso = cartao.limite > 0 ? ((fatura / cartao.limite) * 100) : 0;

  document.getElementById('faturaAtual').textContent = formatMoney(fatura);
  document.getElementById('limiteDisponivel').textContent = formatMoney(disponivel);
  document.getElementById('limiteUsado').textContent = `${uso.toFixed(0)}%`;
  document.getElementById('valorPagoFatura').textContent = formatMoney(pago);
  document.getElementById('resumoFaturaCartao').textContent = formatMoney(fatura);
  document.getElementById('resumoLimiteDisponivel').textContent = formatMoney(disponivel);

  renderizarComprasCartao(cartao.id);
}

function calcularFaturaAtual(cardId) {
  const [ano, mes] = mesAtual.split('-').map(Number);

  return comprasCartao
    .filter(compra => {
      const data = new Date(`${compra.data}T00:00:00`);
      return compra.cardId === cardId &&
        data.getFullYear() === ano &&
        (data.getMonth() + 1) === mes;
    })
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);
}

function renderizarComprasCartao(cardId) {
  const [ano, mes] = mesAtual.split('-').map(Number);

  const listaMes = comprasCartao.filter(compra => {
    const data = new Date(`${compra.data}T00:00:00`);
    return compra.cardId === cardId &&
      data.getFullYear() === ano &&
      (data.getMonth() + 1) === mes;
  });

  if (!listaMes.length) {
    listaComprasCartao.innerHTML = `<div class="empty-state">Nenhuma compra lançada neste cartão neste mês.</div>`;
    return;
  }

  listaComprasCartao.innerHTML = listaMes.map(item => `
    <article class="card-purchase-item">
      <div class="tx-icon cartao">💳</div>
      <div class="tx-main">
        <h4>${item.descricao}</h4>
        <p class="tx-meta">
          <span>${item.categoria}</span>
          <span>•</span>
          <span>${new Date(`${item.data}T00:00:00`).toLocaleDateString('pt-BR')}</span>
        </p>
      </div>
      <div class="tx-value">
        <strong class="cartao">${formatMoney(item.valor)}</strong>
      </div>
    </article>
  `).join('');
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
atualizarCartaoUI();
