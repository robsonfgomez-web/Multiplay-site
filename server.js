const express = require('express');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const XTREAM_HOST = 'http://u.l0.ms';

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   BANCO
========================= */

pool.query('SELECT NOW()')
  .then(() => {
    console.log('MultiPlay: banco conectado com sucesso');
  })
  .catch((error) => {
    console.error(
      'MultiPlay: erro ao conectar ao banco:',
      error.message
    );
  });

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
   HASH DE SENHA
========================= */

function gerarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');

  const hash = crypto
    .scryptSync(senha, salt, 64)
    .toString('hex');

  return `${salt}:${hash}`;
}

function verificarSenha(senha, passwordHash) {
  if (!passwordHash || !passwordHash.includes(':')) {
    return false;
  }

  const partes = passwordHash.split(':');

  const salt = partes[0];
  const hashArmazenado = partes[1];

  const hashInformado = crypto
    .scryptSync(senha, salt, 64)
    .toString('hex');

  return hashInformado === hashArmazenado;
}

/* =========================
   LOGIN MULTIPLAY
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

    /* -------------------------
       PRIMEIRO: ADMIN
    ------------------------- */

    const adminResult = await pool.query(
      `SELECT id, username, password_hash, active
       FROM admins
       WHERE username = $1`,
      [username]
    );

    if (adminResult.rows.length > 0) {

      const admin = adminResult.rows[0];

      if (!admin.active) {
        return res.status(403).json({
          success: false,
          message: 'Usuário desativado.'
        });
      }

      if (!verificarSenha(password, admin.password_hash)) {
        return res.status(401).json({
          success: false,
          message: 'Usuário ou senha inválidos.'
        });
      }

      return res.json({
        success: true,
        message: 'Login realizado com sucesso.',
        user: {
          id: admin.id,
          username: admin.username,
          type: 'admin'
        }
      });
    }

    /* -------------------------
       SEGUNDO: CLIENTE
    ------------------------- */

    const userResult = await pool.query(
      `SELECT
        id,
        username,
        password_hash,
        active,
        expires_at,
        xtream_user,
        xtream_pass
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos.'
      });
    }

    const usuario = userResult.rows[0];

    if (!usuario.active) {
      return res.status(403).json({
        success: false,
        message: 'Usuário desativado.'
      });
    }

    if (
      usuario.expires_at &&
      new Date(usuario.expires_at) < new Date()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Acesso expirado.'
      });
    }

    if (!verificarSenha(password, usuario.password_hash)) {
      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos.'
      });
    }

    return res.json({
      success: true,
      message: 'Login realizado com sucesso.',
      user: {
        id: usuario.id,
        username: usuario.username,
        type: 'client'
      }
    });

  } catch (error) {

    console.error(
      'Erro no login MultiPlay:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao realizar login.'
    });
  }
});

/* =========================
   BUSCAR CREDENCIAIS XTREAM
========================= */

async function obterCredenciaisXtream(username) {

  const resultado = await pool.query(
    `SELECT
      id,
      username,
      active,
      expires_at,
      xtream_user,
      xtream_pass
     FROM users
     WHERE username = $1`,
    [username]
  );

  if (resultado.rows.length === 0) {
    throw new Error('Cliente não encontrado');
  }

  const usuario = resultado.rows[0];

  if (!usuario.active) {
    throw new Error('Cliente desativado');
  }

  if (
    usuario.expires_at &&
    new Date(usuario.expires_at) < new Date()
  ) {
    throw new Error('Acesso expirado');
  }

  if (!usuario.xtream_user || !usuario.xtream_pass) {
    throw new Error(
      'Credenciais de streaming não configuradas'
    );
  }

  return {
    user: usuario.xtream_user,
    pass: usuario.xtream_pass
  };
}

/* =========================
   CATÁLOGO
========================= */

app.get('/api/catalogo', async (req, res) => {

  const username =
    req.query.username ||
    req.query.user;

  if (!username) {
    return res.status(400).json({
      error: 'Usuário MultiPlay não informado'
    });
  }

  try {

    const credenciais =
      await obterCredenciaisXtream(username);

    const [canais, filmes, series] =
      await Promise.all([
        xtreamRequest(
          credenciais.user,
          credenciais.pass,
          'get_live_streams'
        ),

        xtreamRequest(
          credenciais.user,
          credenciais.pass,
          'get_vod_streams'
        ),

        xtreamRequest(
          credenciais.user,
          credenciais.pass,
          'get_series'
        )
      ]);

    return res.json({
      canais:
        Array.isArray(canais)
          ? canais
          : [],

      filmes:
        Array.isArray(filmes)
          ? filmes
          : [],

      series:
        Array.isArray(series)
          ? series
          : []
    });

  } catch (error) {

    console.error(
      'Erro catálogo:',
      error
    );

    return res.status(500).json({
      error: 'Não foi possível carregar o catálogo'
    });
  }
});

/* =========================
   CANAIS
========================= */

app.get('/api/canais', async (req, res) => {

  const username =
    req.query.username ||
    req.query.user;

  if (!username) {
    return res.status(400).json({
      error: 'Usuário não informado'
    });
  }

  try {

    const credenciais =
      await obterCredenciaisXtream(username);

    const data =
      await xtreamRequest(
        credenciais.user,
        credenciais.pass,
        'get_live_streams'
      );

    return res.json(
      Array.isArray(data)
        ? data
        : []
    );

  } catch (error) {

    console.error(
      'Erro canais:',
      error
    );

    return res.status(500).json({
      error: 'Erro ao carregar canais'
    });
  }
});

/* =========================
   FILMES
========================= */

app.get('/api/filmes', async (req, res) => {

  const username =
    req.query.username ||
    req.query.user;

  if (!username) {
    return res.status(400).json({
      error: 'Usuário não informado'
    });
  }

  try {

    const credenciais =
      await obterCredenciaisXtream(username);

    const data =
      await xtreamRequest(
        credenciais.user,
        credenciais.pass,
        'get_vod_streams'
      );

    return res.json(
      Array.isArray(data)
        ? data
        : []
    );

  } catch (error) {

    console.error(
      'Erro filmes:',
      error
    );

    return res.status(500).json({
      error: 'Erro ao carregar filmes'
    });
  }
});

/* =========================
   SÉRIES
========================= */

app.get('/api/series', async (req, res) => {

  const username =
    req.query.username ||
    req.query.user;

  if (!username) {
    return res.status(400).json({
      error: 'Usuário não informado'
    });
  }

  try {

    const credenciais =
      await obterCredenciaisXtream(username);

    const data =
      await xtreamRequest(
        credenciais.user,
        credenciais.pass,
        'get_series'
      );

    return res.json(
      Array.isArray(data)
        ? data
        : []
    );

  } catch (error) {

    console.error(
      'Erro séries:',
      error
    );

    return res.status(500).json({
      error: 'Erro ao carregar séries'
    });
  }
});

/* =========================
   DETALHES DA SÉRIE
========================= */

app.get('/api/serie', async (req, res) => {

  const username =
    req.query.username ||
    req.query.user;

  const series_id =
    req.query.series_id;

  if (!username || !series_id) {
    return res.status(400).json({
      error: 'Dados incompletos'
    });
  }

  try {

    const credenciais =
      await obterCredenciaisXtream(username);

    const url =
      `${XTREAM_HOST}/player_api.php` +
      `?username=${encodeURIComponent(credenciais.user)}` +
      `&password=${encodeURIComponent(credenciais.pass)}` +
      `&action=get_series_info` +
      `&series_id=${encodeURIComponent(series_id)}`;

    const response =
      await fetch(url);

    if (!response.ok) {
      return res.status(502).json({
        error:
          'Não foi possível consultar a série'
      });
    }

    const data =
      await response.json();

    return res.json(data);

  } catch (error) {

    console.error(
      'Erro série:',
      error
    );

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

    const parsed =
      new URL(source);

    if (
      parsed.hostname !== 'u.l0.ms'
    ) {
      return res.status(403).json({
        error: 'Origem não autorizada'
      });
    }

    const response =
      await fetch(source);

    if (!response.ok) {
      return res
        .status(response.status)
        .send(
          'Erro ao acessar conteúdo'
        );
    }

    const contentType =
      response.headers.get(
        'content-type'
      );

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

    console.error(
      'Erro mídia:',
      error
    );

    return res.status(500).json({
      error:
        'Erro ao reproduzir conteúdo'
    });
  }
});

/* =========================
   CRIAR TABELAS
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
        xtream_user VARCHAR(100),
        xtream_pass VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS xtream_user VARCHAR(100);

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS xtream_pass VARCHAR(255);
    `);

    console.log(
      'MultiPlay: tabelas verificadas com sucesso'
    );

  } catch (error) {

    console.error(
      'MultiPlay: erro ao criar tabelas:',
      error.message
    );
  }
}

