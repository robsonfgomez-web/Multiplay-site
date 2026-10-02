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
  .update(process.env.DATABASE_URL || 'multiplay-session-secret')
  .digest('hex');

const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

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

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      'Servidor de conteúdo indisponível'
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

      if (
        usuario.expires_at &&
        new Date(usuario.expires_at) <
        new Date()
      ) {
        return res.status(403).json({
          success: false,
          message:
            'Acesso expirado.'
        });
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

  if (
    usuario.expires_at &&
    new Date(usuario.expires_at) <
    new Date()
  ) {
    throw new Error(
      'Acesso expirado'
    );
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

      const [
        canais,
        filmes,
        series
      ] = await Promise.all([
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
        error:
          'Não foi possível carregar o catálogo'
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

    res.json({
      livros: [],
      ebooks: [],
      audiobooks: []
    });

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

      /*
       * Busca as credenciais Xtream
       * vinculadas ao cliente MultiPlay.
       *
       * A senha Xtream NÃO é enviada
       * pelo aplicativo.
       */

      const credenciais =
        await obterCredenciaisXtream(
          username
        );


      let source;


      /*
       * Se for uma requisição de segmento
       * HLS, usamos o recurso informado
       * pelo próprio servidor.
       */

      if (resource) {

        source =
          decodeURIComponent(
            resource
          );

      } else {

        /*
         * CANAL
         */

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


        /*
         * FILME
         */

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
            )}.mp4`;

        }


        /*
         * SÉRIE / EPISÓDIO
         */

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
            )}.mp4`;

        }


        else {

          return res.status(400).json({
            error:
              'Tipo de conteúdo não suportado'
          });

        }

      }


      /*
       * Segurança:
       * o servidor só pode acessar
       * o domínio Xtream configurado.
       */

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


      /*
       * Encaminha Range para filmes
       * e episódios.
       */

      const headers = {};

      if (req.headers.range) {

        headers.Range =
          req.headers.range;

      }


      const response =
        await fetch(
          source,
          {
            headers
          }
        );


      if (!response.ok) {

        return res
          .status(response.status)
          .send(
            'Não foi possível acessar o conteúdo'
          );

      }


      /*
       * Copia os cabeçalhos importantes
       * para o navegador/player.
       */

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


      /*
       * HLS:
       *
       * A playlist precisa ser reescrita
       * para que os segmentos também
       * passem pelo servidor MultiPlay.
       */

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


                /*
                 * Linha de segmento
                 */

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


                /*
                 * URI dentro de uma
                 * tag HLS.
                 */

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


      /*
       * Filme / episódio / segmento.
       */

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
        '6.0.0',

      catalogo: [
        'canais',
        'filmes',
        'series',
        'livros',
        'ebooks',
        'audiobooks'
      ]

    });
  }
);

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
