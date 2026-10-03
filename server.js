const express = require('express');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const multer = require('multer');
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

/* =========================
   CONFIGURAÇÃO
========================= */

const SESSION_SECRET = crypto
  .createHash('sha256')
  .update(
    process.env.DATABASE_URL ||
    'multiplay-session-secret'
  )
  .digest('hex');

const ADMIN_SESSION_MAX_AGE =
  8 * 60 * 60 * 1000;

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   BANCO
========================= */

pool.query('SELECT NOW()')
  .then(() => {
    console.log(
      'MultiPlay: banco conectado com sucesso'
    );
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
  res.sendFile(
    path.join(__dirname, 'index.html')
  );
});

app.get('/index.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'index.html')
  );
});

app.get('/login.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'login.html')
  );
});

app.get('/app.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'app.html')
  );
});

app.get('/admin.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'admin.html')
  );
});

app.get('/player.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'player.html')
  );
});

app.get('/assinatura.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'assinatura.html'));
});

/* =========================
   XTREAM
========================= */

async function xtreamRequest(
  user,
  pass,
  action
) {
  let url =
    `${XTREAM_HOST}/player_api.php` +
    `?username=${encodeURIComponent(user)}` +
    `&password=${encodeURIComponent(pass)}`;

  if (action) {
    url +=
      `&action=${encodeURIComponent(action)}`;
  }

  console.log(
    `MultiPlay: consultando Xtream - ${action}`
  );

  const response = await fetch(url, {
    timeout: 20000
  });

  if (!response.ok) {
    throw new Error(
      `Servidor de conteúdo indisponível (HTTP ${response.status})`
    );
  }

  return await response.json();
}

/* =========================
   HASH DE SENHA
========================= */

function gerarHashSenha(senha) {
  const salt =
    crypto.randomBytes(16).toString('hex');

  const hash =
    crypto
      .scryptSync(senha, salt, 64)
      .toString('hex');

  return `${salt}:${hash}`;
}

function verificarSenha(
  senha,
  passwordHash
) {
  if (
    !passwordHash ||
    !passwordHash.includes(':')
  ) {
    return false;
  }

  const partes =
    passwordHash.split(':');

  const salt = partes[0];
  const hashArmazenado = partes[1];

  const hashInformado =
    crypto
      .scryptSync(senha, salt, 64)
      .toString('hex');

  return hashInformado === hashArmazenado;
}

/* =========================
   SESSÃO ADMIN
========================= */

function criarTokenAdmin(admin) {
  const payload = {
    id: admin.id,
    username: admin.username,
    type: 'admin',
    exp:
      Date.now() +
      ADMIN_SESSION_MAX_AGE
  };

  const texto =
    Buffer
      .from(JSON.stringify(payload))
      .toString('base64url');

  const assinatura =
    crypto
      .createHmac(
        'sha256',
        SESSION_SECRET
      )
      .update(texto)
      .digest('base64url');

  return `${texto}.${assinatura}`;
}

function verificarTokenAdmin(token) {
  if (!token) {
    return null;
  }

  const partes =
    token.split('.');

  if (partes.length !== 2) {
    return null;
  }

  const texto = partes[0];
  const assinatura = partes[1];

  const assinaturaEsperada =
    crypto
      .createHmac(
        'sha256',
        SESSION_SECRET
      )
      .update(texto)
      .digest('base64url');

  if (
    assinatura.length !==
    assinaturaEsperada.length
  ) {
    return null;
  }

  if (
    !crypto.timingSafeEqual(
      Buffer.from(assinatura),
      Buffer.from(assinaturaEsperada)
    )
  ) {
    return null;
  }

  try {
    const payload =
      JSON.parse(
        Buffer
          .from(texto, 'base64url')
          .toString('utf8')
      );

    if (
      !payload.exp ||
      Date.now() > payload.exp
    ) {
      return null;
    }

    if (payload.type !== 'admin') {
      return null;
    }

    return payload;

  } catch (error) {
    return null;
  }
}

function obterCookie(req, nome) {
  const cookies =
    req.headers.cookie;

  if (!cookies) {
    return null;
  }

  const partes =
    cookies.split(';');

  for (const parte of partes) {
    const [chave, ...valor] =
      parte.trim().split('=');

    if (chave === nome) {
      return decodeURIComponent(
        valor.join('=')
      );
    }
  }

  return null;
}

function exigirAdmin(req, res, next) {
  const token =
    obterCookie(
      req,
      'mp_admin_session'
    );

  const admin =
    verificarTokenAdmin(token);

  if (!admin) {
    return res.status(401).json({
      success: false,
      message:
        'Acesso administrativo não autorizado.'
    });
  }

  req.admin = admin;

  next();
}

/* =========================
   LOGIN MULTIPLAY
========================= */

app.post(
  '/api/login',
  async (req, res) => {

    const {
      username,
      password
    } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message:
          'Usuário e senha são obrigatórios.'
      });
    }

    try {

      /* =====================
         ADMIN
      ===================== */

      const adminResult =
        await pool.query(
          `SELECT
            id,
            username,
            password_hash,
            active
           FROM admins
           WHERE username = $1`,
          [username]
        );

      if (
        adminResult.rows.length > 0
      ) {

        const admin =
          adminResult.rows[0];

        if (!admin.active) {
          return res.status(403).json({
            success: false,
            message:
              'Usuário administrador desativado.'
          });
        }

        if (
          !verificarSenha(
            password,
            admin.password_hash
          )
        ) {
          return res.status(401).json({
            success: false,
            message:
              'Usuário ou senha inválidos.'
          });
        }

        const token =
          criarTokenAdmin(admin);

        res.setHeader(
          'Set-Cookie',
          [
            `mp_admin_session=${encodeURIComponent(token)}`,
            'HttpOnly',
            'Secure',
            'SameSite=Lax',
            'Path=/',
            `Max-Age=${Math.floor(
              ADMIN_SESSION_MAX_AGE / 1000
            )}`
          ].join('; ')
        );

        return res.json({
          success: true,
          message:
            'Login administrativo realizado.',
          user: {
            id: admin.id,
            username: admin.username,
            type: 'admin'
          }
        });
      }

      /* =====================
         CLIENTE
      ===================== */

      const userResult =
        await pool.query(
          `SELECT
            id,
            username,
            password_hash,
            active,
            expires_at
           FROM users
           WHERE username = $1`,
          [username]
        );

      if (
        userResult.rows.length === 0
      ) {
        return res.status(401).json({
          success: false,
          message:
            'Usuário ou senha inválidos.'
        });
      }

      const usuario =
        userResult.rows[0];

      if (!usuario.active) {
        return res.status(403).json({
          success: false,
          message:
            'Usuário desativado.'
        });
      }

      if (usuario.expires_at) {

        const vencimento =
          new Date(
            usuario.expires_at
          );

        vencimento.setHours(
          23,
          59,
          59,
          999
        );

        if (
          vencimento < new Date()
        ) {
          return res.status(403).json({
            success: false,
            message:
              'Acesso expirado.'
          });
        }
      }

      if (
        !verificarSenha(
          password,
          usuario.password_hash
        )
      ) {
        return res.status(401).json({
          success: false,
          message:
            'Usuário ou senha inválidos.'
        });
      }

      return res.json({
        success: true,
        message:
          'Login realizado com sucesso.',
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
        message:
          'Erro interno ao realizar login.'
      });
    }
  }
);

/* =========================
   LOGOUT ADMIN
========================= */

app.post(
  '/api/admin/logout',
  (req, res) => {

    res.setHeader(
      'Set-Cookie',
      [
        'mp_admin_session=',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Path=/',
        'Max-Age=0'
      ].join('; ')
    );

    res.json({
      success: true
    });
  }
);

/* =========================
   ADMIN - ME
========================= */

app.get(
  '/api/admin/me',
  exigirAdmin,
  (req, res) => {

    res.json({
      success: true,
      admin: req.admin
    });
  }
);

/* =========================
   ADMIN - LISTAR CLIENTES
========================= */

app.get(
  '/api/admin/users',
  exigirAdmin,
  async (req, res) => {

    try {

      const resultado =
        await pool.query(
          `SELECT
            id,
            username,
            active,
            expires_at,
            xtream_user,
            created_at
           FROM users
           ORDER BY id DESC`
        );

      return res.json({
        success: true,
        users:
          resultado.rows
      });

    } catch (error) {

      console.error(
        'Erro ao listar clientes:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao listar clientes.'
      });
    }
  }
);

/* =========================
   ADMIN - CRIAR CLIENTE
========================= */

app.post(
  '/api/admin/users',
  exigirAdmin,
  async (req, res) => {

    const {
      username,
      password,
      xtream_user,
      xtream_pass,
      expires_at
    } = req.body || {};

    if (
      !username ||
      !password ||
      !xtream_user ||
      !xtream_pass
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Usuário, senha e credenciais de streaming são obrigatórios.'
      });
    }

    try {

      const existente =
        await pool.query(
          `SELECT id
           FROM users
           WHERE username = $1`,
          [username]
        );

      if (
        existente.rows.length > 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            'Esse usuário MultiPlay já existe.'
        });
      }

      const passwordHash =
        gerarHashSenha(password);

      const resultado =
        await pool.query(
          `INSERT INTO users
           (
             username,
             password_hash,
             active,
             expires_at,
             xtream_user,
             xtream_pass
           )
           VALUES
           ($1, $2, TRUE, $3, $4, $5)
           RETURNING
             id,
             username,
             active,
             expires_at,
             xtream_user,
             created_at`,
          [
            username,
            passwordHash,
            expires_at || null,
            xtream_user,
            xtream_pass
          ]
        );

      return res.status(201).json({
        success: true,
        message:
          'Cliente criado com sucesso.',
        user:
          resultado.rows[0]
      });

    } catch (error) {

      console.error(
        'Erro ao criar cliente:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao criar cliente.'
      });
    }
  }
);

