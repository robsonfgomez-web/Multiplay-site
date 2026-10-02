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
