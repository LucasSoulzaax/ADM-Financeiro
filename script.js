const API = '/api/transacoes';

let mesAtual = new Date().toISOString().slice(0, 7);
let transacoesCache = [];
let categoriasCache = [];
let filtroAtual = 'todas';

const filtroMes = document.getElementById('filtroMes');
const listaTransacoes = document.getElementById('listaTransacoes');
const listaCategorias = document.getElementById('listaCategorias');
const statusMesInfo = document.getElementById('statusMesInfo');
const selectTipo = document.getElementById('tipo');
const selectCategoria = document.getElementById('categoria_id');

filtroMes.value = mesAtual;

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

    const ganhos = Number(data.ganhos || 0);
    const gastos = Number(data.gastos || 0);
    const pendentes = Number(data.pendentes || 0);
    const saldo = Number(data.saldo || 0);

    document.getElementById('totalGanhos').textContent = formatMoney(ganhos);
    document.getElementById('totalGastos').textContent = formatMoney(gastos);
    document.getElementById('totalPendentes').textContent = formatMoney(pendentes);
    document.getElementById('saldoResumo').textContent = formatMoney(saldo);
    document.getElementById('mensagemSaldo').textContent = data.mensagem || 'Sem análise disponível.';
    statusMesInfo.textContent = saldo >= 0 ? 'Mês positivo' : 'Mês negativo';
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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

    selectTipo.value = 'ganho';
    sincronizarBotoesTipo('ganho');
    preencherCategoriasPorTipo('ganho');

    await atualizarTudo();

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('.nav-item[data-screen="transacoes"]').classList.add('active');
    document.querySelectorAll('.screen').forEach(section => section.classList.remove('active'));
    document.getElementById('screen-transacoes').classList.add('active');
  } catch (error) {
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

  const body = { nome, tipo };

  try {
    await fetch(`${API}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    e.target.reset();
    document.getElementById('tipoCategoria').value = '';
    await carregarCategorias();
  } catch (error) {
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
  } catch (error) {
    alert('Erro ao exportar TSV.');
  }
});

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
