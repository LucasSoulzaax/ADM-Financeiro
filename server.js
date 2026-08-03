const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function getMesRef(value) {
  return value || new Date().toISOString().slice(0, 7);
}

function formatMesAtual(dateValue) {
  const date = new Date(`${dateValue}-01T00:00:00`);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, erro: 'Falha na conexão com o banco.' });
  }
});

/* =========================
   TRANSAÇÕES
========================= */
app.get('/api/transacoes', async (req, res) => {
  const mes = getMesRef(req.query.mes);

  try {
    const result = await pool.query(
      `SELECT t.id, t.descricao, t.valor, t.tipo, t.natureza, t.status, t.data_transacao,
              c.nome AS categoria
       FROM transacoes t
       LEFT JOIN categorias c ON c.id = t.categoria_id
       WHERE TO_CHAR(t.data_transacao, 'YYYY-MM') = $1
       ORDER BY t.data_transacao DESC, t.id DESC`,
      [mes]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar transações.' });
  }
});

app.post('/api/transacoes', async (req, res) => {
  const {
    descricao,
    valor,
    tipo,
    natureza,
    status,
    categoria_id,
    data_transacao
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO transacoes
       (descricao, valor, tipo, natureza, status, categoria_id, data_transacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [descricao, valor, tipo, natureza, status, categoria_id, data_transacao]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar transação.' });
  }
});

app.get('/api/transacoes/dashboard/:mes', async (req, res) => {
  const mes = getMesRef(req.params.mes);

  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE 0 END), 0) AS ganhos,
         COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END), 0) AS gastos,
         COALESCE(SUM(CASE WHEN status IN ('pendente', 'urgente') THEN valor ELSE 0 END), 0) AS pendentes
       FROM transacoes
       WHERE TO_CHAR(data_transacao, 'YYYY-MM') = $1`,
      [mes]
    );

    const ganhos = Number(result.rows[0].ganhos || 0);
    const gastos = Number(result.rows[0].gastos || 0);
    const pendentes = Number(result.rows[0].pendentes || 0);
    const saldo = ganhos - gastos;

    let mensagem = `Resumo de ${formatMesAtual(mes)} carregado.`;
    if (saldo > 0) mensagem = `Você fechou ${formatMesAtual(mes)} com saldo positivo.`;
    if (saldo < 0) mensagem = `Atenção: suas despesas passaram das receitas em ${formatMesAtual(mes)}.`;
    if (ganhos === 0 && gastos === 0) mensagem = 'Ainda não há movimentações neste mês.';

    res.json({ ganhos, gastos, pendentes, saldo, mensagem });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao carregar dashboard.' });
  }
});

app.get('/api/transacoes/tsv/:mes', async (req, res) => {
  const mes = getMesRef(req.params.mes);

  try {
    const result = await pool.query(
      `SELECT t.descricao, t.valor, t.tipo, t.natureza, t.status, t.data_transacao,
              COALESCE(c.nome, '') AS categoria
       FROM transacoes t
       LEFT JOIN categorias c ON c.id = t.categoria_id
       WHERE TO_CHAR(t.data_transacao, 'YYYY-MM') = $1
       ORDER BY t.data_transacao DESC, t.id DESC`,
      [mes]
    );

    const header = ['descricao', 'valor', 'tipo', 'natureza', 'status', 'categoria', 'data_transacao'];
    const lines = result.rows.map(row => [
      row.descricao,
      row.valor,
      row.tipo,
      row.natureza,
      row.status,
      row.categoria,
      new Date(row.data_transacao).toISOString().slice(0, 10)
    ].join('\t'));

    const tsv = [header.join('\t'), ...lines].join('\n');

    res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="financeiro_${mes}.tsv"`);
    res.send(tsv);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao exportar TSV.' });
  }
});

/* =========================
   CATEGORIAS
========================= */
app.get('/api/transacoes/categorias/lista', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM categorias
       ORDER BY tipo ASC, nome ASC`
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar categorias.' });
  }
});

app.post('/api/transacoes/categorias', async (req, res) => {
  const { nome, tipo } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO categorias (nome, tipo)
       VALUES ($1, $2)
       RETURNING *`,
      [nome, tipo]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar categoria.' });
  }
});

/* =========================
   CARTÕES DE CRÉDITO
========================= */
app.get('/api/cartoes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM cartoes_credito
       ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar cartões.' });
  }
});

app.post('/api/cartoes', async (req, res) => {
  const {
    nome,
    apelido,
    final_cartao,
    limite_total,
    dia_fechamento,
    dia_vencimento
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO cartoes_credito
       (nome, apelido, final_cartao, limite_total, dia_fechamento, dia_vencimento)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nome, apelido, final_cartao, limite_total, dia_fechamento, dia_vencimento]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar cartão.' });
  }
});

