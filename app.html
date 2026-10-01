const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;

const XTREAM_HOST = 'http://u.l0.ms';

app.use(express.json());
app.use(express.static(__dirname));


/*
====================================================
PÁGINAS
====================================================
*/

// SITE PÚBLICO
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// LOGIN DO APLICATIVO
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// APLICATIVO
app.get('/app.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.html'));
});

// PLAYER
app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'player.html'));
});


/*
====================================================
FUNÇÃO PARA CONSULTAR API XTREAM
====================================================
*/

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


/*
====================================================
LOGIN DO APLICATIVO
====================================================

O usuário e senha são enviados ao servidor.

O servidor consulta o serviço de conteúdo
para verificar se as credenciais são válidas.

Nenhuma credencial fica gravada neste código.
====================================================
*/

app.post('/api/login', async (req, res) => {

  const {
    username,
    password
  } = req.body || {};

  if (!username || !password) {

    return res.status(400).json({
      success: false,
      message: 'Usuário e senha são obrigatórios.'
    });

  }

  try {

    const data =
      await xtreamRequest(
        username,
        password
      );


    /*
    A API normalmente retorna user_info
    quando as credenciais são aceitas.
    */

    const userInfo =
      data &&
      data.user_info;


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

    console.error(
      'Erro no login:',
      error
    );

    return res.status(502).json({
      success: false,
      message: 'Não foi possível verificar o acesso.'
    });

  }

});


/*
====================================================
CATÁLOGO COMPLETO
====================================================
*/

