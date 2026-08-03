const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

function getMesRef(req) {
  return req.query.mes || new Date().toISOString().slice(0, 7);
}

/* =========================
   CARTÕES DE CRÉDITO
========================= */

// listar cartões
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

// criar cartão
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

// remover cartão
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

// listar compras de um cartão por mês
app.get('/api/cartoes/:id/compras', async (req, res) => {
  const { id } = req.params;
  const mes = getMesRef(req);

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

// criar compra no cartão
app.post('/api/cartoes/:id/compras', async (req, res) => {
  const { id } = req.params;
  const {
    descricao,
    valor,
    categoria,
    data_compra
  } = req.body;

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

// remover compra do cartão
app.delete('/api/cartoes/compras/:compraId', async (req, res) => {
  const { compraId } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM compras_cartao
       WHERE id = $1
       RETURNING *`,
      [compraId]
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

// registrar pagamento da fatura
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

// listar pagamentos de um cartão no mês
app.get('/api/cartoes/:id/pagamentos', async (req, res) => {
  const { id } = req.params;
  const mes = getMesRef(req);

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

/* =========================
   RESUMO DO CARTÃO
========================= */

// resumo de um cartão no mês
app.get('/api/cartoes/:id/resumo', async (req, res) => {
  const { id } = req.params;
  const mes = getMesRef(req);

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