/* =========================
   ADMIN - ALTERAR CLIENTE
========================= */

app.patch(
  '/api/admin/users/:id',
  exigirAdmin,
  async (req, res) => {

    const id =
      Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        success: false,
        message:
          'ID de cliente inválido.'
      });
    }

    const {
      username,
      password,
      active,
      expires_at,
      xtream_user,
      xtream_pass
    } = req.body || {};

    try {

      const atual =
        await pool.query(
          `SELECT *
           FROM users
           WHERE id = $1`,
          [id]
        );

      if (
        atual.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Cliente não encontrado.'
        });
      }

      const usuario =
        atual.rows[0];

      const novoUsername =
        username !== undefined
          ? username
          : usuario.username;

      const novaSenhaHash =
        password
          ? gerarHashSenha(password)
          : usuario.password_hash;

      const novoActive =
        active !== undefined
          ? Boolean(active)
          : usuario.active;

      const novaExpiracao =
        expires_at !== undefined
          ? expires_at
          : usuario.expires_at;

      const novoXtreamUser =
        xtream_user !== undefined
          ? xtream_user
          : usuario.xtream_user;

      const novoXtreamPass =
        xtream_pass !== undefined
          ? xtream_pass
          : usuario.xtream_pass;

      const duplicado =
        await pool.query(
          `SELECT id
           FROM users
           WHERE username = $1
           AND id <> $2`,
          [
            novoUsername,
            id
          ]
        );

      if (
        duplicado.rows.length > 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            'Esse usuário MultiPlay já está em uso.'
        });
      }

      const resultado =
        await pool.query(
          `UPDATE users
           SET
             username = $1,
             password_hash = $2,
             active = $3,
             expires_at = $4,
             xtream_user = $5,
             xtream_pass = $6
           WHERE id = $7
           RETURNING
             id,
             username,
             active,
             expires_at,
             xtream_user,
             created_at`,
          [
            novoUsername,
            novaSenhaHash,
            novoActive,
            novaExpiracao || null,
            novoXtreamUser,
            novoXtreamPass,
            id
          ]
        );

      return res.json({
        success: true,
        message:
          'Cliente atualizado com sucesso.',
        user:
          resultado.rows[0]
      });

    } catch (error) {

      console.error(
        'Erro ao atualizar cliente:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao atualizar cliente.'
      });
    }
  }
);

/* =========================
   ADMIN - EXCLUIR CLIENTE
========================= */

app.delete(
  '/api/admin/users/:id',
  exigirAdmin,
  async (req, res) => {

    const id =
      Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        success: false,
        message:
          'ID de cliente inválido.'
      });
    }

    try {

      const resultado =
        await pool.query(
          `DELETE FROM users
           WHERE id = $1
           RETURNING id, username`,
          [id]
        );

      if (
        resultado.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Cliente não encontrado.'
        });
      }

      return res.json({
        success: true,
        message:
          'Cliente excluído com sucesso.'
      });

    } catch (error) {

      console.error(
        'Erro ao excluir cliente:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao excluir cliente.'
      });
    }
  }
);

/* =========================
   BUSCAR CREDENCIAIS XTREAM
========================= */

async function obterCredenciaisXtream(
  username
) {

  const resultado =
    await pool.query(
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

  if (
    resultado.rows.length === 0
  ) {
    throw new Error(
      'Cliente não encontrado'
    );
  }

  const usuario =
    resultado.rows[0];

  if (!usuario.active) {
    throw new Error(
      'Cliente desativado'
    );
  }

  if (usuario.expires_at) {

    const vencimento =
      new Date(
        usuario.expires_at
      );

    vencimento.setHours(
      23,
      59,
      59,
      999
    );

    if (
      vencimento < new Date()
    ) {
      throw new Error(
        'Acesso expirado'
      );
    }
  }

  if (
    !usuario.xtream_user ||
    !usuario.xtream_pass
  ) {
    throw new Error(
      'Credenciais de streaming não configuradas'
    );
  }

  return {
    user:
      usuario.xtream_user,
    pass:
      usuario.xtream_pass
  };
}

/* =========================
   CATÁLOGO
========================= */

app.get(
  '/api/catalogo',
  async (req, res) => {

    const username =
      req.query.username ||
      req.query.user;

    if (!username) {
      return res.status(400).json({
        error:
          'Usuário MultiPlay não informado'
      });
    }

    try {

      const credenciais =
        await obterCredenciaisXtream(
          username
        );

      /* =====================
         DIAGNÓSTICO
         Não mostra usuário ou senha
      ===================== */

      const diagnostico = {
        cliente: 'OK',
        credenciais: 'OK',
        canais: {
          status: 'testando'
        },
        filmes: {
          status: 'testando'
        },
        series: {
          status: 'testando'
        }
      };

      const resultados =
        await Promise.allSettled([

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

      const nomes = [
        'canais',
        'filmes',
        'series'
      ];

      const dados = {
        canais: [],
        filmes: [],
        series: []
      };

      resultados.forEach(
        (resultado, index) => {

          const nome =
            nomes[index];

          if (
            resultado.status ===
            'fulfilled'
          ) {

            const valor =
              Array.isArray(
                resultado.value
              )
                ? resultado.value
                : [];

            dados[nome] =
              valor;

            diagnostico[nome] = {
              status: 'OK',
              quantidade:
                valor.length
            };

          } else {

            diagnostico[nome] = {
              status: 'ERRO',
              mensagem:
                resultado.reason &&
                resultado.reason.message
                  ? resultado.reason.message
                  : 'Erro desconhecido'
            };

            console.error(
              `Erro catálogo ${nome}:`,
              resultado.reason
            );
          }

        }
      );

      return res.json({

        ...dados,

        diagnostico

      });

    } catch (error) {

      console.error(
        'Erro catálogo geral:',
        error
      );

      return res.status(500).json({

        error:
          'Não foi possível carregar o catálogo',

        diagnostico: {
          cliente: 'ERRO',
          mensagem:
            error.message ||
            'Erro desconhecido'
        }

      });

    }
  }
);

/* =========================
   CANAIS
========================= */

app.get(
  '/api/canais',
  async (req, res) => {

    const username =
      req.query.username ||
      req.query.user;

    if (!username) {
      return res.status(400).json({
        error:
          'Usuário não informado'
      });
    }

    try {

      const credenciais =
        await obterCredenciaisXtream(
          username
        );

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
        error:
          'Erro ao carregar canais'
      });
    }
  }
);

/* =========================
   FILMES
========================= */

app.get(
  '/api/filmes',
  async (req, res) => {

    const username =
      req.query.username ||
      req.query.user;

    if (!username) {
      return res.status(400).json({
        error:
          'Usuário não informado'
      });
    }

    try {

      const credenciais =
        await obterCredenciaisXtream(
          username
        );

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
        error:
          'Erro ao carregar filmes'
      });
    }
  }
);

/* =========================
   SÉRIES
========================= */

app.get(
  '/api/series',
  async (req, res) => {

    const username =
      req.query.username ||
      req.query.user;

    if (!username) {
      return res.status(400).json({
        error:
          'Usuário não informado'
      });
    }

    try {

      const credenciais =
        await obterCredenciaisXtream(
          username
        );

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
        error:
          'Erro ao carregar séries'
      });
    }
  }
);

/* =========================
   DETALHES DA SÉRIE
========================= */

app.get(
  '/api/serie',
  async (req, res) => {

    const username =
      req.query.username ||
      req.query.user;

    const series_id =
      req.query.series_id;

    if (
      !username ||
      !series_id
    ) {
      return res.status(400).json({
        error:
          'Dados incompletos'
      });
    }

    try {

      const credenciais =
        await obterCredenciaisXtream(
          username
        );

      const url =
        `${XTREAM_HOST}/player_api.php` +
        `?username=${encodeURIComponent(
          credenciais.user
        )}` +
        `&password=${encodeURIComponent(
          credenciais.pass
        )}` +
        `&action=get_series_info` +
        `&series_id=${encodeURIComponent(
          series_id
        )}`;

      const response =
        await fetch(
          url,
          {
            timeout: 20000
          }
        );

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
        error:
          'Erro ao carregar série'
      });
    }
  }
);

/* =========================
   LIVROS / EBOOKS / AUDIOBOOKS
========================= */

