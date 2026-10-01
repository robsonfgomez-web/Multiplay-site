const video = document.getElementById("video");
const titleElement = document.getElementById("title");
const statusElement = document.getElementById("status");
const errorElement = document.getElementById("error");

const user = sessionStorage.getItem("mp_user");
const pass = sessionStorage.getItem("mp_pass");

const streamId = sessionStorage.getItem("mp_stream_id");
const streamName =
  sessionStorage.getItem("mp_stream_name") ||
  "MultiPlay";

const streamType =
  sessionStorage.getItem("mp_stream_type") ||
  "channel";

const resumeId =
  sessionStorage.getItem("mp_resume_id");

const resumePosition =
  Number(
    sessionStorage.getItem("mp_resume_position") || 0
  );


/*
==================================================
VERIFICAR SESSÃO
==================================================
*/

if (!user || !pass) {
  window.location.href = "/login.html";
}


/*
==================================================
TÍTULO
==================================================
*/

if (titleElement) {
  titleElement.textContent = streamName;
}


/*
==================================================
HISTÓRICO
==================================================
*/

const HISTORY_KEY = "multiplay_history";


function getHistory() {

  try {

    return JSON.parse(
      localStorage.getItem(HISTORY_KEY)
    ) || [];

  } catch {

    return [];

  }

}


function saveHistory(history) {

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history)
  );

}


/*
==================================================
SALVAR PROGRESSO
==================================================
*/

function saveProgress() {

  /*
  Canais ao vivo não possuem
  uma posição útil para retomar.
  */

  if (
    streamType === "channel"
  ) {
    return;
  }


  if (!video) {
    return;
  }


  const duration =
    Number(video.duration || 0);

  const position =
    Number(video.currentTime || 0);


  if (
    !duration ||
    !position
  ) {
    return;
  }


  const id =
    streamId ||
    resumeId;


  if (!id) {
    return;
  }


  const history =
    getHistory();


  const index =
    history.findIndex(
      item =>
        String(item.id) ===
        String(id)
    );


  const percent =
    duration > 0
      ? Math.round(
          (position / duration) * 100
        )
      : 0;


  const existing =
    index >= 0
      ? history[index]
      : {};


  const record = {

    id: id,

    type:
      existing.type ||
      streamType ||
      "movie",

    title:
      existing.title ||
      streamName,

    image:
      existing.image ||
      "",

    position:
      position,

    duration:
      duration,

    percent:
      percent,

    timestamp:
      Date.now()

  };


  if (index >= 0) {

    history.splice(
      index,
      1
    );

  }


  history.unshift(
    record
  );


  /*
  Mantém somente os
  30 últimos conteúdos.
  */

  saveHistory(
    history.slice(0, 30)
  );

}


/*
==================================================
MARCAR COMO CONCLUÍDO
==================================================
*/

function markAsFinished() {

  if (!video) {
    return;
  }


  const id =
    streamId ||
    resumeId;


  if (!id) {
    return;
  }


  const history =
    getHistory();


  const index =
    history.findIndex(
      item =>
        String(item.id) ===
        String(id)
    );


  if (index === -1) {
    return;
  }


  history[index].position =
    0;

  history[index].percent =
    100;

  history[index].timestamp =
    Date.now();


  saveHistory(history);

}


/*
==================================================
SALVAR PERIODICAMENTE
==================================================
*/

let saveTimer =
  setInterval(
    saveProgress,
    5000
  );


/*
==================================================
EVENTOS DO VÍDEO
==================================================
*/

if (video) {

  video.addEventListener(
    "timeupdate",
    () => {

      /*
      Não grava a cada milissegundo.
      O intervalo acima faz o salvamento.
      */

    }
  );


  video.addEventListener(
    "pause",
    () => {

      saveProgress();

    }
  );


  video.addEventListener(
    "ended",
    () => {

      markAsFinished();

    }
  );


  window.addEventListener(
    "beforeunload",
    () => {

      saveProgress();

    }
  );

}


/*
==================================================
RETOMAR POSIÇÃO
==================================================
*/

let resumeApplied =
  false;


function applyResumePosition() {

  if (resumeApplied) {
    return;
  }


  if (!video) {
    return;
  }


  if (
    streamType === "channel"
  ) {
    resumeApplied = true;
    return;
  }


  if (
    !resumePosition ||
    resumePosition < 5
  ) {
    resumeApplied = true;
    return;
  }


  try {

    if (
      video.duration &&
      isFinite(video.duration) &&
      resumePosition < video.duration - 5
    ) {

      video.currentTime =
        resumePosition;

      resumeApplied = true;


      if (statusElement) {

        statusElement.textContent =
          "Continuando de onde você parou...";

        setTimeout(
          () => {

            if (statusElement) {

              statusElement.textContent =
                "Reprodução iniciada";

            }

          },
          2500
        );

      }

    }

  } catch (error) {

    console.error(
      "Erro ao retomar:",
      error
    );

  }

}


