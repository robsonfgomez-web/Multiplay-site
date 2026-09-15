import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Order } from 'mercadopago';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Servindo a pasta public de forma absoluta
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const PLANS = {
  Mensal: Number(process.env.PLAN_MONTHLY || 0),
  Trimestral: Number(process.env.PLAN_QUARTERLY || 0),
  Anual: Number(process.env.PLAN_YEARLY || 0)
};

function mpClient() {
  if (!process.env.MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN não configurado.');
  return new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
}

// ROTA RAIZ: Entrega o index.html automaticamente
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/checkout', async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan] || PLANS[plan] <= 0) {
      return res.status(400).json({ error: 'Preço do plano não configurado.' });
    }

    const amount = PLANS[plan].toFixed(2);
    const externalReference = `MULTIPLAY-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;

    const order = new Order(mpClient());
    const result = await order.create({
      body: {
        type: 'online',
        total_amount: amount,
        external_reference: externalReference,
        processing_mode: 'manual',
        capture_mode: 'automatic_async',
        description: `MultiPlay - Plano ${plan}`,
        items: [{
          external_code: `MULTIPLAY-${plan.toUpperCase()}`,
          title: `MultiPlay - Plano ${plan}`,
          quantity: 1,
          unit_price: amount
        }],
        config: {
          online: {
            callback_url: BASE_URL,
            success_url: `${BASE_URL}/sucesso.html`,
            failure_url: `${BASE_URL}/falha.html`,
            pending_url: `${BASE_URL}/pendente.html`,
            auto_return: 'approved'
          }
        }
      },
      requestOptions: { idempotencyKey: externalReference }
    });

    return res.json({ checkout_url: result.checkout_url, order_id: result.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Falha ao criar checkout.' });
  }
});

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'MultiPlay' }));

app.post('/api/webhook', (req, res) => {
  console.log('Webhook recebido:', JSON.stringify(req.body));
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`MultiPlay em ${BASE_URL}`));