app.get(
  '/api/livros',
  (req, res) => {
    // Catálogo inicial com obras em domínio público e fontes abertas.
    // Para conteúdo comercial, use somente arquivos/licenças autorizados pelo responsável.
    res.json({
      livros: [
        {
          titulo: 'Dom Casmurro',
          autor: 'Machado de Assis',
          descricao: 'Clássico da literatura brasileira em domínio público.',
          url: 'https://www.gutenberg.org/ebooks/search/?query=dom+casmurro',
          tipo: 'livro'
        },
        {
          titulo: 'Memórias Póstumas de Brás Cubas',
          autor: 'Machado de Assis',
          descricao: 'Romance clássico brasileiro em domínio público.',
          url: 'https://www.gutenberg.org/ebooks/search/?query=memorias+postumas+bras+cubas',
          tipo: 'livro'
        }
      ],
      ebooks: [
        {
          titulo: 'A Biblioteca Digital do Project Gutenberg',
          autor: 'Project Gutenberg',
          descricao: 'Milhares de e-books gratuitos de obras em domínio público.',
          url: 'https://www.gutenberg.org/',
          tipo: 'ebook'
        },
        {
          titulo: 'Busca de e-books em português',
          autor: 'Project Gutenberg',
          descricao: 'Pesquisa por livros disponíveis legalmente no acervo.',
          url: 'https://www.gutenberg.org/ebooks/search/?query=portuguese',
          tipo: 'ebook'
        }
      ],
      audiobooks: [
        {
          titulo: 'Audiobooks gratuitos em domínio público',
          autor: 'LibriVox',
          descricao: 'Catálogo de audiolivros de obras em domínio público.',
          url: 'https://librivox.org/search?primary_key=0&search_category=language&search_page=1&search_form=get_results',
          tipo: 'audiobook'
        }
      ]
    });
  }
);

/* =========================
   PROXY DE IMAGENS
========================= */

app.get(
  '/api/imagem',
  async (req, res) => {

    const imagem =
      req.query.url;

    if (!imagem) {
      return res.status(400).send(
        'Imagem não informada'
      );
    }

    try {

      const parsed =
        new URL(imagem);

      if (
        parsed.protocol !== 'http:' &&
        parsed.protocol !== 'https:'
      ) {
        return res.status(400).end();
      }

      const response =
        await fetch(
          parsed.toString(),
          {
            timeout: 15000
          }
        );

      if (!response.ok) {
        return res.status(
          response.status
        ).end();
      }

      const contentType =
        response.headers.get(
          'content-type'
        ) || '';

      if (
        !contentType.startsWith(
          'image/'
        )
      ) {
        return res.status(415).end();
      }

      res.setHeader(
        'Content-Type',
        contentType
      );

      res.setHeader(
        'Cache-Control',
        'public, max-age=86400'
      );

      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      );

      if (response.body) {

        response.body.pipe(res);

      } else {

        const buffer =
          await response.buffer();

        res.send(buffer);
      }

    } catch (error) {

      console.error(
        'Erro imagem:',
        error.message
      );

      return res.status(500).end();
    }

  }
);

/* =========================
   MÍDIA / PLAYER
========================= */

app.get(
  '/api/media',
  async (req, res) => {

    const username =
      req.query.user ||
      req.query.username;

    const streamId =
      req.query.stream_id;

    const type =
      req.query.type ||
      'filme';

    const resource =
      req.query.resource;

    const extensionRaw =
      req.query.extension;

    if (
      !username ||
      !streamId
    ) {

      return res.status(400).json({
        error:
          'Dados do conteúdo não informados'
      });

    }

    try {

      const credenciais =
        await obterCredenciaisXtream(
          username
        );

      let source;

      if (resource) {

        source =
          decodeURIComponent(
            resource
          );

      } else {

        const extensoesPermitidas = [
          'mp4',
          'mkv',
          'avi',
          'mov',
          'webm',
          'flv',
          'ts',
          'm3u8'
        ];

        let extension =
          String(
            extensionRaw || ''
          )
            .trim()
            .toLowerCase()
            .replace(/^\./, '');

        if (
          !extensoesPermitidas.includes(
            extension
          )
        ) {
          extension = 'mp4';
        }

        if (
          type === 'canal'
        ) {

          source =
            `${XTREAM_HOST}/live/` +
            `${encodeURIComponent(
              credenciais.user
            )}/` +
            `${encodeURIComponent(
              credenciais.pass
            )}/` +
            `${encodeURIComponent(
              streamId
            )}.m3u8`;

        }

        else if (
          type === 'filme'
        ) {

          source =
            `${XTREAM_HOST}/movie/` +
            `${encodeURIComponent(
              credenciais.user
            )}/` +
            `${encodeURIComponent(
              credenciais.pass
            )}/` +
            `${encodeURIComponent(
              streamId
            )}.${extension}`;

        }

        else if (
          type === 'serie'
        ) {

          source =
            `${XTREAM_HOST}/series/` +
            `${encodeURIComponent(
              credenciais.user
            )}/` +
            `${encodeURIComponent(
              credenciais.pass
            )}/` +
            `${encodeURIComponent(
              streamId
            )}.${extension}`;

        }

        else {

          return res.status(400).json({
            error:
              'Tipo de conteúdo não suportado'
          });

        }

      }

      const parsed =
        new URL(source);

      if (
        parsed.hostname !==
        'u.l0.ms'
      ) {

        return res.status(403).json({
          error:
            'Origem não autorizada'
        });

      }

      const headers = {};

      if (req.headers.range) {
        headers.Range =
          req.headers.range;
      }

      const response =
        await fetch(
          source,
          {
            headers,
            timeout: 20000
          }
        );

      if (!response.ok) {

        return res
          .status(response.status)
          .send(
            'Não foi possível acessar o conteúdo'
          );

      }

      const headersToCopy = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'etag',
        'last-modified'
      ];

      headersToCopy.forEach(
        header => {

          const value =
            response.headers.get(
              header
            );

          if (value) {

            res.setHeader(
              header,
              value
            );

          }

        }
      );

      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      );

      res.setHeader(
        'Cache-Control',
        'no-cache'
      );

      const contentType =
        response.headers.get(
          'content-type'
        ) || '';

      const isHls =
        contentType.includes(
          'mpegurl'
        ) ||
        contentType.includes(
          'm3u8'
        ) ||
        source.includes(
          '.m3u8'
        );

      if (isHls) {

        const playlist =
          await response.text();

        const baseUrl =
          new URL(
            source
          );

        const rewritten =
          playlist
            .split('\n')
            .map(
              line => {

                const trimmed =
                  line.trim();

                if (
                  trimmed &&
                  !trimmed.startsWith('#')
                ) {

                  try {

                    const segmentUrl =
                      new URL(
                        trimmed,
                        baseUrl
                      ).toString();

                    return (
                      `/api/media?` +
                      `user=${encodeURIComponent(
                        username
                      )}` +
                      `&stream_id=${encodeURIComponent(
                        streamId
                      )}` +
                      `&type=${encodeURIComponent(
                        type
                      )}` +
                      `&resource=${encodeURIComponent(
                        segmentUrl
                      )}`
                    );

                  } catch {

                    return line;

                  }

                }

                if (
                  trimmed.includes(
                    'URI="'
                  )
                ) {

                  return trimmed.replace(
                    /URI="([^"]+)"/g,
                    (
                      match,
                      uri
                    ) => {

                      try {

                        const resourceUrl =
                          new URL(
                            uri,
                            baseUrl
                          ).toString();

                        const proxyUrl =
                          `/api/media?` +
                          `user=${encodeURIComponent(
                            username
                          )}` +
                          `&stream_id=${encodeURIComponent(
                            streamId
                          )}` +
                          `&type=${encodeURIComponent(
                            type
                          )}` +
                          `&resource=${encodeURIComponent(
                            resourceUrl
                          )}`;

                        return `URI="${proxyUrl}"`;

                      } catch {

                        return match;

                      }

                    }
                  );

                }

                return line;

              }
            )
            .join('\n');

        res.setHeader(
          'Content-Type',
          'application/vnd.apple.mpegurl'
        );

        return res.send(
          rewritten
        );

      }

      if (
        response.status === 206
      ) {

        res.status(206);

      }

      if (
        response.body
      ) {

        response.body.pipe(
          res
        );

      } else {

        const buffer =
          await response.buffer();

        res.send(
          buffer
        );

      }

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

  }
);

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

      CREATE TABLE IF NOT EXISTS multiplay_devices ( device_id VARCHAR(128) PRIMARY KEY, device_key VARCHAR(128) NOT NULL, customer_username VARCHAR(100), active BOOLEAN DEFAULT TRUE, expires_at TIMESTAMP NULL, trial_started_at TIMESTAMP NULL, trial_expires_at TIMESTAMP NULL, activation_expires_at TIMESTAMP NULL, activated_at TIMESTAMP NULL, playlist_name VARCHAR(200), playlist_url TEXT, epg_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );
      ALTER TABLE multiplay_devices ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP NULL;
      ALTER TABLE multiplay_devices ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP NULL;
      ALTER TABLE multiplay_devices ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMP NULL;
      ALTER TABLE multiplay_devices ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP NULL;

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
        `SELECT id
         FROM admins
         WHERE username = $1`,
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
   MINHA ASSINATURA