app.get('/api/catalogo', async (req, res) => {

  const {
    user,
    pass
  } = req.query;

  if (!user || !pass) {

    return res.status(400).json({
      error: 'Usuário e senha são obrigatórios'
    });

  }

  try {

    const [
      liveStreams,
      vodStreams,
      series
    ] = await Promise.all([

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

    res.json({

      canais:
        Array.isArray(liveStreams)
          ? liveStreams
          : [],

      filmes:
        Array.isArray(vodStreams)
          ? vodStreams
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

    res.status(500).json({
      error: 'Não foi possível carregar o catálogo'
    });

  }

});


/*
====================================================
CANAIS
====================================================
*/

app.get('/api/canais', async (req, res) => {

  const {
    user,
    pass
  } = req.query;

  if (!user || !pass) {

    return res.status(400).json({
      error: 'Falta usuário ou senha'
    });

  }

  try {

    const data =
      await xtreamRequest(
        user,
        pass,
        'get_live_streams'
      );

    return res.json(data);

  } catch (error) {

    console.error(
      'Erro ao buscar canais:',
      error
    );

    return res.status(500).json({
      error: 'Erro ao conectar ao servidor de canais'
    });

  }

});


/*
====================================================
CATEGORIAS DE CANAIS
====================================================
*/

app.get('/api/categorias-canais', async (req, res) => {

  const {
    user,
    pass
  } = req.query;

  if (!user || !pass) {

    return res.status(400).json({
      error: 'Usuário e senha são obrigatórios'
    });

  }

  try {

    const data =
      await xtreamRequest(
        user,
        pass,
        'get_live_categories'
      );

    return res.json(
      Array.isArray(data)
        ? data
        : []
    );

  } catch (error) {

    console.error(
      'Erro categorias:',
      error
    );

    return res.status(500).json({
      error: 'Erro ao carregar categorias'
    });

  }

});


/*
====================================================
GRUPOS DE CANAIS
====================================================
*/

function identificarMarca(name) {

  const nome =
    String(name || '').toLowerCase();


  if (nome.includes('globo')) return 'Globo';

  if (nome.includes('band')) return 'Band';

  if (nome.includes('record')) return 'Record';

  if (nome.includes('sbt')) return 'SBT';

  if (nome.includes('discovery')) return 'Discovery';

  if (nome.includes('espn')) return 'ESPN';

  if (nome.includes('premiere')) return 'Premiere';

  if (nome.includes('sportv')) return 'SporTV';

  if (nome.includes('tnt')) return 'TNT';

  if (nome.includes('cnn')) return 'CNN';

  if (nome.includes('disney')) return 'Disney';

  if (nome.includes('nickelodeon')) return 'Nickelodeon';

  if (nome.includes('telecine')) return 'Telecine';

  if (nome.includes('paramount')) return 'Paramount';

  if (nome.includes('hbo')) return 'HBO';

  if (nome.includes('axn')) return 'AXN';

  if (nome.includes('sony')) return 'Sony';

  if (nome.includes('universal')) return 'Universal';

  if (
    nome.includes('adult') ||
    nome.includes('+18')
  ) {
    return 'Adultos';
  }

  return 'Outros';
}


app.get('/api/grupos-canais', async (req, res) => {

  const {
    user,
    pass
  } = req.query;

  if (!user || !pass) {

    return res.status(400).json({
      error: 'Usuário e senha são obrigatórios'
    });

  }

  try {

    const canais =
      await xtreamRequest(
        user,
        pass,
        'get_live_streams'
      );


    const grupos = {

      Todos: [],

      Globo: [],

      Band: [],

      Record: [],

      SBT: [],

      Discovery: [],

      ESPN: [],

      Premiere: [],

      SporTV: [],

      TNT: [],

      CNN: [],

      Disney: [],

      Nickelodeon: [],

      Telecine: [],

      Paramount: [],

      HBO: [],

      AXN: [],

      Sony: [],

      Universal: [],

      Adultos: [],

      Outros: []

    };


    if (Array.isArray(canais)) {

      canais.forEach(canal => {

        grupos.Todos.push(canal);

        const grupo =
          identificarMarca(
            canal.name ||
            canal.stream_name
          );

        if (!grupos[grupo]) {
          grupos[grupo] = [];
        }

        grupos[grupo].push(canal);

      });

    }


    return res.json(grupos);

  } catch (error) {

    console.error(
      'Erro grupos:',
      error
    );

    return res.status(500).json({
      error: 'Erro ao organizar canais'
    });

  }

});


/*
====================================================
INFORMAÇÕES DE UMA SÉRIE
====================================================
*/

app.get('/api/serie', async (req, res) => {

  const {
    user,
    pass,
    series_id
  } = req.query;

  if (
    !user ||
    !pass ||
    !series_id
  ) {

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


    const response =
      await fetch(url);


    if (!response.ok) {

      return res.status(502).json({
        error: 'Não foi possível consultar a série'
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


/*
====================================================
PROXY DE MÍDIA
====================================================
*/

app.get('/api/media', async (req, res) => {

  const source =
    req.query.url;

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
        error: 'Origem de mídia não autorizada'
      });

    }


    const response =
      await fetch(source);


    if (!response.ok) {

      return res.status(
        response.status
      ).send(
        'Erro ao acessar conteúdo'
      );

    }


    const contentType =
      response.headers.get(
        'content-type'
      );

    const contentLength =
      response.headers.get(
        'content-length'
      );


    if (contentType) {

      res.setHeader(
        'Content-Type',
        contentType
      );

    }


    if (contentLength) {

      res.setHeader(
        'Content-Length',
        contentLength
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
      'Erro proxy mídia:',
      error
    );

    res.status(500).json({
      error: 'Erro ao reproduzir conteúdo'
    });

  }

});


/*
====================================================
PROXY HLS
====================================================
*/

app.get('/api/hls', async (req, res) => {

  const source =
    req.query.url;

  if (!source) {

    return res.status(400).send(
      'URL HLS não informada'
    );

  }

  try {

    const parsed =
      new URL(source);


    if (
      parsed.hostname !== 'u.l0.ms'
    ) {

      return res.status(403).send(
        'Origem não autorizada'
      );

    }


    const response =
      await fetch(source);


    if (!response.ok) {

      return res.status(
        response.status
      ).send(
        'Erro ao buscar playlist'
      );

    }


    let playlist =
      await response.text();


    const baseUrl =
      new URL(source);


    playlist =
      playlist
        .split('\n')
        .map(line => {

          const trimmed =
            line.trim();


          if (
            !trimmed ||
            trimmed.startsWith('#')
          ) {

            if (
              trimmed.includes('URI="')
            ) {

              return rewriteHlsLine(
                trimmed,
                baseUrl
              );

            }

            return line;

          }


          let mediaUrl;

          try {

            mediaUrl =
              new URL(
                trimmed,
                baseUrl
              ).toString();

          } catch {

            return line;

          }


          return (
            '/api/media?url=' +
            encodeURIComponent(
              mediaUrl
            )
          );

        })
        .join('\n');


    res.setHeader(
      'Content-Type',
      'application/vnd.apple.mpegurl'
    );

    res.setHeader(
      'Access-Control-Allow-Origin',
      '*'
    );

    res.setHeader(
      'Cache-Control',
      'no-cache'
    );


    res.send(playlist);

  } catch (error) {

    console.error(
      'Erro HLS:',
      error
    );

    res.status(500).send(
      'Erro ao carregar transmissão'
    );

  }

});


/*
====================================================
REESCREVER URI DENTRO DO HLS
====================================================
*/

function rewriteHlsLine(
  line,
  baseUrl
) {

  return line.replace(
    /URI="([^"]+)"/g,
    (match, uri) => {

      try {

        const absolute =
          new URL(
            uri,
            baseUrl
          ).toString();


        return (
          '