criarTabelas();

/* =========================
   ADMINISTRADOR INICIAL
========================= */

async function criarAdminInicial() {

  const username =
    process.env.MULTIPLAY_ADMIN_USER;

  const password =
    process.env.MULTIPLAY_ADMIN_PASSWORD;

  if (!username || !password) {

    console.log(
      'MultiPlay: credenciais do administrador não configuradas.'
    );

    return;
  }

  try {

    const existente =
      await pool.query(
        'SELECT id FROM admins WHERE username = $1',
        [username]
      );

    if (existente.rows.length > 0) {

      console.log(
        'MultiPlay: administrador inicial já existe.'
      );

      return;
    }

    const passwordHash =
      gerarHashSenha(password);

    await pool.query(
      `INSERT INTO admins
       (username, password_hash)
       VALUES ($1, $2)`,
      [
        username,
        passwordHash
      ]
    );

    console.log(
      'MultiPlay: administrador inicial criado com sucesso.'
    );

  } catch (error) {

    console.error(
      'MultiPlay: erro ao criar administrador:',
      error.message
    );
  }
}

criarAdminInicial();

/* =========================
   STATUS
========================= */

app.get('/api/status', (req, res) => {

  res.json({

    app:
      'MultiPlay Entretenimento',

    status:
      'online',

    versao:
      '5.0.0',

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