========================= */
app.get('/api/minha-assinatura', async (req,res)=>{
 const username=String(req.query.username||'').trim(); if(!username)return res.status(400).json({message:'Usuário não informado.'});
 try{const r=await pool.query('SELECT username, active, created_at, expires_at FROM users WHERE username=$1',[username]);if(!r.rows.length)return res.status(404).json({message:'Cliente não encontrado.'});const u=r.rows[0];let days=null,expired=false;if(u.expires_at){const end=new Date(u.expires_at);end.setHours(23,59,59,999);days=Math.max(0,Math.ceil((end.getTime()-Date.now())/86400000));expired=end<new Date();}res.json({username:u.username,plan:'Multiplay Completo',active:!!u.active,created_at:u.created_at,expires_at:u.expires_at,days_remaining:days,expired});}catch(e){console.error('Erro assinatura:',e.message);res.status(500).json({message:'Não foi possível carregar a assinatura.'});}
});

/* =========================
   STATUS
========================= */

app.get(
  '/api/status',
  (req, res) => {

    res.json({

      app:
        'MultiPlay Entretenimento',

      status:
        'online',

      versao:
        '7.0.0',

      catalogo: [
        'canais',
        'filmes',
        'series'
      ]

    });
  }
);

/* =========================
   MULTIPLAY 2.0 - DISPOSITIVOS
========================= */

async function garantirTabelaDispositivos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS multiplay_devices (
      device_id VARCHAR(128) PRIMARY KEY,
      device_key VARCHAR(128) NOT NULL,
      customer_username VARCHAR(100),
      active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMP NULL,
      trial_started_at TIMESTAMP NULL,
      trial_expires_at TIMESTAMP NULL,
      activation_expires_at TIMESTAMP NULL,
      activated_at TIMESTAMP NULL,
      playlist_name VARCHAR(200),
      playlist_url TEXT,
      epg_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE multiplay_devices ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP NULL;
    ALTER TABLE multiplay_devices ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP NULL;
    ALTER TABLE multiplay_devices ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMP NULL;
    ALTER TABLE multiplay_devices ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP NULL;
  `);
}

garantirTabelaDispositivos().catch(e => console.error('MultiPlay devices:', e.message));

function estadoDispositivo(d) {
  const agora = new Date();
  if (!d.active) return { status:'INATIVO', active:false, expired:false, days_remaining:0, effective_expires_at:d.expires_at||null };
  const trialEnd = d.trial_expires_at ? new Date(d.trial_expires_at) : null;
  const paidEnd = d.activation_expires_at ? new Date(d.activation_expires_at) : null;
  const effective = paidEnd && paidEnd > agora ? paidEnd : trialEnd;
  const expired = !effective || effective < agora;
  const paid = !!(paidEnd && paidEnd >= agora);
  const status = expired ? 'EXPIRADO' : (paid ? 'ATIVO' : 'TESTE');
  const days = effective ? Math.max(0, Math.ceil((effective.getTime()-agora.getTime())/86400000)) : 0;
  return { status, active:!expired, expired, paid, days_remaining:days, effective_expires_at:effective };
}

app.get('/api/device/status', async (req,res)=>{
  const {device_id,device_key}=req.query||{};
  if(!device_id||!device_key) return res.status(400).json({success:false,message:'Device ID e Device Key são obrigatórios.'});
  try{
    const q=await pool.query('SELECT * FROM multiplay_devices WHERE device_id=$1 AND device_key=$2',[device_id,device_key]);
    if(!q.rows.length) return res.json({success:true,registered:false});
    const d=q.rows[0], st=estadoDispositivo(d);
    return res.json({
      success:true, registered:true, active:st.active, status:st.status,
      trial_expires_at:d.trial_expires_at, activation_expires_at:d.activation_expires_at,
      expires_at:st.effective_expires_at, days_remaining:st.days_remaining,
      playlist_name:d.playlist_name||null, has_playlist:!!d.playlist_url,
      requires_activation:st.status==='TESTE' && st.days_remaining<=0
    });
  }catch(e){return res.status(500).json({success:false,message:'Erro ao consultar dispositivo.'});}
});

app.post('/api/device/register', async (req,res)=>{
  const {device_id,device_key,customer_username}=req.body||{};
  if(!device_id||!device_key) return res.status(400).json({success:false,message:'Device ID e Device Key são obrigatórios.'});
  try{
    const exists=await pool.query('SELECT device_id FROM multiplay_devices WHERE device_id=$1',[device_id]);
    if(exists.rows.length) return res.json({success:true,message:'Dispositivo já registrado.'});
    const trialStart=new Date();
    const trialEnd=new Date(trialStart.getTime()+7*86400000);
    await pool.query(`INSERT INTO multiplay_devices(device_id,device_key,customer_username,active,expires_at,trial_started_at,trial_expires_at)
      VALUES($1,$2,$3,TRUE,$4,$5,$4)`,
      [device_id,device_key,customer_username||null,trialEnd,trialStart]);
    return res.json({success:true,message:'Dispositivo registrado com teste de 7 dias.',trial_expires_at:trialEnd});
  }catch(e){return res.status(500).json({success:false,message:'Erro ao registrar dispositivo.'});}
});

app.get('/api/device/manage/status', async (req,res)=>{
  const {device_id,device_key}=req.query||{};
  if(!device_id||!device_key) return res.status(400).json({success:false,message:'Device ID e Device Key são obrigatórios.'});
  try{
    const q=await pool.query('SELECT device_id,customer_username,active,expires_at,trial_started_at,trial_expires_at,activation_expires_at,activated_at,playlist_name,playlist_url,epg_url FROM multiplay_devices WHERE device_id=$1 AND device_key=$2',[device_id,device_key]);
    if(!q.rows.length){
      const trialStart=new Date();
      const trialEnd=new Date(trialStart.getTime()+7*86400000);
      await pool.query('INSERT INTO multiplay_devices(device_id,device_key,active,expires_at,trial_started_at,trial_expires_at) VALUES($1,$2,TRUE,$3,$4,$3)',[device_id,device_key,trialEnd,trialStart]);
      return res.json({success:true,registered:true,created:true,active:true,status:'TESTE',trial_started_at:trialStart,trial_expires_at:trialEnd,expires_at:trialEnd,days_remaining:7,requires_activation:false,playlist_name:null,playlist_url:null,epg_url:null});
    }
    const d=q.rows[0], st=estadoDispositivo(d);
    return res.json({
      success:true, registered:true, active:st.active, status:st.status,
      trial_started_at:d.trial_started_at, trial_expires_at:d.trial_expires_at,
      activation_expires_at:d.activation_expires_at, expires_at:st.effective_expires_at,
      days_remaining:st.days_remaining, requires_activation:st.status==='EXPIRADO',
      playlist_name:d.playlist_name||null, playlist_url:d.playlist_url||null,
      epg_url:d.epg_url||null, customer_username:d.customer_username||null
    });
  }catch(e){return res.status(500).json({success:false,message:'Erro ao consultar dispositivo.'});}
});

app.post('/api/device/manage', async (req,res)=>{
  const {device_id,device_key,playlist_name,playlist_url,epg_url}=req.body||{};
  if(!device_id||!device_key||!playlist_url) return res.status(400).json({success:false,message:'Device ID, Device Key e URL M3U são obrigatórios.'});
  if(!/^https?:\/\//i.test(playlist_url)) return res.status(400).json({success:false,message:'A M3U precisa ser uma URL HTTP/HTTPS.'});
  try{
    const current=await pool.query('SELECT * FROM multiplay_devices WHERE device_id=$1 AND device_key=$2',[device_id,device_key]);
    if(!current.rows.length) return res.status(404).json({success:false,message:'Dispositivo não cadastrado.'});
    const d=current.rows[0], st=estadoDispositivo(d);
    if(!d.active) return res.status(403).json({success:false,message:'Dispositivo desativado.'});
    if(st.status==='EXPIRADO') return res.status(403).json({success:false,message:'Teste encerrado. Faça a ativação anual para continuar.'});
    const duplicada=await pool.query('SELECT device_id FROM multiplay_devices WHERE playlist_url=$1 AND device_id<>$2 LIMIT 1',[playlist_url,device_id]);
    if(duplicada.rows.length) return res.status(409).json({success:false,message:'Esta M3U já está vinculada a outro cliente. Cada cliente deve usar uma M3U exclusiva.'});
    await pool.query('UPDATE multiplay_devices SET playlist_name=$1,playlist_url=$2,epg_url=$3,updated_at=NOW() WHERE device_id=$4 AND device_key=$5',[playlist_name||'Multiplay',playlist_url,epg_url||null,device_id,device_key]);
    return res.json({success:true,message:'Playlist exclusiva salva com sucesso.',status:st.status,days_remaining:st.days_remaining});
  }catch(e){return res.status(500).json({success:false,message:'Erro ao salvar playlist.'});}
});

app.post('/api/admin/devices/:deviceId/activate', exigirAdmin, async (req,res)=>{
  const deviceId=req.params.deviceId;
  const years=Math.max(1,Math.min(3,Number(req.body?.years)||1));
  try{
    const q=await pool.query('SELECT * FROM multiplay_devices WHERE device_id=$1',[deviceId]);
    if(!q.rows.length) return res.status(404).json({success:false,message:'Dispositivo não encontrado.'});
    const d=q.rows[0];
    const now=new Date();
    const base=d.activation_expires_at && new Date(d.activation_expires_at)>now ? new Date(d.activation_expires_at) : now;
    const paidUntil=new Date(base.getTime()+years*365*86400000);
    await pool.query('UPDATE multiplay_devices SET active=TRUE,activation_expires_at=$1,expires_at=$1,activated_at=NOW(),updated_at=NOW() WHERE device_id=$2',[paidUntil,deviceId]);
    return res.json({success:true,message:`Ativação anual liberada por ${years} ano(s).`,activation_expires_at:paidUntil});
  }catch(e){return res.status(500).json({success:false,message:'Erro ao ativar dispositivo.'});}
});

app.get('/api/device/playlist', async (req,res)=>{
  const {device_id,device_key}=req.query||{};
  if(!device_id||!device_key) return res.status(400).json({success:false,message:'Credenciais do dispositivo ausentes.'});
  try{
    const q=await pool.query('SELECT playlist_name,playlist_url,epg_url,active,expires_at,trial_expires_at,activation_expires_at FROM multiplay_devices WHERE device_id=$1 AND device_key=$2',[device_id,device_key]);
    if(!q.rows.length) return res.status(404).json({success:false,message:'Dispositivo não registrado.'});
    const d=q.rows[0], st=estadoDispositivo(d);
    if(!st.active) return res.status(403).json({success:false,message:st.status==='EXPIRADO'?'Assinatura expirada. Faça a ativação anual.':'Dispositivo inativo.'});
    return res.json({success:true,playlist_name:d.playlist_name,playlist_url:d.playlist_url,epg_url:d.epg_url,status:st.status,days_remaining:st.days_remaining,expires_at:st.effective_expires_at});
  }catch(e){return res.status(500).json({success:false,message:'Erro ao sincronizar playlist.'});}
});

app.get('/api/device/playlist/content', async (req,res)=>{
  const {device_id,device_key}=req.query||{};
  if(!device_id||!device_key) return res.status(400).type('text/plain').send('Device ID e Device Key são obrigatórios.');
  try{
    const q=await pool.query('SELECT playlist_url,active,expires_at,trial_expires_at,activation_expires_at FROM multiplay_devices WHERE device_id=$1 AND device_key=$2',[device_id,device_key]);
    if(!q.rows.length) return res.status(404).type('text/plain').send('Dispositivo não registrado.');
    const d=q.rows[0], st=estadoDispositivo(d);
    if(!st.active) return res.status(403).type('text/plain').send(st.status==='EXPIRADO'?'Assinatura expirada.':'Dispositivo inativo.');
    if(!d.playlist_url) return res.status(404).type('text/plain').send('Playlist não vinculada.');
    const upstream=await fetch(d.playlist_url,{timeout:60000,headers:{'User-Agent':'Multiplay/2.0.3','Accept':'application/x-mpegURL,audio/x-mpegurl,text/plain,*/*'}});
    if(!upstream.ok) return res.status(502).type('text/plain').send('Servidor da playlist respondeu HTTP '+upstream.status+'.');
    const content=await upstream.text();
    if(!content.trim()) return res.status(502).type('text/plain').send('Servidor da playlist retornou conteúdo vazio.');
    return res.type('text/plain').send(content);
  }catch(e){
    console.error('MultiPlay playlist content:',e.message);
    return res.status(502).type('text/plain').send('Não foi possível carregar a playlist do servidor de conteúdo.');
  }
});

app.get('/api/admin/devices', exigirAdmin, async (req,res)=>{
  try{
    const q=await pool.query('SELECT device_id,device_key,customer_username,active,expires_at,trial_started_at,trial_expires_at,activation_expires_at,activated_at,playlist_name,playlist_url,epg_url,created_at,updated_at FROM multiplay_devices ORDER BY created_at DESC');
    res.json({success:true,devices:q.rows});
  }catch(e){res.status(500).json({success:false,message:'Erro ao listar dispositivos.'});}
});

app.post('/api/admin/devices', exigirAdmin, async (req,res)=>{
  const {device_id,device_key,customer_username,expires_at,playlist_name,playlist_url,epg_url,active}=req.body||{};
  if(!device_id||!device_key) return res.status(400).json({success:false,message:'Device ID e Device Key são obrigatórios.'});
  if(playlist_url && !/^https?:\/\//i.test(playlist_url)) return res.status(400).json({success:false,message:'A playlist precisa ser uma URL HTTP/HTTPS.'});
  try{
    if(playlist_url){
      const duplicada=await pool.query('SELECT device_id FROM multiplay_devices WHERE playlist_url=$1 AND device_id<>$2 LIMIT 1',[playlist_url,device_id]);
      if(duplicada.rows.length) return res.status(409).json({success:false,message:'Esta M3U já está vinculada a outro cliente. Cada cliente deve usar uma M3U exclusiva.'});
    }
    const existing=await pool.query('SELECT trial_started_at,trial_expires_at,activation_expires_at FROM multiplay_devices WHERE device_id=$1',[device_id]);
    if(!existing.rows.length){
      const trialStart=new Date();
      const trialEnd=new Date(trialStart.getTime()+7*86400000);
      await pool.query(`INSERT INTO multiplay_devices(device_id,device_key,customer_username,active,expires_at,trial_started_at,trial_expires_at,activation_expires_at,playlist_name,playlist_url,epg_url)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [device_id,device_key,customer_username||null,active!==false,expires_at||trialEnd,trialStart,trialEnd,expires_at||null,playlist_name||null,playlist_url||null,epg_url||null]);
    }else{
      await pool.query(`UPDATE multiplay_devices SET device_key=$1,customer_username=$2,active=$3,playlist_name=$4,playlist_url=$5,epg_url=$6,updated_at=NOW()
        WHERE device_id=$7`,
        [device_key,customer_username||null,active!==false,playlist_name||null,playlist_url||null,epg_url||null,device_id]);
    }
    res.json({success:true,message:'Dispositivo salvo. Novo dispositivo recebe 7 dias de teste; ativação anual é liberada separadamente.'});
  }catch(e){res.status(500).json({success:false,message:'Erro ao salvar dispositivo.'});}
});
/* =========================================================
   MULTIPLAY EDUCAÇÃO — BANCO, PAINEL E ÁREA DO ALUNO
========================================================= */
const uploadEducacao=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024},fileFilter:(req,file,cb)=>{const ok=file.mimetype==='application/pdf'||/\.pdf$/i.test(file.originalname||'');cb(ok?null:new Error('Apenas arquivos PDF são aceitos.'),ok);}});
const EDU_SESSION_MAX_AGE=30*24*60*60*1000;
function criarTokenEducacao(a){const p={id:a.id,username:a.username,type:'education_student',exp:Date.now()+EDU_SESSION_MAX_AGE};const t=Buffer.from(JSON.stringify(p)).toString('base64url');return t+'.'+crypto.createHmac('sha256',SESSION_SECRET).update(t).digest('base64url');}
function verificarTokenEducacao(token){if(!token)return null;const p=String(token).split('.');if(p.length!==2)return null;const e=crypto.createHmac('sha256',SESSION_SECRET).update(p[0]).digest('base64url');if(p[1].length!==e.length)return null;if(!crypto.timingSafeEqual(Buffer.from(p[1]),Buffer.from(e)))return null;try{const x=JSON.parse(Buffer.from(p[0],'base64url').toString('utf8'));return x.type==='education_student'&&x.exp>Date.now()?x:null;}catch(_){return null;}}
function obterTokenEducacao(req){const a=req.headers.authorization||'';return /^Bearer\s+/i.test(a)?a.replace(/^Bearer\s+/i,'').trim():obterCookie(req,'mp_edu_session');}
function exigirAlunoEducacao(req,res,next){const a=verificarTokenEducacao(obterTokenEducacao(req));if(!a)return res.status(401).json({success:false,message:'Sessão do aluno inválida ou expirada.'});req.aluno=a;next();}

