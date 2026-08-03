const express = require('express');
const router = express.Router();
const pool = require('./db');

router.post('/', async (req, res) => {
  try {
    const { descricao, valor, tipo, natureza, status, categoria_id, data_transacao } = req.body;
    const result = await pool.query(
      `INSERT INTO transacoes (descricao, valor, tipo, natureza, status, categoria_id, data_transacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [descricao, valor, tipo, natureza, status, categoria_id, data_transacao]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { mes } = req.query;
    const result = await pool.query(
      `SELECT t.*, c.nome AS categoria FROM transacoes t
       LEFT JOIN categorias c ON c.id = t.categoria_id
       WHERE to_char(data_transacao,'YYYY-MM') = $1
       ORDER BY data_transacao DESC`, [mes]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE transacoes SET status=$1 WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transacoes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/categorias/lista', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias ORDER BY nome');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/categorias', async (req, res) => {
  try {
    const { nome, tipo } = req.body;
    const result = await pool.query(
      'INSERT INTO categorias (nome, tipo) VALUES ($1,$2) RETURNING *',
      [nome, tipo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/dashboard/:mes', async (req, res) => {
  try {
    const { mes } = req.params;
    const ganhos = await pool.query(
      `SELECT COALESCE(SUM(valor),0) total FROM transacoes WHERE tipo='ganho' AND status='pago' AND to_char(data_transacao,'YYYY-MM')=$1`, [mes]);
    const gastos = await pool.query(
      `SELECT COALESCE(SUM(valor),0) total FROM transacoes WHERE tipo='gasto' AND status='pago' AND to_char(data_transacao,'YYYY-MM')=$1`, [mes]);
    const pendentes = await pool.query(
      `SELECT COALESCE(SUM(valor),0) total FROM transacoes WHERE tipo='gasto' AND status IN ('pendente','urgente') AND to_char(data_transacao,'YYYY-MM')=$1`, [mes]);
    const saldo = Number(ganhos.rows[0].total) - Number(gastos.rows[0].total);
    res.json({
      ganhos: ganhos.rows[0].total,
      gastos: gastos.rows[0].total,
      pendentes: pendentes.rows[0].total,
      saldo,
      mensagem: saldo >= 0
        ? `Você lucrou R$ ${saldo.toFixed(2)}`
        : `Você gastou e ficou negativo em R$ ${Math.abs(saldo).toFixed(2)} nesse mês`
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/tsv/:mes', async (req, res) => {
  try {
    const { mes } = req.params;
    const result = await pool.query(
      `SELECT t.descricao, t.valor, t.tipo, t.natureza, t.status, c.nome AS categoria, t.data_transacao
       FROM transacoes t LEFT JOIN categorias c ON c.id = t.categoria_id
       WHERE to_char(data_transacao,'YYYY-MM') = $1
       ORDER BY t.data_transacao`, [mes]
    );
    let tsv = 'descricao\tvalor\ttipo\tnatureza\tstatus\tcategoria\tdata\n';
    result.rows.forEach(r => {
      tsv += `${r.descricao}\t${r.valor}\t${r.tipo}\t${r.natureza}\t${r.status}\t${r.categoria || ''}\t${r.data_transacao.toISOString().split('T')[0]}\n`;
    });
    res.setHeader('Content-Type', 'text/tab-separated-values');
    res.setHeader('Content-Disposition', `attachment; filename=financeiro_${mes}.tsv`);
    res.send(tsv);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
