const crypto = require('crypto');

module.exports = function registerEducacaoAssinaturas({ app, pool, fetch, exigirAlunoEducacao, exigirAdmin }) {
  const PUBLIC_URL = (process.env.MULTIPLAY_PUBLIC_URL || 'https://multiplay-site.onrender.com').replace(/\/$/, '');
  const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
  const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';

  const PLAN_SEED = [
    {
      code: 'essencial',
      name: 'Multiplay Essencial',
      description: 'Livros, e-books e audiobooks do catálogo liberado.',
      price: Number(process.env.MP_EDU_ESSENCIAL || 19.90)
    },
    {
      code: 'completo',
      name: 'Multiplay Completo',
      description: 'Biblioteca completa + cursos premium parceiros.',
      price: Number(process.env.MP_EDU_COMPLETO || 29.90)
    },
    {
      code: 'profissional',
      name: 'Multiplay Profissional',
      description: 'Acesso completo aos conteúdos premium da Multiplay.',
      price: Number(process.env.MP_EDU_PROFISSIONAL || 49.90)
    }
  ];

  async function ensureTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS edu_students(id SERIAL PRIMARY KEY,name VARCHAR(180) NOT NULL,email VARCHAR(180) UNIQUE NOT NULL,username VARCHAR(100) UNIQUE NOT NULL,password_hash TEXT NOT NULL,phone VARCHAR(40),plan VARCHAR(80) DEFAULT 'Multiplay Educação',active BOOLEAN DEFAULT TRUE,access_until TIMESTAMP NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,last_login_at TIMESTAMP NULL);
      CREATE TABLE IF NOT EXISTS edu_courses(id SERIAL PRIMARY KEY,title VARCHAR(220) NOT NULL,description TEXT,category VARCHAR(100),provider VARCHAR(180),workload_hours NUMERIC(8,2) DEFAULT 0,content_url TEXT,cover_url TEXT,active BOOLEAN DEFAULT TRUE,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS edu_plans(
        id SERIAL PRIMARY KEY,
        code VARCHAR(60) UNIQUE NOT NULL,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        price NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BRL',
        billing_frequency INTEGER DEFAULT 1,
        billing_frequency_type VARCHAR(20) DEFAULT 'months',
        mp_plan_id VARCHAR(120),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS edu_subscriptions(
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES edu_students(id) ON DELETE CASCADE,
        plan_id INTEGER NOT NULL REFERENCES edu_plans(id),
        mp_preapproval_id VARCHAR(120) UNIQUE,
        mp_external_reference VARCHAR(180),
        status VARCHAR(40) DEFAULT 'pending',
        payer_email VARCHAR(180),
        access_until TIMESTAMP NULL,
        next_payment_date TIMESTAMP NULL,
        started_at TIMESTAMP NULL,
        canceled_at TIMESTAMP NULL,
        last_sync_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_edu_sub_student ON edu_subscriptions(student_id);
      CREATE INDEX IF NOT EXISTS idx_edu_sub_status ON edu_subscriptions(status);
      CREATE TABLE IF NOT EXISTS edu_payment_events(
        id BIGSERIAL PRIMARY KEY,
        provider VARCHAR(40) NOT NULL,
        event_type VARCHAR(100),
        external_id VARCHAR(180) NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, external_id, event_type)
      );
      ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS subscription_required BOOLEAN DEFAULT FALSE;
    `);

    for (const p of PLAN_SEED) {
      await pool.query(
        `INSERT INTO edu_plans(code,name,description,price,currency,billing_frequency,billing_frequency_type)
         VALUES($1,$2,$3,$4,'BRL',1,'months')
         ON CONFLICT(code) DO UPDATE SET
           name=EXCLUDED.name,
           description=EXCLUDED.description,
           price=EXCLUDED.price,
           updated_at=NOW()`,
        [p.code, p.name, p.description, p.price]
      );
    }
  }

  async function mpRequest(method, path, body) {
    if (!MP_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado no servidor.');
    const r = await fetch('https://api.mercadopago.com' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + MP_TOKEN,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await r.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) {}
    if (!r.ok) {
      const msg = data.message || data.error || ('Mercado Pago HTTP ' + r.status);
      throw new Error(msg);
    }
    return data;
  }

  async function ensureMpPlan(plan) {
    if (plan.mp_plan_id) return plan.mp_plan_id;
    const created = await mpRequest('POST', '/preapproval_plan', {
      reason: plan.name + ' - Multiplay Educação',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: Number(plan.price),
        currency_id: 'BRL'
      },
      back_url: PUBLIC_URL + '/assinatura.html?status=retorno'
    });
    await pool.query(
      'UPDATE edu_plans SET mp_plan_id=$1,updated_at=NOW() WHERE id=$2',
      [created.id, plan.id]
    );
    return created.id;
  }

  async function syncSubscriptionById(mpId) {
    const remote = await mpRequest('GET', '/preapproval/' + encodeURIComponent(mpId));
    const status = String(remote.status || 'pending').toLowerCase();
    const next = remote.next_payment_date ? new Date(remote.next_payment_date) : null;
    const accessUntil = (status === 'authorized' || status === 'active')
      ? (next || new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
      : null;

    const q = await pool.query(
      `UPDATE edu_subscriptions
       SET status=$1,next_payment_date=$2,access_until=$3,
           started_at=CASE WHEN $1 IN ('authorized','active') THEN COALESCE(started_at,NOW()) ELSE started_at END,
           canceled_at=CASE WHEN $1='canceled' THEN COALESCE(canceled_at,NOW()) ELSE canceled_at END,
           last_sync_at=NOW(),updated_at=NOW()
       WHERE mp_preapproval_id=$4
       RETURNING student_id,plan_id,status,access_until,next_payment_date`,
      [status, next, accessUntil, mpId]
    );

    if (q.rows.length) {
      const s = q.rows[0];
      if (status === 'authorized' || status === 'active') {
        await pool.query(
          `UPDATE edu_students
           SET plan=(SELECT name FROM edu_plans WHERE id=$1),
               access_until=GREATEST(COALESCE(access_until,NOW()),COALESCE($2,NOW())),
               active=TRUE,updated_at=NOW()
           WHERE id=$3`,
          [s.plan_id, accessUntil, s.student_id]
        );
      } else if (status === 'canceled' || status === 'paused') {
        // Mantém o acesso até o fim do período já pago.
        await pool.query(
          `UPDATE edu_students
           SET updated_at=NOW()
           WHERE id=$1`,
          [s.student_id]
        );
      }
    }
    return remote;
  }

  async function handleWebhook(req, res) {
    try {
      if (MP_WEBHOOK_SECRET) {
        const signature = String(req.headers['x-signature'] || '');
        const requestId = String(req.headers['x-request-id'] || '');
        const dataId = String(req.query?.['data.id'] || req.body?.data?.id || req.body?.id || '');
        const parts = Object.fromEntries(signature.split(',').map(x => x.split('=').map(v => v.trim())));
        const ts = parts.ts || '';
        const v1 = parts.v1 || '';
        const manifestParts=[];
        if (dataId) manifestParts.push('id:' + dataId + ';');
        if (requestId) manifestParts.push('request-id:' + requestId + ';');
        if (ts) manifestParts.push('ts:' + ts + ';');
        const manifest=manifestParts.join('');
        const expected=crypto.createHmac('sha256',MP_WEBHOOK_SECRET).update(manifest).digest('hex');
        if (!v1 || v1.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(v1),Buffer.from(expected))) return res.status(401).json({success:false});
      } else if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({success:false,message:'Webhook do Mercado Pago sem segredo configurado.'});
      }
      const type = String(req.body?.type || req.body?.topic || 'unknown');
      const dataId = String(req.body?.data?.id || req.body?.id || '');
      if (!dataId) return res.status(200).json({ received: true });

      await pool.query(
        `INSERT INTO edu_payment_events(provider,event_type,external_id,payload)
         VALUES('mercadopago',$1,$2,$3)
         ON CONFLICT(provider,external_id,event_type) DO NOTHING`,
        [type, dataId, req.body || {}]
      );

      if (type === 'subscription_preapproval' || type === 'subscription_authorized_payment') {
        await syncSubscriptionById(dataId);
      }
      return res.status(200).json({ received: true });
    } catch (e) {
      console.error('MultiPlay Mercado Pago webhook:', e.message);
      return res.status(200).json({ received: true });
    }
  }

  app.get('/api/educacao/plans', async (req, res) => {
    try {
      const q = await pool.query(
        'SELECT id,code,name,description,price,currency,billing_frequency,billing_frequency_type,active FROM edu_plans WHERE active=true ORDER BY price'
      );
      res.json({ success: true, plans: q.rows });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Erro ao carregar planos.' });
    }
  });

  app.get('/api/educacao/subscription', exigirAlunoEducacao, async (req, res) => {
    try {
      const q = await pool.query(
        `SELECT s.id,s.status,s.access_until,s.next_payment_date,s.started_at,s.canceled_at,
                p.code,p.name,p.description,p.price,p.currency
         FROM edu_subscriptions s
         JOIN edu_plans p ON p.id=s.plan_id
         WHERE s.student_id=$1
         ORDER BY s.created_at DESC LIMIT 1`,
        [req.aluno.id]
      );
      res.json({ success: true, subscription: q.rows[0] || null });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Erro ao carregar assinatura.' });
    }
  });

  app.post('/api/educacao/subscriptions/checkout', exigirAlunoEducacao, async (req, res) => {
    const code = String(req.body?.plan_code || '').trim();
    if (!code) return res.status(400).json({ success: false, message: 'Informe o plano.' });

    try {
      const planQ = await pool.query(
        'SELECT * FROM edu_plans WHERE code=$1 AND active=true',
        [code]
      );
      if (!planQ.rows.length) return res.status(404).json({ success: false, message: 'Plano não encontrado.' });
      const plan = planQ.rows[0];

      const studentQ = await pool.query(
        'SELECT id,name,email,active FROM edu_students WHERE id=$1',
        [req.aluno.id]
      );
      if (!studentQ.rows.length || !studentQ.rows[0].active) {
        return res.status(403).json({ success: false, message: 'Aluno inativo.' });
      }
      const student = studentQ.rows[0];

      const activeQ = await pool.query(
        `SELECT id FROM edu_subscriptions
         WHERE student_id=$1 AND status IN ('pending','authorized','active','paused')
         ORDER BY created_at DESC LIMIT 1`,
        [student.id]
      );
      if (activeQ.rows.length) {
        return res.status(409).json({
          success: false,
          message: 'Você já possui uma assinatura em andamento. Consulte sua assinatura atual antes de trocar de plano.'
        });
      }

      const mpPlanId = await ensureMpPlan(plan);
      const external = 'EDU-' + student.id + '-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');

      const created = await mpRequest('POST', '/preapproval', {
        preapproval_plan_id: mpPlanId,
        payer_email: student.email,
        external_reference: external,
        reason: plan.name + ' - Multiplay Educação',
        back_url: PUBLIC_URL + '/assinatura.html?status=retorno'
      });

      await pool.query(
        `INSERT INTO edu_subscriptions
         (student_id,plan_id,mp_preapproval_id,mp_external_reference,status,payer_email)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [student.id, plan.id, created.id || null, external, String(created.status || 'pending').toLowerCase(), student.email]
      );

      res.json({
        success: true,
        subscription_id: created.id,
        status: created.status,
        checkout_url: created.init_point,
        plan: { code: plan.code, name: plan.name, price: plan.price }
      });
    } catch (e) {
      console.error('MultiPlay checkout assinatura:', e);
      res.status(502).json({
        success: false,
        message: 'Não foi possível iniciar a assinatura. Verifique a configuração do Mercado Pago no servidor.',
        detail: process.env.NODE_ENV === 'production' ? undefined : e.message
      });
    }
  });

  app.post('/api/educacao/subscriptions/sync', exigirAlunoEducacao, async (req, res) => {
    try {
      const q = await pool.query(
        'SELECT mp_preapproval_id FROM edu_subscriptions WHERE student_id=$1 ORDER BY created_at DESC LIMIT 1',
        [req.aluno.id]
      );
      if (!q.rows.length || !q.rows[0].mp_preapproval_id) {
        return res.json({ success: true, subscription: null });
      }
      const remote = await syncSubscriptionById(q.rows[0].mp_preapproval_id);
      res.json({
        success: true,
        subscription: {
          id: q.rows[0].mp_preapproval_id,
          status: remote.status,
          next_payment_date: remote.next_payment_date || null
        }
      });
    } catch (e) {
      res.status(502).json({ success: false, message: 'Não foi possível sincronizar a assinatura.' });
    }
  });

  app.post('/api/educacao/subscriptions/cancel', exigirAlunoEducacao, async (req, res) => {
    try {
      const q = await pool.query(
        'SELECT id,mp_preapproval_id FROM edu_subscriptions WHERE student_id=$1 AND status IN (\'pending\',\'authorized\',\'active\',\'paused\') ORDER BY created_at DESC LIMIT 1',
        [req.aluno.id]
      );
      if (!q.rows.length || !q.rows[0].mp_preapproval_id) {
        return res.status(404).json({ success: false, message: 'Nenhuma assinatura ativa encontrada.' });
      }
      await mpRequest('PUT', '/preapproval/' + encodeURIComponent(q.rows[0].mp_preapproval_id), { status: 'canceled' });
      await syncSubscriptionById(q.rows[0].mp_preapproval_id);
      res.json({ success: true, message: 'Assinatura cancelada. O acesso permanece até o fim do período já pago.' });
    } catch (e) {
      res.status(502).json({ success: false, message: 'Não foi possível cancelar a assinatura.' });
    }
  });

  app.post('/api/educacao/mercadopago/webhook', handleWebhook);

  app.get('/api/admin/educacao/subscriptions', exigirAdmin, async (req, res) => {
    try {
      const q = await pool.query(
        `SELECT s.id,s.mp_preapproval_id,s.status,s.access_until,s.next_payment_date,s.created_at,
                st.id student_id,st.name student_name,st.email student_email,
                p.code plan_code,p.name plan_name,p.price
         FROM edu_subscriptions s
         JOIN edu_students st ON st.id=s.student_id
         JOIN edu_plans p ON p.id=s.plan_id
         ORDER BY s.created_at DESC`
      );
      res.json({ success: true, subscriptions: q.rows });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Erro ao listar assinaturas.' });
    }
  });

  app.post('/api/admin/educacao/subscriptions/:id/sync', exigirAdmin, async (req, res) => {
    try {
      const q = await pool.query('SELECT mp_preapproval_id FROM edu_subscriptions WHERE id=$1', [Number(req.params.id)]);
      if (!q.rows.length || !q.rows[0].mp_preapproval_id) return res.status(404).json({ success:false, message:'Assinatura não encontrada.' });
      const remote = await syncSubscriptionById(q.rows[0].mp_preapproval_id);
      res.json({ success:true, status:remote.status, next_payment_date:remote.next_payment_date || null });
    } catch (e) {
      res.status(502).json({ success:false, message:'Falha ao sincronizar com o Mercado Pago.' });
    }
  });

  ensureTables().catch(e => console.error('MultiPlay Assinaturas:', e.message));
};
