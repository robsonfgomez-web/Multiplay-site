<!DOCTYPE html>
<html lang="pt-BR">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>Multiplay Player</title>


  <!--
    HLS.JS
    Usado principalmente em Chrome,
    Android, Edge e Firefox.
  -->

  <script
    src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js">
  </script>


  <style>

    * {
      box-sizing: border-box;
    }

    body {

      margin: 0;

      min-height: 100vh;

      background: #000;

      color: #fff;

      font-family: Arial, sans-serif;

      display: flex;

      flex-direction: column;

    }


    header {

      height: 60px;

      background: #10141F;

      display: flex;

      align-items: center;

      justify-content: space-between;

      padding: 0 20px;

      border-bottom: 1px solid #202638;

    }


    .title {

      font-weight: bold;

      overflow: hidden;

      white-space: nowrap;

      text-overflow: ellipsis;

      max-width: 70%;

    }


    button {

      background: #202638;

      color: #fff;

      border: 0;

      border-radius: 8px;

      padding: 9px 14px;

      cursor: pointer;

    }


    button:hover {

      background: #303A52;

    }


    main {

      flex: 1;

      display: flex;

      flex-direction: column;

      align-items: center;

      justify-content: center;

      padding: 20px;

    }


    video {

      width: 100%;

      max-width: 1200px;

      max-height: 75vh;

      background: #000;

      display: block;

    }


    #status {

      color: #9AA4B8;

      margin-top: 15px;

      text-align: center;

      max-width: 900px;

    }


    .loading {

      color: #0A84FF;

    }


    .error {

      color: #FF7070 !important;

    }


    @media (max-width: 600px) {

      header {

        height: 55px;

        padding: 0 12px;

      }


      .title {

        font-size: 14px;

      }


      main {

        padding: 10px;

      }


      video {

        max-height: 70vh;

      }

    }

  </style>

</head>


<body>


<header>

  <div
    id="title"
    class="title"
  >
    Multiplay Player
  </div>


  <button onclick="voltar()">
    Voltar
  </button>

</header>


<main>

  <video
    id="video"
    controls
    playsinline
    preload="metadata"
  ></video>


  <div id="status" class="loading">
    Preparando reprodução...
  </div>

</main>


<script>


/*
==================================================
DADOS DA SESSÃO
==================================================
*/

const user =
  sessionStorage.getItem("mp_user");


const pass =
  sessionStorage.getItem("mp_pass");


const streamId =
  sessionStorage.getItem("mp_stream_id");


const streamName =
  sessionStorage.getItem("mp_stream_name")
  || "Multiplay Player";


const video =
  document.getElementById("video");


const status =
  document.getElementById("status");


const title =
  document.getElementById("title");


title.textContent =
  streamName;


/*
==================================================
VERIFICA LOGIN
==================================================
*/

if (!user || !pass) {

  mostrarErro(
    "Sua sessão expirou. Faça login novamente."
  );

}


/*
==================================================
VERIFICA CANAL
==================================================
*/

else if (!streamId) {

  mostrarErro(
    "Nenhum canal foi selecionado."
  );

}


/*
==================================================
INICIA PLAYER
==================================================
*/

else {

  iniciarPlayer();

}


/*
==================================================
INICIAR HLS
==================================================
*/

function iniciarPlayer() {


  /*
    IMPORTANTE:

    O endereço do stream é montado somente
    neste momento.

    O servidor de conteúdo continua sendo
    o servidor configurado no backend.
  */

  const server =
    sessionStorage.getItem("mp_server");


  if (!server) {

    mostrarErro(
      "Servidor da sessão não encontrado."
    );

    return;

  }


  /*
    Endpoint utilizado pelo serviço Xtream.

    O backend/serviço precisa permitir que
    esse endereço seja reproduzido pelo navegador.
  */

  const streamUrl =
    server.replace(/\/$/, "") +
    "/live/" +
    encodeURIComponent(user) +
    "/" +
    encodeURIComponent(pass) +
    "/" +
    encodeURIComponent(streamId) +
    ".m3u8";


  /*
  ==================================================
  SAFARI / IOS / NAVEGADORES COM HLS NATIVO
  ==================================================
  */

  if (
    video.canPlayType(
      "application/vnd.apple.mpegurl"
    )
  ) {

    status.textContent =
      "Conectando ao canal...";


    video.src =
      streamUrl;


    video.addEventListener(
      "loadedmetadata",
      () => {

        status.textContent =
          "Ao vivo";

        video.play().catch(() => {});

      },
      { once: true }
    );


    video.addEventListener(
      "error",
      () => {

        mostrarErro(
          "Não foi possível reproduzir este canal."
        );

      }
    );


    return;

  }


  /*
  ==================================================
  CHROME / ANDROID / EDGE / FIREFOX
  HLS.JS
  ==================================================
  */

  if (
    window.Hls &&
    Hls.isSupported()
  ) {

    status.textContent =
      "Conectando ao canal...";


    const hls =
      new Hls({

        enableWorker: true,

        lowLatencyMode: true,

        backBufferLength: 30,

        maxBufferLength: 30,

        maxMaxBufferLength: 60

      });


    /*
      Carrega o arquivo M3U8.
    */

    hls.loadSource(
      streamUrl
    );


    /*
      Liga o HLS ao elemento <video>.
    */

    hls.attachMedia(
      video
    );


    /*
      Manifest carregado.
    */

    hls.on(
      Hls.Events.MANIFEST_PARSED,
      () => {

        status.textContent =
          "Ao vivo";

        video.play().catch(() => {

          status.textContent =
            "Canal carregado. Toque em ▶ para iniciar.";

        });

      }
    );


    /*
      Tratamento dos erros HLS.
    */

    hls.on(
      Hls.Events.ERROR,
      (event, data) => {

        console.error(
          "HLS ERROR:",
          data
        );


        if (!data.fatal) {

          return;

        }


        switch (data.type) {


          case Hls.ErrorTypes.NETWORK_ERROR:

            status.textContent =
              "Problema de conexão. Tentando reconectar...";


            /*
              Tenta recuperar conexão.
            */

            hls.startLoad();

            break;


          case Hls.ErrorTypes.MEDIA_ERROR:

            status.textContent =
              "Recuperando transmissão...";


            /*
              Tenta recuperar o elemento de mídia.
            */

            hls.recoverMediaError();

            break;


          default:

            mostrarErro(
              "Não foi possível reproduzir este canal."
            );


            hls.destroy();

            break;

        }

      }
    );


    /*
      Limpa o HLS quando sair da página.
    */

    window.addEventListener(
      "beforeunload",
      () => {

        hls.destroy();

      }
    );


    return;

  }


  /*
  ==================================================
  NAVEGADOR SEM SUPORTE
  ==================================================
  */

  mostrarErro(
    "Este navegador não possui suporte para reprodução HLS."
  );

}


/*
==================================================
ERRO
==================================================
*/

function mostrarErro(mensagem) {

  status.textContent =
    mensagem;

  status.className =
    "error";

}


/*
==================================================
VOLTAR
==================================================
*/

function voltar() {

  window.location.href =
    "index.html";

}


</script>

</body>

</html>
