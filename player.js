const video = document.getElementById("video");
const titleElement = document.getElementById("title");
const statusElement = document.getElementById("status");
const errorElement = document.getElementById("error");

const user =
  sessionStorage.getItem("mp_user");

const streamId =
  sessionStorage.getItem("mp_stream_id");

const streamName =
  sessionStorage.getItem("mp_stream_name") ||
  "MultiPlay";

const streamType =
  sessionStorage.getItem("mp_stream_type") ||
  "filme";

const streamImage =
  sessionStorage.getItem("mp_stream_image") ||
  "";

const streamExtension =
  sessionStorage.getItem("mp_stream_extension") ||
  "";

const resumePosition =
  Number(
    sessionStorage.getItem("mp_resume_position") || 0
  );

const historyKey =
  `multiplay_history_${user || "guest"}`;

let hls = null;
let lastSavedPosition = 0;


/* ==============================
   SESSÃO
================================ */

if (!user) {

  window.location.href =
    "/login.html";

}


/* ==============================
   TÍTULO
================================ */

if (titleElement) {

  titleElement.textContent =
    streamName;

}


/* ==============================
   HISTÓRICO
================================ */

function getHistory() {

  try {

    const history =
      JSON.parse(
        localStorage.getItem(
          historyKey
        ) || "[]"
      );

    return Array.isArray(history)
      ? history
      : [];

  } catch {

    return [];

  }

}


function saveHistory(history) {

  localStorage.setItem(

    historyKey,

    JSON.stringify(
      history.slice(0, 100)
    )

  );

}


function registerHistory() {

  if (
    !streamId ||
    !user
  ) {

    return;

  }


  const history =
    getHistory();


  const existing =
    history.find(

      item =>

        String(item.id) ===
          String(streamId) &&

        item.type ===
          streamType

    );


  if (existing) {

    existing.name =
      streamName;

    existing.image =
      streamImage ||
      existing.image ||
      "";

    existing.extension =
      streamExtension ||
      existing.extension ||
      "";

    existing.updatedAt =
      Date.now();

  } else {

    history.unshift({

      id:
        String(streamId),

      name:
        streamName,

      image:
        streamImage,

      type:
        streamType,

      extension:
        streamExtension,

      position:
        resumePosition || 0,

      duration:
        0,

      updatedAt:
        Date.now()

    });

  }


  saveHistory(history);

}


/* ==============================
   SALVAR PROGRESSO
================================ */

function saveProgress() {

  if (

    !streamId ||

    !video ||

    !Number.isFinite(
      video.currentTime
    )

  ) {

    return;

  }


  const position =
    Number(
      video.currentTime
    ) || 0;


  const duration =
    Number(
      video.duration
    ) || 0;


  const history =
    getHistory();


  const item =
    history.find(

      x =>

        String(x.id) ===
          String(streamId) &&

        x.type ===
          streamType

    );


  if (!item) {

    return;

  }


  item.position =
    position;


  item.duration =
    Number.isFinite(duration)

      ? duration

      : item.duration || 0;


  item.extension =
    streamExtension ||
    item.extension ||
    "";


  item.updatedAt =
    Date.now();


  saveHistory(history);


  lastSavedPosition =
    position;

}


/* ==============================
   RESTAURAR POSIÇÃO
================================ */

function restorePosition() {

  if (

    !video ||

    !resumePosition ||

    streamType ===
      "canal"

  ) {

    return;

  }


  try {

    if (

      Number.isFinite(
        video.duration
      ) &&

      video.duration >
        resumePosition

    ) {

      video.currentTime =
        resumePosition;

    }

  } catch (error) {

    console.warn(

      "Não foi possível restaurar posição:",

      error

    );

  }

}


/* ==============================
   STATUS
================================ */

function setStatus(message) {

  if (statusElement) {

    statusElement.textContent =
      message;

  }

}


function showError(message) {

  if (errorElement) {

    errorElement.textContent =
      message;

    errorElement.style.display =
      "block";

  }


  setStatus("");

}


function hideError() {

  if (errorElement) {

    errorElement.style.display =
      "none";

  }

}


/* ==============================
   EXTENSÃO
================================ */

function normalizeExtension(
  extension
) {

  if (!extension) {

    return "";

  }


  let value =
    String(
      extension
    )
      .trim()
      .toLowerCase();


  value =
    value.replace(
      /^\./,
      ""
    );


  return value;

}


/* ==============================
   URL DO PLAYER
================================ */

