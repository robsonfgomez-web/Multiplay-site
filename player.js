const video = document.getElementById("video");
const titleElement = document.getElementById("title");
const statusElement = document.getElementById("status");
const errorElement = document.getElementById("error");

const user = sessionStorage.getItem("mp_user");
const pass = sessionStorage.getItem("mp_pass");

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

const resumePosition =
  Number(
    sessionStorage.getItem("mp_resume_position") || 0
  );

const historyKey = "multiplay_history";

let hls = null;
let lastSavedPosition = 0;


/* ==============================
   SESSÃO
================================ */

if (!user || !pass) {
  window.location.href = "/login.html";
}


/* ==============================
   TÍTULO
================================ */

if (titleElement) {
  titleElement.textContent = streamName;
}


/* ==============================
   HISTÓRICO
================================ */

function getHistory() {

  try {

    const history =
      JSON.parse(
        localStorage.getItem(historyKey) || "[]"
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

  if (!streamId) {
    return;
  }

  const history =
    getHistory();

  const existing =
    history.find(
      item =>
        String(item.id) ===
          String(streamId) &&
        item.type === streamType
    );

  if (existing) {

    existing.name =
      streamName;

    existing.image =
      streamImage ||
      existing.image ||
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
    !Number.isFinite(video.currentTime)
  ) {
    return;
  }

  const position =
    Number(video.currentTime) || 0;

  const duration =
    Number(video.duration) || 0;

  const history =
    getHistory();

  const item =
    history.find(
      x =>
        String(x.id) ===
          String(streamId) &&
        x.type === streamType
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

  item.updatedAt =
    Date.now();

  saveHistory(history);

  lastSavedPosition =
    position;

}


/* ==============================
   POSIÇÃO INICIAL
================================ */

function restorePosition() {

  if (
    !video ||
    !resumePosition ||
    streamType === "canal"
  ) {
    return;
  }

  try {

    if (
      Number.isFinite(video.duration) &&
      video.duration > resumePosition
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


/* ==============================
   URL DO STREAM
================================ */

function buildStreamUrl() {

  if (!streamId) {
    return null;
  }

  if (!user || !pass) {
    return null;
  }

  /*
    Conteúdo deve ser reproduzido
    somente quando o usuário possui
    autorização de acesso.
  */

  if (streamType === "canal") {

    return (
      "http://u.l0.ms/live/" +
      encodeURIComponent(user) +
      "/" +
      encodeURIComponent(pass) +
      "/" +
      encodeURIComponent(streamId) +
      ".m3u8"
    );

  }

  return (
    "http://u.l0.ms/movie/" +
    encodeURIComponent(user) +
    "/" +
    encodeURIComponent(pass) +
    "/" +
    encodeURIComponent(streamId) +
    ".mp4"
  );

}


/* ==============================
   REPRODUÇÃO
================================ */

function initializePlayer() {

  if (!video) {
    return;
  }

  registerHistory();

  const streamUrl =
    buildStreamUrl();

  if (!streamUrl) {

    showError(
      "Não foi possível identificar este conteúdo."
    );

    return;
  }

  setStatus(
    "Conectando ao conteúdo..."
  );

  /*
    HLS
  */

  if (
    streamUrl.includes(".m3u8") &&
    window.Hls &&
    Hls.isSupported()
  ) {

    hls =
      new Hls({
        enableWorker: true,
        lowLatencyMode:
          streamType === "canal"
      });

    hls.loadSource(
      streamUrl
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

        restorePosition();

        video.play()
          .catch(() => {});

      }
    );

    hls.on(
      Hls.Events.ERROR,
      (event, data) => {

        console.error(
          "HLS:",
          data
        );

        if (
          data &&
          data.fatal
        ) {

          showError(
            "Não foi possível reproduzir este conteúdo."
          );

        }

      }
    );

    return;
  }


  /*
    Safari / HLS nativo
  */

  if (
    streamUrl.includes(".m3u8") &&
    video.canPlayType(
      "application/vnd.apple.mpegurl"
    )
  ) {

    video.src =
      streamUrl;

    video.addEventListener(
      "loadedmetadata",
      () => {

        setStatus(
          "Reprodução iniciada."
        );

        restorePosition();

        video.play()
          .catch(() => {});

      },
      { once: true }
    );

    return;
  }


  /*
    MP4
  */

  video.src =
    streamUrl;

  video.addEventListener(
    "loadedmetadata",
    () => {

      setStatus(
        "Reprodução iniciada."
      );

      restorePosition();

      video.play()
        .catch(() => {});

    },
    { once: true }
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
        streamType === "canal"
      ) {
        return;
      }

      const current =
        Number(video.currentTime) || 0;

      /*
        Salva aproximadamente
        a cada 5 segundos.
      */

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
        streamType === "canal"
      ) {
        return;
      }

      saveProgress();

      /*
        Quando terminou,
        mantém no histórico,
        mas zera a posição.
      */

      const history =
        getHistory();

      const item =
        history.find(
          x =>
            String(x.id) ===
              String(streamId) &&
            x.type === streamType
        );

      if (item) {

        item.position =
          0;

        item.updatedAt =
          Date.now();

        saveHistory(history);

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