async function garantirTabelasEducacao(){
 await pool.query("CREATE TABLE IF NOT EXISTS edu_students(id SERIAL PRIMARY KEY,name VARCHAR(180) NOT NULL,email VARCHAR(180) UNIQUE NOT NULL,username VARCHAR(100) UNIQUE NOT NULL,password_hash TEXT NOT NULL,phone VARCHAR(40),plan VARCHAR(80) DEFAULT 'Multiplay Educação',active BOOLEAN DEFAULT TRUE,access_until TIMESTAMP NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,last_login_at TIMESTAMP NULL); CREATE TABLE IF NOT EXISTS edu_courses(id SERIAL PRIMARY KEY,title VARCHAR(220) NOT NULL,description TEXT,category VARCHAR(100),provider VARCHAR(180),workload_hours NUMERIC(8,2) DEFAULT 0,content_url TEXT,cover_url TEXT,active BOOLEAN DEFAULT TRUE,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS edu_enrollments(id SERIAL PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES edu_students(id) ON DELETE CASCADE,course_id INTEGER NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,status VARCHAR(30) DEFAULT 'ATIVO',progress_percent NUMERIC(5,2) DEFAULT 0,minutes_studied INTEGER DEFAULT 0,enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,completed_at TIMESTAMP NULL,last_access_at TIMESTAMP NULL,UNIQUE(student_id,course_id)); CREATE TABLE IF NOT EXISTS edu_progress(id SERIAL PRIMARY KEY,enrollment_id INTEGER NOT NULL REFERENCES edu_enrollments(id) ON DELETE CASCADE,lesson_title VARCHAR(220),progress_percent NUMERIC(5,2) DEFAULT 0,minutes_studied INTEGER DEFAULT 0,metadata JSONB DEFAULT '{}'::jsonb,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS edu_certificates(id SERIAL PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES edu_students(id) ON DELETE CASCADE,course_id INTEGER REFERENCES edu_courses(id) ON DELETE SET NULL,certificate_number VARCHAR(100) UNIQUE NOT NULL,title VARCHAR(220) NOT NULL,issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,file_name VARCHAR(255),mime_type VARCHAR(100),file_data BYTEA,status VARCHAR(30) DEFAULT 'VALIDO',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS edu_activity(id BIGSERIAL PRIMARY KEY,student_id INTEGER REFERENCES edu_students(id) ON DELETE CASCADE,activity_type VARCHAR(80) NOT NULL,details JSONB DEFAULT '{}'::jsonb,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS idx_edu_enrollments_student ON edu_enrollments(student_id); CREATE INDEX IF NOT EXISTS idx_edu_activity_student ON edu_activity(student_id); CREATE INDEX IF NOT EXISTS idx_edu_activity_created ON edu_activity(created_at)");
 const cursos=[['Excel na Prática','Planilhas, fórmulas e produtividade.','TECNOLOGIA','Fundação Bradesco',16,'https://www.ev.org.br/cursos/excel-na-pratica'],['Atendimento ao Público','Comunicação e excelência no atendimento.','ADMINISTRAÇÃO','Fundação Bradesco',10,'https://www.ev.org.br/cursos/atendimento-ao-publico'],['Introdução à Administração','Fundamentos para quem quer atuar na área administrativa.','ADMINISTRAÇÃO','Fundação Bradesco',12,'https://www.ev.org.br/cursos/introducao-a-administracao'],['Introdução à Gestão de Projetos','Conceitos essenciais de gestão de projetos.','GESTÃO','Fundação Bradesco',10,'https://www.ev.org.br/cursos/introducao-a-gestao-de-projetos'],['Introdução à Análise de Dados — Power BI','Primeiros passos em análise de dados e Power BI.','TECNOLOGIA','Fundação Bradesco',5,'https://www.ev.org.br/cursos/introducao-a-analise-de-dados-microsoft-power-bi'],['Administração: fundamentos — Turma 2026B','Curso aberto e autoinstrucional.','ADMINISTRAÇÃO','Aprenda Mais • MEC / IFRS',40,'https://aprendamais.mec.gov.br/course/search.php?search=Administra%C3%A7%C3%A3o%20fundamentos'],['Elaboração e Análise de Projetos — Turma 2026B','Fundamentos de projetos.','GESTÃO','Aprenda Mais • MEC / IFRS',30,'https://aprendamais.mec.gov.br/course/search.php?search=Elabora%C3%A7%C3%A3o%20e%20An%C3%A1lise%20de%20Projetos'],['Empreendedorismo — Turma 2026B','Conceitos e práticas de empreendedorismo.','NEGÓCIOS','Aprenda Mais • MEC / IFRS',40,'https://aprendamais.mec.gov.br/course/search.php?search=Empreendedorismo'],['Gestão de Marketing — Turma 2026B','Fundamentos de marketing.','MARKETING','Aprenda Mais • MEC / IFRS',20,'https://aprendamais.mec.gov.br/course/search.php?search=Gest%C3%A3o%20de%20Marketing'],['Marketing Digital e Redes Sociais — Turma 2026B','Estratégias digitais e redes sociais.','MARKETING','Aprenda Mais • MEC / IFRS',20,'https://aprendamais.mec.gov.br/course/search.php?search=Marketing%20Digital%20e%20Redes%20Sociais']];
 for(const curso of cursos)await pool.query("INSERT INTO edu_courses(title,description,category,provider,workload_hours,content_url) SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM edu_courses WHERE title=$1)",curso);
}
garantirTabelasEducacao().then(()=>console.log('MultiPlay Educação: banco educacional verificado.')).catch(e=>console.error('MultiPlay Educação:',e.message));
app.get('/educacao-admin.html',(req,res)=>res.sendFile(path.join(__dirname,'educacao-admin.html')));