function buildPlayerUrl() {

  if (
    !user ||
    !streamId
  ) {

    return null;

  }


  const params =
    new URLSearchParams();


  params.set(
    "user",
    user
  );


  params.set(
    "stream_id",
    String(streamId)
  );


  params.set(
    "type",
    streamType
  );


  const extension =
    normalizeExtension(
      streamExtension
    );


  if (extension) {

    params.set(
      "extension",
      extension
    );

  }


  return `/api/media?${params.toString()}`;

}


/* ==============================
   REPRODUÇÃO
================================ */

async function initializePlayer() {

  if (!video) {

    return;

  }


  if (!user) {

    window.location.href =
      "/login.html";

    return;

  }


  if (!streamId) {

    showError(
      "Não foi possível identificar o conteúdo."
    );

    return;

  }


  registerHistory();


  const playerUrl =
    buildPlayerUrl();


  if (!playerUrl) {

    showError(
      "Não foi possível preparar a reprodução."
    );

    return;

  }


  hideError();


  setStatus(
    "Conectando ao conteúdo..."
  );


  /*
    CANAIS

    Canais normalmente usam HLS.
  */

  if (
    streamType ===
      "canal"
  ) {

    initializeHls(
      playerUrl
    );

    return;

  }


  /*
    FILMES E EPISÓDIOS
  */

  video.src =
    playerUrl;


  video.addEventListener(

    "loadedmetadata",

    () => {

      setStatus(
        "Reprodução iniciada."
      );


      hideError();


      restorePosition();


      video.play()
        .catch(
          () => {}
        );

    },

    {
      once: true
    }

  );


  video.addEventListener(

    "canplay",

    () => {

      if (
        statusElement &&
        statusElement.textContent !==
          "Reprodução iniciada."
      ) {

        setStatus(
          "Conteúdo pronto."
        );

      }

    },

    {
      once: true
    }

  );

}


/* ==============================
   HLS
================================ */

function initializeHls(
  playerUrl
) {

  if (
    !video ||
    !playerUrl
  ) {

    return;

  }


  if (
    window.Hls &&
    Hls.isSupported()
  ) {

    hls =
      new Hls({

        enableWorker:
          true,

        lowLatencyMode:
          true,

        backBufferLength:
          30

      });


    hls.loadSource(
      playerUrl
    );


    hls.attachMedia(
      video
    );


    hls.on(

      Hls.Events.MANIFEST_PARSED,

      () => {

        setStatus(
          "Reprodução iniciada."
        );


        hideError();


        video.play()
          .catch(
            () => {}
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
          "Erro HLS:",
          data
        );


        if (
          data &&
          data.fatal
        ) {

          showError(
            "Não foi possível reproduzir este canal."
          );


          try {

            hls.destroy();

          } catch {}


          hls = null;

        }

      }

    );


    return;

  }


  /* ==============================
     HLS NATIVO
  ================================ */

  if (

    video.canPlayType(

      "application/vnd.apple.mpegurl"

    )

  ) {

    video.src =
      playerUrl;


    video.addEventListener(

      "loadedmetadata",

      () => {

        setStatus(
          "Reprodução iniciada."
        );


        hideError();


        video.play()
          .catch(
            () => {}
          );

      },

      {
        once: true
      }

    );


    return;

  }


  showError(
    "Este dispositivo não suporta reprodução HLS."
  );

}


/* ==============================
   EVENTOS DO VÍDEO
================================ */

if (video) {


  video.addEventListener(

    "timeupdate",

    () => {

      if (
        streamType ===
          "canal"
      ) {

        return;

      }


      const current =
        Number(
          video.currentTime
        ) || 0;


      if (

        current -
          lastSavedPosition >=
        5

      ) {

        saveProgress();

      }

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

      if (
        streamType ===
          "canal"
      ) {

        return;

      }


      saveProgress();


      const history =
        getHistory();


      const item =
        history.find(

          x =>

            String(x.id) ===
              String(streamId) &&

            x.type ===
              streamType

        );


      if (item) {

        item.position =
          0;


        item.updatedAt =
          Date.now();


        saveHistory(
          history
        );

      }

    }

  );


  video.addEventListener(

    "error",

    () => {

      showError(
        "Não foi possível reproduzir este conteúdo."
      );

    }

  );

}


/* ==============================
   VOLTAR
================================ */

function goBack() {

  saveProgress();


  if (hls) {

    try {

      hls.destroy();

    } catch {}


    hls = null;

  }


  if (video) {

    try {

      video.pause();

    } catch {}

  }


  window.location.href =
    "/app.html";

}


/* ==============================
   SAÍDA DA PÁGINA
================================ */

window.addEventListener(

  "pagehide",

  () => {

    saveProgress();


    if (hls) {

      try {

        hls.destroy();

      } catch {}


      hls = null;

    }

  }

);


/* ==============================
   INICIAR
================================ */

initializePlayer();
