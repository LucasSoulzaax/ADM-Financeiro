const API = '/api/transacoes';

let mesAtual = new Date().toISOString().slice(0, 7);
let transacoesCache = [];
let filtroAtual = 'todas';

const filtroMes = document.getElementById('filtroMes');
const listaTransacoes = document.getElementById('listaTransacoes');
const listaCategorias = document.getElementById('listaCategorias');
const statusMesInfo = document.getElementById('statusMesInfo');

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
    document.getElementById('tipo').value = btn.dataset.typeChoice;
  });
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
    const categorias = await res.json();

    const select = document.getElementById('categoria_id');
    select.innerHTML = categorias.length
      ? categorias.map(c => `<option value="${c.id}">${c.nome} (${c.tipo})</option>`).join('')
      : '<option value="">Sem categorias</option>';

    listaCategorias.innerHTML = categorias.length
      ? categorias.map(c => `
          <div class="category-item">
            <strong>${c.nome}</strong>
            <span class="category-type">${c.tipo}</span>
          </div>
        `).join('')
      : `<div class="empty-state">Nenhuma categoria cadastrada ainda.</div>`;
  } catch (error) {
    listaCategorias.innerHTML = `<div class="empty-state">Erro ao carregar categorias.</div>`;
  }
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

  const body = {
    descricao: document.getElementById('descricao').value,
    valor: parseFloat(document.getElementById('valor').value),
    tipo: document.getElementById('tipo').value,
    natureza: document.getElementById('natureza').value,
    status: document.getElementById('status').value,
    categoria_id: document.getElementById('categoria_id').value || null,
    data_transacao: document.getElementById('data_transacao').value
  };

  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    e.target.reset();
    document.getElementById('tipo').value = 'ganho';
    document.querySelectorAll('.type-btn').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-type-choice="ganho"]').classList.add('active');

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

  const body = {
    nome: document.getElementById('nomeCategoria').value,
    tipo: document.getElementById('tipoCategoria').value
  };

  try {
    await fetch(`${API}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    e.target.reset();
    carregarCategorias();
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

atualizarTudo();
