const API = '/api/transacoes';
let mesAtual = new Date().toISOString().slice(0,7);

document.getElementById('filtroMes').value = mesAtual;
document.getElementById('filtroMes').addEventListener('change', (e) => {
  mesAtual = e.target.value;
  atualizarTudo();
});

document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button, .tab-content').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

async function carregarDashboard() {
  const res = await fetch(`${API}/dashboard/${mesAtual}`);
  const data = await res.json();
  document.getElementById('totalGanhos').textContent = `R$ ${Number(data.ganhos).toFixed(2)}`;
  document.getElementById('totalGastos').textContent = `R$ ${Number(data.gastos).toFixed(2)}`;
  document.getElementById('totalPendentes').textContent = `R$ ${Number(data.pendentes).toFixed(2)}`;
  const msgEl = document.getElementById('mensagemSaldo');
  msgEl.textContent = data.mensagem;
  msgEl.parentElement.classList.remove('positivo','negativo');
  msgEl.parentElement.classList.add(data.saldo >= 0 ? 'positivo' : 'negativo');
}

async function carregarCategorias() {
  const res = await fetch(`${API}/categorias/lista`);
  const categorias = await res.json();
  const select = document.getElementById('categoria_id');
  select.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome} (${c.tipo})</option>`).join('');
  const lista = document.getElementById('listaCategorias');
  lista.innerHTML = categorias.map(c => `<li>${c.nome} — ${c.tipo}</li>`).join('');
}

async function carregarTransacoes() {
  const res = await fetch(`${API}?mes=${mesAtual}`);
  const transacoes = await res.json();
  const tbody = document.querySelector('#tabelaTransacoes tbody');
  tbody.innerHTML = transacoes.map(t => `
    <tr>
      <td>${t.descricao}</td>
      <td>R$ ${Number(t.valor).toFixed(2)}</td>
      <td>${t.tipo}</td>
      <td>${t.natureza}</td>
      <td class="status-${t.status}">${t.status}</td>
      <td>${t.categoria || '-'}</td>
      <td>${new Date(t.data_transacao).toLocaleDateString('pt-BR')}</td>
      <td>
        <button onclick="excluirTransacao(${t.id})">Excluir</button>
      </td>
    </tr>
  `).join('');
}

async function excluirTransacao(id) {
  await fetch(`${API}/${id}`, { method: 'DELETE' });
  atualizarTudo();
}

document.getElementById('formTransacao').addEventListener('submit', async (e) => {
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
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  e.target.reset();
  atualizarTudo();
});

document.getElementById('formCategoria').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    nome: document.getElementById('nomeCategoria').value,
    tipo: document.getElementById('tipoCategoria').value
  };
  await fetch(`${API}/categorias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  e.target.reset();
  carregarCategorias();
});

document.getElementById('btnExportarTSV').addEventListener('click', async () => {
  const res = await fetch(`${API}/tsv/${mesAtual}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financeiro_${mesAtual}.tsv`;
  a.click();
});

function atualizarTudo() {
  carregarDashboard();
  carregarTransacoes();
  carregarCategorias();
}

atualizarTudo();