/*
==================================================
URL DO CONTEÚDO
==================================================
*/

function buildStreamUrl() {

  /*
  Conteúdo autorizado pelo servidor
  configurado no MultiPlay.
  */

  if (
    !user ||
    !pass ||
    !streamId
  ) {

    return null;

  }


  const server =
    "http://u.l0.ms";


  /*
  Canais ao vivo
  */

  if (
    streamType === "channel"
  ) {

    return (
      `${server}/live/` +
      `${encodeURIComponent(user)}/` +
      `${encodeURIComponent(pass)}/` +
      `${encodeURIComponent(streamId)}.m3u8`
    );

  }


  /*
  Filmes VOD
  */

  return (
    `${server}/movie/` +
    `${encodeURIComponent(user)}/` +
    `${encodeURIComponent(pass)}/` +
    `${encodeURIComponent(streamId)}.mp4`
  );

}


/*
==================================================
ERRO
==================================================
*/

function showError(message) {

  if (errorElement) {

    errorElement.textContent =
      message;

    errorElement.style.display =
      "block";

  }

  if (statusElement) {

    statusElement.textContent =
      "";

  }

}


/*
==================================================
INICIALIZAR PLAYER
==================================================
*/

async function initializePlayer() {

  if (!video) {

    console.error(
      "Elemento de vídeo não encontrado."
    );

    return;

  }


  const source =
    buildStreamUrl();


  if (!source) {

    showError(
      "Não foi possível localizar o conteúdo."
    );

    return;

  }


  if (statusElement) {

    statusElement.textContent =
      "Carregando conteúdo...";

  }


  /*
  ================================================
  HLS.JS
  ================================================
  */

  if (
    window.Hls &&
    Hls.isSupported()
  ) {

    const hls =
      new Hls({

        enableWorker: true,

        lowLatencyMode: true,

        backBufferLength: 30,

        maxBufferLength: 30,

        maxMaxBufferLength: 60

      });


    hls.loadSource(
      source
    );


    hls.attachMedia(
      video
    );


    hls.on(
      Hls.Events.MANIFEST_PARSED,
      () => {

        if (statusElement) {

          statusElement.textContent =
            "Conteúdo carregado";

        }


        /*
        Só tenta continuar
        depois que o vídeo
        estiver pronto.
        */

        applyResumePosition();


        video.play()
          .catch(
            () => {

              if (statusElement) {

                statusElement.textContent =
                  "Toque em reproduzir para iniciar.";

              }

            }
          );

      }
    );


    hls.on(
      Hls.Events.ERROR,
      (
        event,
        data
      ) => {

        console.error(
          "HLS error:",
          data
        );


        if (
          data.fatal
        ) {

          if (
            data.type ===
            Hls.ErrorTypes.NETWORK_ERROR
          ) {

            hls.startLoad();

            if (statusElement) {

              statusElement.textContent =
                "Reconectando...";

            }

          } else if (
            data.type ===
            Hls.ErrorTypes.MEDIA_ERROR
          ) {

            hls.recoverMediaError();

          } else {

            showError(
              "Não foi possível reproduzir este conteúdo."
            );

          }

        }

      }
    );


    /*
    Guarda referência
    para liberar memória.
    */

    window.multiPlayHls =
      hls;


    return;

  }


  /*
  ================================================
  SAFARI / IOS / HLS NATIVO
  ================================================
  */

  if (
    video.canPlayType(
      "application/vnd.apple.mpegurl"
    )
  ) {

    video.src =
      source;


    video.addEventListener(
      "loadedmetadata",
      () => {

        if (statusElement) {

          statusElement.textContent =
            "Conteúdo carregado";

        }


        applyResumePosition();


        video.play()
          .catch(
            () => {

              if (statusElement) {

                statusElement.textContent =
                  "Toque em reproduzir para iniciar.";

              }

            }
          );

      },
      {
        once: true
      }
    );


    return;

  }


  /*
  ================================================
  FORMATO NÃO SUPORTADO
  ================================================
  */

  showError(
    "Este dispositivo não suporta este formato de vídeo."
  );

}


/*
==================================================
VOLTAR
==================================================
*/

function goBack() {

  saveProgress();


  if (
    window.multiPlayHls
  ) {

    try {

      window.multiPlayHls.destroy();

    } catch {}

  }


  if (video) {

    video.pause();

  }


  window.location.href =
    "/app.html";

}


/*
==================================================
LIMPEZA
==================================================
*/

window.addEventListener(
  "pagehide",
  () => {

    saveProgress();


    if (
      window.multiPlayHls
    ) {

      try {

        window.multiPlayHls.destroy();

      } catch {}

    }

  }
);


/*
==================================================
INICIAR
==================================================
*/

initializePlayer();