app.post('/api/educacao/login',async(req,res)=>{const{username,password}=req.body||{};if(!username||!password)return res.status(400).json({success:false,message:'Usuário e senha são obrigatórios.'});try{const q=await pool.query("SELECT id,name,email,username,password_hash,active,access_until,plan FROM edu_students WHERE username=$1 OR email=$1 LIMIT 1",[String(username).trim()]);if(!q.rows.length)return res.status(401).json({success:false,message:'Aluno não encontrado ou senha inválida.'});const a=q.rows[0];if(!a.active)return res.status(403).json({success:false,message:'Acesso do aluno desativado.'});if(a.access_until&&new Date(a.access_until)<new Date())return res.status(403).json({success:false,message:'Acesso do aluno expirado.'});if(!verificarSenha(password,a.password_hash))return res.status(401).json({success:false,message:'Aluno não encontrado ou senha inválida.'});await pool.query("UPDATE edu_students SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1",[a.id]);await pool.query("INSERT INTO edu_activity(student_id,activity_type,details) VALUES($1,'LOGIN',$2)",[a.id,JSON.stringify({platform:'app'})]);res.json({success:true,token:criarTokenEducacao(a),user:{id:a.id,name:a.name,email:a.email,username:a.username,plan:a.plan}});}catch(e){res.status(500).json({success:false,message:'Erro ao realizar login.'});}});
app.get('/api/educacao/me',exigirAlunoEducacao,async(req,res)=>{try{const q=await pool.query("SELECT id,name,email,username,phone,plan,active,access_until,created_at,last_login_at FROM edu_students WHERE id=$1",[req.aluno.id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Aluno não encontrado.'});res.json({success:true,student:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar perfil.'});}});
app.get('/api/educacao/courses',exigirAlunoEducacao,async(req,res)=>{try{const q=await pool.query("SELECT c.id,c.title,c.description,c.category,c.provider,c.workload_hours,c.content_url,c.cover_url,COALESCE(e.progress_percent,0) progress_percent,e.status enrollment_status,e.enrolled_at,e.last_access_at FROM edu_courses c LEFT JOIN edu_enrollments e ON e.course_id=c.id AND e.student_id=$1 WHERE c.active=true ORDER BY c.category,c.title",[req.aluno.id]);res.json({success:true,courses:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar cursos.'});}});
app.post('/api/educacao/enrollments/:courseId',exigirAlunoEducacao,async(req,res)=>{const id=Number(req.params.courseId);try{const c=await pool.query("SELECT id,title FROM edu_courses WHERE id=$1 AND active=true",[id]);if(!c.rows.length)return res.status(404).json({success:false,message:'Curso não encontrado.'});await pool.query("INSERT INTO edu_enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT(student_id,course_id) DO NOTHING",[req.aluno.id,id]);await pool.query("INSERT INTO edu_activity(student_id,activity_type,details) VALUES($1,'MATRICULA',$2)",[req.aluno.id,JSON.stringify({course_id:id})]);res.json({success:true,message:'Curso adicionado aos seus estudos.'});}catch(e){res.status(500).json({success:false,message:'Não foi possível matricular no curso.'});}});
app.patch('/api/educacao/enrollments/:courseId/progress',exigirAlunoEducacao,async(req,res)=>{const id=Number(req.params.courseId),p=Math.max(0,Math.min(100,Number(req.body?.progress_percent||0))),m=Math.max(0,Number(req.body?.minutes_studied||0)),lesson=String(req.body?.lesson_title||'').slice(0,220);try{const e=await pool.query("SELECT id FROM edu_enrollments WHERE student_id=$1 AND course_id=$2",[req.aluno.id,id]);if(!e.rows.length)return res.status(404).json({success:false,message:'Matrícula não encontrada.'});const eid=e.rows[0].id;await pool.query("UPDATE edu_enrollments SET progress_percent=$1,minutes_studied=minutes_studied+$2,last_access_at=NOW(),status=$3,completed_at=CASE WHEN $1>=100 THEN COALESCE(completed_at,NOW()) ELSE completed_at END WHERE id=$4",[p,m,p>=100?'CONCLUIDO':'ATIVO',eid]);await pool.query("INSERT INTO edu_progress(enrollment_id,lesson_title,progress_percent,minutes_studied,metadata) VALUES($1,$2,$3,$4,$5)",[eid,lesson,p,m,JSON.stringify({source:'app'})]);res.json({success:true,progress_percent:p});}catch(e){res.status(500).json({success:false,message:'Erro ao salvar progresso.'});}});
app.get('/api/educacao/my-certificates',exigirAlunoEducacao,async(req,res)=>{try{const q=await pool.query("SELECT c.id,c.certificate_number,c.title,c.issued_at,c.file_name,c.status,ec.title course_title FROM edu_certificates c LEFT JOIN edu_courses ec ON ec.id=c.course_id WHERE c.student_id=$1 ORDER BY c.issued_at DESC",[req.aluno.id]);res.json({success:true,certificates:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar certificados.'});}});
app.get('/api/educacao/certificates/:id/file',exigirAlunoEducacao,async(req,res)=>{try{const q=await pool.query("SELECT file_name,mime_type,file_data,status FROM edu_certificates WHERE id=$1 AND student_id=$2",[Number(req.params.id),req.aluno.id]);if(!q.rows.length||!q.rows[0].file_data)return res.status(404).json({success:false,message:'Arquivo não encontrado.'});res.setHeader('Content-Type',q.rows[0].mime_type||'application/pdf');res.setHeader('Content-Disposition','inline; filename="'+String(q.rows[0].file_name||'certificado.pdf').replace(/"/g,'')+'"');res.send(q.rows[0].file_data);}catch(e){res.status(500).json({success:false,message:'Erro ao abrir certificado.'});}});

app.get('/api/admin/educacao/dashboard',exigirAdmin,async(req,res)=>{try{const[a,c,m,f,h,x]=await Promise.all([pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE active)::int ativos,COUNT(*) FILTER(WHERE NOT active)::int inativos FROM edu_students"),pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE active)::int ativos FROM edu_courses"),pool.query("SELECT COUNT(*)::int total FROM edu_enrollments"),pool.query("SELECT COUNT(*)::int total FROM edu_enrollments WHERE status='CONCLUIDO'"),pool.query("SELECT COALESCE(SUM(minutes_studied),0)::int minutes FROM edu_enrollments"),pool.query("SELECT COUNT(*)::int total FROM edu_activity WHERE created_at>=NOW()-INTERVAL '30 days'")]);res.json({success:true,stats:{alunos:a.rows[0],cursos:c.rows[0],matriculas:m.rows[0].total,concluidos:f.rows[0].total,minutos_estudados:h.rows[0].minutes,atividades_30_dias:x.rows[0].total}});}catch(e){res.status(500).json({success:false,message:'Erro no dashboard.'});}});
app.get('/api/admin/educacao/students',exigirAdmin,async(req,res)=>{try{const q=await pool.query("SELECT s.id,s.name,s.email,s.username,s.phone,s.plan,s.active,s.access_until,s.created_at,s.last_login_at,COUNT(DISTINCT e.id)::int courses_count,COALESCE(ROUND(AVG(e.progress_percent),1),0)::float progress_average,COUNT(DISTINCT cert.id)::int certificates_count FROM edu_students s LEFT JOIN edu_enrollments e ON e.student_id=s.id LEFT JOIN edu_certificates cert ON cert.student_id=s.id AND cert.status='VALIDO' GROUP BY s.id ORDER BY s.created_at DESC");res.json({success:true,students:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao listar alunos.'});}});
app.post('/api/admin/educacao/students',exigirAdmin,async(req,res)=>{const{name,email,username,password,phone,plan,access_until}=req.body||{};if(!name||!email||!username||!password)return res.status(400).json({success:false,message:'Nome, e-mail, usuário e senha são obrigatórios.'});try{const e=await pool.query("SELECT id FROM edu_students WHERE username=$1 OR email=$2",[username,email]);if(e.rows.length)return res.status(409).json({success:false,message:'Usuário ou e-mail já cadastrado.'});const q=await pool.query("INSERT INTO edu_students(name,email,username,password_hash,phone,plan,access_until) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,username,phone,plan,active,access_until,created_at",[name,email,username,gerarHashSenha(password),phone||null,plan||'Multiplay Educação',access_until||null]);res.status(201).json({success:true,student:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao cadastrar aluno.'});}});
app.patch('/api/admin/educacao/students/:id',exigirAdmin,async(req,res)=>{const id=Number(req.params.id),{name,email,username,password,phone,plan,active,access_until}=req.body||{};try{const o=await pool.query("SELECT * FROM edu_students WHERE id=$1",[id]);if(!o.rows.length)return res.status(404).json({success:false,message:'Aluno não encontrado.'});const s=o.rows[0],q=await pool.query("UPDATE edu_students SET name=$1,email=$2,username=$3,password_hash=$4,phone=$5,plan=$6,active=$7,access_until=$8,updated_at=NOW() WHERE id=$9 RETURNING id,name,email,username,phone,plan,active,access_until,created_at,last_login_at",[name??s.name,email??s.email,username??s.username,password?gerarHashSenha(password):s.password_hash,phone??s.phone,plan??s.plan,active===undefined?s.active:Boolean(active),access_until===undefined?s.access_until:access_until||null,id]);res.json({success:true,student:q.rows[0]});}catch(e){if(e.code==='23505')return res.status(409).json({success:false,message:'Usuário ou e-mail já está em uso.'});res.status(500).json({success:false,message:'Erro ao atualizar aluno.'});}});
app.delete('/api/admin/educacao/students/:id',exigirAdmin,async(req,res)=>{try{const q=await pool.query("DELETE FROM edu_students WHERE id=$1 RETURNING id,name",[Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Aluno não encontrado.'});res.json({success:true,message:'Aluno excluído.'});}catch(e){res.status(500).json({success:false,message:'Erro ao excluir aluno.'});}});
app.get('/api/admin/educacao/courses',exigirAdmin,async(req,res)=>{try{const q=await pool.query("SELECT c.*,COUNT(e.id)::int students_count FROM edu_courses c LEFT JOIN edu_enrollments e ON e.course_id=c.id GROUP BY c.id ORDER BY c.created_at DESC");res.json({success:true,courses:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao listar cursos.'});}});
app.post('/api/admin/educacao/courses',exigirAdmin,async(req,res)=>{const{title,description,category,provider,workload_hours,content_url,cover_url}=req.body||{};if(!title)return res.status(400).json({success:false,message:'Título do curso é obrigatório.'});try{const q=await pool.query("INSERT INTO edu_courses(title,description,category,provider,workload_hours,content_url,cover_url) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[title,description||null,category||null,provider||null,Number(workload_hours)||0,content_url||null,cover_url||null]);res.status(201).json({success:true,course:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao cadastrar curso.'});}});
app.patch('/api/admin/educacao/courses/:id',exigirAdmin,async(req,res)=>{const id=Number(req.params.id),{title,description,category,provider,workload_hours,content_url,cover_url,active}=req.body||{};try{const q=await pool.query("UPDATE edu_courses SET title=COALESCE($1,title),description=COALESCE($2,description),category=COALESCE($3,category),provider=COALESCE($4,provider),workload_hours=COALESCE($5,workload_hours),content_url=COALESCE($6,content_url),cover_url=COALESCE($7,cover_url),active=COALESCE($8,active),updated_at=NOW() WHERE id=$9 RETURNING *",[title,description,category,provider,workload_hours===undefined?null:Number(workload_hours),content_url,cover_url,active===undefined?null:Boolean(active),id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Curso não encontrado.'});res.json({success:true,course:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao atualizar curso.'});}});
app.delete('/api/admin/educacao/courses/:id',exigirAdmin,async(req,res)=>{try{const q=await pool.query("DELETE FROM edu_courses WHERE id=$1 RETURNING id,title",[Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Curso não encontrado.'});res.json({success:true,message:'Curso excluído.'});}catch(e){res.status(500).json({success:false,message:'Erro ao excluir curso.'});}});
app.get('/api/admin/educacao/students/:id',exigirAdmin,async(req,res)=>{const id=Number(req.params.id);try{const[s,e,c,a]=await Promise.all([pool.query("SELECT id,name,email,username,phone,plan,active,access_until,created_at,last_login_at FROM edu_students WHERE id=$1",[id]),pool.query("SELECT e.id,e.progress_percent,e.minutes_studied,e.status,e.enrolled_at,e.completed_at,e.last_access_at,c.id course_id,c.title,c.category,c.workload_hours FROM edu_enrollments e JOIN edu_courses c ON c.id=e.course_id WHERE e.student_id=$1 ORDER BY e.enrolled_at DESC",[id]),pool.query("SELECT cert.id,cert.certificate_number,cert.title,cert.issued_at,cert.file_name,cert.status,c.title course_title FROM edu_certificates cert LEFT JOIN edu_courses c ON c.id=cert.course_id WHERE cert.student_id=$1 ORDER BY cert.issued_at DESC",[id]),pool.query("SELECT activity_type,details,created_at FROM edu_activity WHERE student_id=$1 ORDER BY created_at DESC LIMIT 50",[id])]);if(!s.rows.length)return res.status(404).json({success:false,message:'Aluno não encontrado.'});res.json({success:true,student:s.rows[0],enrollments:e.rows,certificates:c.rows,activity:a.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar o aluno.'});}});
app.post('/api/admin/educacao/enrollments',exigirAdmin,async(req,res)=>{const{student_id,course_id}=req.body||{};if(!student_id||!course_id)return res.status(400).json({success:false,message:'Aluno e curso são obrigatórios.'});try{const q=await pool.query("INSERT INTO edu_enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT(student_id,course_id) DO UPDATE SET status='ATIVO' RETURNING *",[Number(student_id),Number(course_id)]);res.status(201).json({success:true,enrollment:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao matricular aluno.'});}});
app.patch('/api/admin/educacao/enrollments/:id',exigirAdmin,async(req,res)=>{const id=Number(req.params.id),{status,progress_percent,minutes_studied}=req.body||{};try{const q=await pool.query("UPDATE edu_enrollments SET status=COALESCE($1,status),progress_percent=COALESCE($2,progress_percent),minutes_studied=COALESCE($3,minutes_studied),completed_at=CASE WHEN COALESCE($2,progress_percent)>=100 THEN COALESCE(completed_at,NOW()) ELSE completed_at END,last_access_at=NOW() WHERE id=$4 RETURNING *",[status,progress_percent===undefined?null:Number(progress_percent),minutes_studied===undefined?null:Number(minutes_studied),id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Matrícula não encontrada.'});res.json({success:true,enrollment:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao atualizar progresso.'});}});
app.post('/api/admin/educacao/certificates',exigirAdmin,uploadEducacao.single('file'),async(req,res)=>{const{student_id,course_id,title}=req.body||{};if(!student_id||!title)return res.status(400).json({success:false,message:'Aluno e título do certificado são obrigatórios.'});if(!req.file)return res.status(400).json({success:false,message:'Envie um arquivo PDF.'});try{const numero='MPE-'+new Date().getFullYear()+'-'+crypto.randomBytes(5).toString('hex').toUpperCase();const q=await pool.query("INSERT INTO edu_certificates(student_id,course_id,certificate_number,title,file_name,mime_type,file_data) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,student_id,course_id,certificate_number,title,issued_at,file_name,status",[Number(student_id),course_id?Number(course_id):null,numero,title,req.file.originalname,req.file.mimetype,req.file.buffer]);res.status(201).json({success:true,certificate:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao salvar certificado.'});}});
app.get('/api/admin/educacao/certificates/:id/file',exigirAdmin,async(req,res)=>{try{const q=await pool.query("SELECT file_name,mime_type,file_data FROM edu_certificates WHERE id=$1",[Number(req.params.id)]);if(!q.rows.length||!q.rows[0].file_data)return res.status(404).send('Certificado não encontrado.');res.setHeader('Content-Type',q.rows[0].mime_type||'application/pdf');res.setHeader('Content-Disposition','inline; filename="'+String(q.rows[0].file_name||'certificado.pdf').replace(/"/g,'')+'"');res.send(q.rows[0].file_data);}catch(e){res.status(500).send('Erro ao abrir certificado.');}});
app.patch('/api/admin/educacao/certificates/:id',exigirAdmin,async(req,res)=>{try{const q=await pool.query("UPDATE edu_certificates SET status=COALESCE($1,status) WHERE id=$2 RETURNING id,status",[req.body?.status,Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Certificado não encontrado.'});res.json({success:true,certificate:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao atualizar certificado.'});}});


/* =========================================================
   MULTIPLAY EDUCAÇÃO — SUPORTE / DÚVIDAS
========================================================= */
async function garantirTabelasSuporteEducacao(){
  await pool.query("CREATE TABLE IF NOT EXISTS edu_support_tickets(id SERIAL PRIMARY KEY,student_id INTEGER REFERENCES edu_students(id) ON DELETE SET NULL,name VARCHAR(180) NOT NULL,email VARCHAR(180),subject VARCHAR(220) NOT NULL,status VARCHAR(30) DEFAULT 'ABERTO',priority VARCHAR(20) DEFAULT 'NORMAL',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,last_reply_at TIMESTAMP NULL); CREATE TABLE IF NOT EXISTS edu_support_messages(id BIGSERIAL PRIMARY KEY,ticket_id INTEGER NOT NULL REFERENCES edu_support_tickets(id) ON DELETE CASCADE,sender_type VARCHAR(20) NOT NULL,message TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS idx_edu_support_status ON edu_support_tickets(status); CREATE INDEX IF NOT EXISTS idx_edu_support_ticket ON edu_support_messages(ticket_id)");
}
garantirTabelasSuporteEducacao().catch(e=>console.error('MultiPlay Suporte:',e.message));

app.post('/api/educacao/support/tickets',async(req,res)=>{
  const aluno=verificarTokenEducacao(obterTokenEducacao(req));
  const {name,email,subject,message}=req.body||{};
  if(!subject||!message)return res.status(400).json({success:false,message:'Assunto e mensagem são obrigatórios.'});
  try{
    const s=aluno?await pool.query('SELECT name,email FROM edu_students WHERE id=$1',[aluno.id]):null;
    const nome=(aluno&&s?.rows[0]?.name)||name||'Aluno';
    const mail=(aluno&&s?.rows[0]?.email)||email||null;
    const t=await pool.query("INSERT INTO edu_support_tickets(student_id,name,email,subject) VALUES($1,$2,$3,$4) RETURNING id,subject,status,created_at",[aluno?.id||null,nome,mail,subject]);
    await pool.query("INSERT INTO edu_support_messages(ticket_id,sender_type,message) VALUES($1,'ALUNO',$2)",[t.rows[0].id,String(message).slice(0,5000)]);
    res.status(201).json({success:true,ticket:t.rows[0]});
  }catch(e){res.status(500).json({success:false,message:'Não foi possível abrir o chamado.'});}
});

app.get('/api/educacao/support/tickets',async(req,res)=>{
  const aluno=verificarTokenEducacao(obterTokenEducacao(req));if(!aluno)return res.status(401).json({success:false,message:'Faça login para consultar suas dúvidas.'});
  try{const q=await pool.query("SELECT id,subject,status,priority,created_at,updated_at,last_reply_at FROM edu_support_tickets WHERE student_id=$1 ORDER BY updated_at DESC",[aluno.id]);res.json({success:true,tickets:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar chamados.'});}
});

app.get('/api/educacao/support/tickets/:id',async(req,res)=>{
  const aluno=verificarTokenEducacao(obterTokenEducacao(req));if(!aluno)return res.status(401).json({success:false,message:'Faça login.'});
  try{const q=await pool.query("SELECT id,subject,status,priority,created_at,updated_at FROM edu_support_tickets WHERE id=$1 AND student_id=$2",[Number(req.params.id),aluno.id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});const m=await pool.query("SELECT sender_type,message,created_at FROM edu_support_messages WHERE ticket_id=$1 ORDER BY created_at",[q.rows[0].id]);res.json({success:true,ticket:q.rows[0],messages:m.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar conversa.'});}
});

app.post('/api/educacao/support/tickets/:id/messages',async(req,res)=>{
  const aluno=verificarTokenEducacao(obterTokenEducacao(req));if(!aluno)return res.status(401).json({success:false,message:'Faça login.'});
  const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({success:false,message:'Mensagem vazia.'});
  try{const q=await pool.query("SELECT id FROM edu_support_tickets WHERE id=$1 AND student_id=$2",[Number(req.params.id),aluno.id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});await pool.query("INSERT INTO edu_support_messages(ticket_id,sender_type,message) VALUES($1,'ALUNO',$2)",[q.rows[0].id,message.slice(0,5000)]);await pool.query("UPDATE edu_support_tickets SET status='ABERTO',updated_at=NOW() WHERE id=$1",[q.rows[0].id]);res.json({success:true});}catch(e){res.status(500).json({success:false,message:'Erro ao enviar mensagem.'});}
});

app.get('/api/admin/educacao/support/tickets',exigirAdmin,async(req,res)=>{
  try{const q=await pool.query("SELECT t.id,t.name,t.email,t.subject,t.status,t.priority,t.created_at,t.updated_at,t.last_reply_at,COUNT(m.id)::int message_count FROM edu_support_tickets t LEFT JOIN edu_support_messages m ON m.ticket_id=t.id GROUP BY t.id ORDER BY CASE WHEN t.status='ABERTO' THEN 0 ELSE 1 END,t.updated_at DESC");res.json({success:true,tickets:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao listar suporte.'});}
});
app.get('/api/admin/educacao/support/tickets/:id',exigirAdmin,async(req,res)=>{
  try{const q=await pool.query("SELECT * FROM edu_support_tickets WHERE id=$1",[Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});const m=await pool.query("SELECT sender_type,message,created_at FROM edu_support_messages WHERE ticket_id=$1 ORDER BY created_at",[q.rows[0].id]);res.json({success:true,ticket:q.rows[0],messages:m.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao abrir chamado.'});}
});
app.post('/api/admin/educacao/support/tickets/:id/messages',exigirAdmin,async(req,res)=>{
  const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({success:false,message:'Mensagem vazia.'});
  try{const id=Number(req.params.id);const q=await pool.query("SELECT id FROM edu_support_tickets WHERE id=$1",[id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});await pool.query("INSERT INTO edu_support_messages(ticket_id,sender_type,message) VALUES($1,'SUPORTE',$2)",[id,message.slice(0,5000)]);await pool.query("UPDATE edu_support_tickets SET status='RESPONDIDO',last_reply_at=NOW(),updated_at=NOW() WHERE id=$1",[id]);res.json({success:true});}catch(e){res.status(500).json({success:false,message:'Erro ao responder.'});}
});
app.patch('/api/admin/educacao/support/tickets/:id',exigirAdmin,async(req,res)=>{
  try{const q=await pool.query("UPDATE edu_support_tickets SET status=COALESCE($1,status),priority=COALESCE($2,priority),updated_at=NOW() WHERE id=$3 RETURNING id,status,priority",[req.body?.status,req.body?.priority,Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});res.json({success:true,ticket:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao atualizar chamado.'});}
});

/* =========================================================
   MULTIPLAY EDUCAÇÃO — ASSINATURAS
========================================================= */
const registerEducacaoAssinaturas = require('./educacao-assinaturas');
registerEducacaoAssinaturas({ app, pool, fetch, exigirAlunoEducacao, exigirAdmin });

/* =========================
   SERVIDOR
========================= */

app.listen(
  PORT,
  () => {

    console.log(
      `MultiPlay rodando na porta ${PORT}`
    );
  }
);
