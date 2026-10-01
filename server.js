const express = require('express');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
pool.query('SELECT NOW()')
  .then(() => {
    console.log('MultiPlay: banco conectado com sucesso');
  })
  .catch((error) => {
    console.error('MultiPlay: erro ao conectar ao banco:', error.message);
  });

const XTREAM_HOST = 'http://u.l0.ms';

app.use(express.json());
app.use(express.static(__dirname));


/* =========================
   PÁGINAS
========================= */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/app.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.html'));
});

app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'player.html'));
});


/* =========================
   XTREAM
========================= */

async function xtreamRequest(user, pass, action) {

  let url =
    `${XTREAM_HOST}/player_api.php` +
    `?username=${encodeURIComponent(user)}` +
    `&password=${encodeURIComponent(pass)}`;

  if (action) {
    url += `&action=${encodeURIComponent(action)}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Servidor de conteúdo indisponível');
  }

  return await response.json();
}


/* =========================
   LOGIN
========================= */

app.post('/api/login', async (req, res) => {

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Usuário e senha são obrigatórios.'
    });
  }

  try {

    const data = await xtreamRequest(
      username,
      password
    );

    const userInfo = data && data.user_info;

    if (
      !userInfo ||
      userInfo.auth === 0 ||
      userInfo.auth === false
    ) {

      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos.'
      });

    }

    return res.json({
      success: true,
      message: 'Login realizado com sucesso.',
      user: {
        username: username
      }
    });

  } catch (error) {

    console.error('Erro no login:', error);

    return res.status(502).json({
      success: false,
      message: 'Não foi possível verificar o acesso.'
    });

  }

});


/* =========================
   CATÁLOGO
========================= */

app.get('/api/catalogo', async (req, res) => {

  const { user, pass } = req.query;

  if (!user || !pass) {
    return res.status(400).json({
      error: 'Usuário e senha são obrigatórios'
    });
  }

  try {

    const [canais, filmes, series] =
      await Promise.all([

        xtreamRequest(
          user,
          pass,
          'get_live_streams'
        ),

        xtreamRequest(
          user,
          pass,
          'get_vod_streams'
        ),

        xtreamRequest(
          user,
          pass,
          'get_series'
        )

      ]);

    return res.json({
      canais: Array.isArray(canais) ? canais : [],
      filmes: Array.isArray(filmes) ? filmes : [],
      series: Array.isArray(series) ? series : []
    });

  } catch (error) {

    console.error('Erro catálogo:', error);

    return res.status(500).json({
      error: 'Não foi possível carregar o catálogo'
    });

  }

});


/* =========================
   CANAIS
========================= */

app.get('/api/canais', async (req, res) => {

  const { user, pass } = req.query;

  if (!user || !pass) {
    return res.status(400).json({
      error: 'Usuário e senha são obrigatórios'
    });
  }

  try {

    const data = await xtreamRequest(
      user,
      pass,
      'get_live_streams'
    );

    return res.json(
      Array.isArray(data) ? data : []
    );

  } catch (error) {

    console.error('Erro canais:', error);

    return res.status(500).json({
      error: 'Erro ao carregar canais'
    });

  }

});


/* =========================
   FILMES
========================= */

app.get('/api/filmes', async (req, res) => {

  const { user, pass } = req.query;

  if (!user || !pass) {
    return res.status(400).json({
      error: 'Usuário e senha são obrigatórios'
    });
  }

  try {

    const data = await xtreamRequest(
      user,
      pass,
      'get_vod_streams'
    );

    return res.json(
      Array.isArray(data) ? data : []
    );

  } catch (error) {

    console.error('Erro filmes:', error);

    return res.status(500).json({
      error: 'Erro ao carregar filmes'
    });

  }

});


/* =========================
   SÉRIES
========================= */

app.get('/api/series', async (req, res) => {

  const { user, pass } = req.query;

  if (!user || !pass) {
    return res.status(400).json({
      error: 'Usuário e senha são obrigatórios'
    });
  }

  try {

    const data = await xtreamRequest(
      user,
      pass,
      'get_series'
    );

    return res.json(
      Array.isArray(data) ? data : []
    );

  } catch (error) {

    console.error('Erro séries:', error);

    return res.status(500).json({
      error: 'Erro ao carregar séries'
    });

  }

});


/* =========================
   SÉRIE
========================= */

app.get('/api/serie', async (req, res) => {

  const {
    user,
    pass,
    series_id
  } = req.query;

  if (!user || !pass || !series_id) {
    return res.status(400).json({
      error: 'Dados incompletos'
    });
  }

  try {

    const url =
      `${XTREAM_HOST}/player_api.php` +
      `?username=${encodeURIComponent(user)}` +
      `&password=${encodeURIComponent(pass)}` +
      `&action=get_series_info` +
      `&series_id=${encodeURIComponent(series_id)}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({
        error: 'Não foi possível consultar a série'
      });
    }

    const data = await response.json();

    return res.json(data);

  } catch (error) {

    console.error('Erro série:', error);

    return res.status(500).json({
      error: 'Erro ao carregar série'
    });

  }

});


/* =========================
   LIVROS / EBOOKS / AUDIOBOOKS
========================= */

app.get('/api/livros', (req, res) => {

  res.json({
    livros: [],
    ebooks: [],
    audiobooks: []
  });

});


/* =========================
   MÍDIA
========================= */

app.get('/api/media', async (req, res) => {

  const source = req.query.url;

  if (!source) {
    return res.status(400).json({
      error: 'URL não informada'
    });
  }

  try {

    const parsed = new URL(source);

    if (parsed.hostname !== 'u.l0.ms') {
      return res.status(403).json({
        error: 'Origem não autorizada'
      });
    }

    const response = await fetch(source);

    if (!response.ok) {
      return res.status(response.status).send(
        'Erro ao acessar conteúdo'
      );
    }

    const contentType =
      response.headers.get('content-type');

    if (contentType) {
      res.setHeader(
        'Content-Type',
        contentType
      );
    }

    res.setHeader(
      'Access-Control-Allow-Origin',
      '*'
    );

    res.setHeader(
      'Cache-Control',
      'no-cache'
    );

    response.body.pipe(res);

  } catch (error) {

    console.error('Erro mídia:', error);

    return res.status(500).json({
      error: 'Erro ao reproduzir conteúdo'
    });

  }

});

/* =========================
   BANCO DE DADOS MULTIPLAY
========================= */

async function criarTabelas() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('MultiPlay: tabelas verificadas com sucesso');
  } catch (error) {
    console.error(
      'MultiPlay: erro ao criar tabelas:',
      error.message
    );
  }
}

criarTabelas();
/* =========================
   STATUS
========================= */

app.get('/api/status', (req, res) => {

  res.json({

    app: 'MultiPlay Entretenimento',

    status: 'online',

    versao: '4.0.0',

    catalogo: [
      'canais',
      'filmes',
      'series',
      'livros',
      'ebooks',
      'audiobooks'
    ]

  });

});


/* =========================
   SERVIDOR
========================= */

app.listen(PORT, () => {

  console.log(
    `MultiPlay rodando na porta ${PORT}`
  );

});
