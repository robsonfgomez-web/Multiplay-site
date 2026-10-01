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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'player.html'));
});


/*
====================================================
FUNÇÃO PARA CONSULTAR API XTREAM
====================================================
*/

async function xtreamRequest(user, pass, action) {

  const url =
    `${XTREAM_HOST}/player_api.php` +
    `?username=${encodeURIComponent(user)}` +
    `&password=${encodeURIComponent(pass)}` +
    `&action=${encodeURIComponent(action)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Servidor de conteúdo indisponível');
  }

  return await response.json();
}


/*
====================================================
CATÁLOGO COMPLETO
CANAIS + FILMES + SÉRIES
====================================================
*/

app.get('/api/catalogo', async (req, res) => {

  const { user, pass } = req.query;

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

      xtreamRequest(user, pass, 'get_live_streams'),

      xtreamRequest(user, pass, 'get_vod_streams'),

      xtreamRequest(user, pass, 'get_series')

    ]);

    res.json({

      canais: Array.isArray(liveStreams)
        ? liveStreams
        : [],

      filmes: Array.isArray(vodStreams)
        ? vodStreams
        : [],

      series: Array.isArray(series)
        ? series
        : []

    });

  } catch (error) {

    console.error('Erro catálogo:', error);

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

  const { user, pass } = req.query;

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
INFORMAÇÕES DE UMA SÉRIE
====================================================
*/

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

O navegador acessa o próprio servidor HTTPS
da MultiPlay.

O servidor então busca o conteúdo autorizado
no servidor de origem.

Isso evita que o navegador tente abrir diretamente
um endereço HTTP dentro de uma página HTTPS.
====================================================
*/

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

    /*
    Permitir somente o servidor de conteúdo
    configurado para a aplicação.
    */

    if (parsed.hostname !== 'u.l0.ms') {

      return res.status(403).json({
        error: 'Origem de mídia não autorizada'
      });

    }

    const response =
      await fetch(source);

    if (!response.ok) {

      return res.status(response.status).send(
        'Erro ao acessar conteúdo'
      );

    }

    /*
    Copia alguns headers importantes
    */

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

Busca a playlist .m3u8 no servidor autorizado.

As URLs internas da playlist são convertidas
para o próprio /api/media da MultiPlay.
====================================================
*/

app.get('/api/hls', async (req, res) => {

  const source = req.query.url;

  if (!source) {

    return res.status(400).send(
      'URL HLS não informada'
    );

  }

  try {

    const parsed =
      new URL(source);

    if (parsed.hostname !== 'u.l0.ms') {

      return res.status(403).send(
        'Origem não autorizada'
      );

    }

    const response =
      await fetch(source);

    if (!response.ok) {

      return res.status(response.status).send(
        'Erro ao buscar playlist'
      );

    }

    let playlist =
      await response.text();


    /*
    Descobre a URL base da playlist
    */

    const baseUrl =
      new URL(
        source
      );


    /*
    Processa cada linha da playlist
    */

    playlist =
      playlist
        .split('\n')
        .map(line => {

          const trimmed =
            line.trim();

          /*
          Comentários HLS
          */

          if (
            !trimmed ||
            trimmed.startsWith('#')
          ) {

            /*
            Alguns comentários contêm
            URLs de segmentos.
            */

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


          /*
          URL absoluta
          */

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
          'URI="/api/media?url=' +
          encodeURIComponent(
            absolute
          ) +
          '"'
        );

      } catch {

        return match;

      }

    }
  );

}


/*
====================================================
LIVROS / E-BOOKS / AUDIOBOOKS
====================================================

A estrutura fica preparada para nosso catálogo
próprio da MultiPlay.

Esses conteúdos NÃO serão buscados do servidor
de TV.

Posteriormente vamos cadastrar:

- PDF
- E-book
- Audiobook
- Livro
- Capa
- Autor
- Categoria
- Link autorizado
====================================================
*/

app.get('/api/livros', (req, res) => {

  res.json({

    livros: [],

    ebooks: [],

    audiobooks: []

  });

});


/*
====================================================
STATUS DO SERVIDOR
====================================================
*/

app.get('/api/status', (req, res) => {

  res.json({

    app: 'MultiPlay Entretenimento',

    status: 'online',

    versao: '3.0.0',

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


/*
====================================================
INICIAR SERVIDOR
====================================================
*/

app.listen(
  PORT,
  () => {

    console.log(
      `MultiPlay rodando na porta ${PORT}`
    );

  }
);