app.put('/api/cartoes/:id', async (req, res) => {
  const { id } = req.params;
  const {
    nome,
    apelido,
    final_cartao,
    limite_total,
    dia_fechamento,
    dia_vencimento
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE cartoes_credito
       SET nome = $1,
           apelido = $2,
           final_cartao = $3,
           limite_total = $4,
           dia_fechamento = $5,
           dia_vencimento = $6
       WHERE id = $7
       RETURNING *`,
      [nome, apelido, final_cartao, limite_total, dia_fechamento, dia_vencimento, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ erro: 'Cartão não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao editar cartão.' });
  }
});

app.delete('/api/cartoes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM cartoes_credito
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ erro: 'Cartão não encontrado.' });
    }

    res.json({ mensagem: 'Cartão removido com sucesso.', cartao: result.rows[0] });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao remover cartão.' });
  }
});

/* =========================
   COMPRAS NO CARTÃO
========================= */
app.get('/api/cartoes/:id/compras', async (req, res) => {
  const { id } = req.params;
  const mes = getMesRef(req.query.mes);

  try {
    const result = await pool.query(
      `SELECT *
       FROM compras_cartao
       WHERE cartao_id = $1
         AND TO_CHAR(data_compra, 'YYYY-MM') = $2
       ORDER BY data_compra DESC, id DESC`,
      [id, mes]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar compras do cartão.' });
  }
});

app.post('/api/cartoes/:id/compras', async (req, res) => {
  const { id } = req.params;
  const { descricao, valor, categoria, data_compra } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO compras_cartao
       (cartao_id, descricao, valor, categoria, data_compra)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, descricao, valor, categoria, data_compra]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao lançar compra no cartão.' });
  }
});

app.put('/api/cartoes/compras/:compraId', async (req, res) => {
  const { compraId } = req.params;
  const { descricao, valor, categoria, data_compra } = req.body;

  try {
    const result = await pool.query(
      `UPDATE compras_cartao
       SET descricao = $1,
           valor = $2,
           categoria = $3,
           data_compra = $4
       WHERE id = $5
       RETURNING *`,
      [descricao, valor, categoria, data_compra, compraId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ erro: 'Compra não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao editar compra.' });
  }
});

app.delete('/api/cartoes/compras/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM compras_cartao
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ erro: 'Compra não encontrada.' });
    }

    res.json({ mensagem: 'Compra removida com sucesso.', compra: result.rows[0] });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao remover compra.' });
  }
});

/* =========================
   PAGAMENTO DE FATURA
========================= */
app.get('/api/cartoes/:id/pagamentos', async (req, res) => {
  const { id } = req.params;
  const mes = getMesRef(req.query.mes);

  try {
    const result = await pool.query(
      `SELECT *
       FROM pagamentos_fatura
       WHERE cartao_id = $1
         AND referencia_mes = $2
       ORDER BY data_pagamento DESC, id DESC`,
      [id, mes]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar pagamentos da fatura.' });
  }
});

app.post('/api/cartoes/:id/pagamentos', async (req, res) => {
  const { id } = req.params;
  const { valor, data_pagamento, referencia_mes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO pagamentos_fatura
       (cartao_id, valor, data_pagamento, referencia_mes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, valor, data_pagamento, referencia_mes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao registrar pagamento da fatura.' });
  }
});

/* =========================
   RESUMO DO CARTÃO
========================= */
app.get('/api/cartoes/:id/resumo', async (req, res) => {
  const { id } = req.params;
  const mes = getMesRef(req.query.mes);

  try {
    const cartaoResult = await pool.query(
      `SELECT *
       FROM cartoes_credito
       WHERE id = $1`,
      [id]
    );

    if (!cartaoResult.rows.length) {
      return res.status(404).json({ erro: 'Cartão não encontrado.' });
    }

    const cartao = cartaoResult.rows[0];

    const comprasResult = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) AS total_compras
       FROM compras_cartao
       WHERE cartao_id = $1
         AND TO_CHAR(data_compra, 'YYYY-MM') = $2`,
      [id, mes]
    );

    const pagamentosResult = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) AS total_pago
       FROM pagamentos_fatura
       WHERE cartao_id = $1
         AND referencia_mes = $2`,
      [id, mes]
    );

    const totalCompras = Number(comprasResult.rows[0].total_compras || 0);
    const totalPago = Number(pagamentosResult.rows[0].total_pago || 0);
    const limiteTotal = Number(cartao.limite_total || 0);
    const limiteDisponivel = Math.max(limiteTotal - totalCompras, 0);
    const percentualUsado = limiteTotal > 0 ? (totalCompras / limiteTotal) * 100 : 0;
    const restanteFatura = Math.max(totalCompras - totalPago, 0);

    res.json({
      cartao,
      mes,
      fatura_atual: totalCompras,
      total_pago: totalPago,
      restante_fatura: restanteFatura,
      limite_total: limiteTotal,
      limite_disponivel: limiteDisponivel,
      percentual_usado: Number(percentualUsado.toFixed(2))
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao carregar resumo do cartão.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
