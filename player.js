const video = document.getElementById("video");
const titulo = document.getElementById("titulo");
const status = document.getElementById("status");
const erro = document.getElementById("erro");

const user = sessionStorage.getItem("mp_user");
const pass = sessionStorage.getItem("mp_pass");
const streamId = sessionStorage.getItem("mp_stream_id");
const streamName = sessionStorage.getItem("mp_stream_name");

const server = sessionStorage.getItem("mp_server") || "http://u.l0.ms";

function mostrarErro(mensagem) {
  status.style.display = "none";
  erro.style.display = "block";
  erro.textContent = mensagem;
}

function voltar() {
  window.location.href = "index.html";
}

// Verifica se existe uma sessão válida
if (!user || !pass || !streamId) {
  mostrarErro("Sessão inválida. Faça login novamente.");
} else {

  titulo.textContent = streamName || "Multiplay";

  const streamUrl =
    `${server}/live/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${encodeURIComponent(streamId)}.m3u8`;

  console.log("Stream:", streamUrl);

  // Chrome, Android, Edge e Firefox
  if (window.Hls && Hls.isSupported()) {

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      status.textContent = "Transmissão carregada.";

      video.play().catch(() => {
        status.textContent = "Toque no botão ▶ para iniciar.";
      });
    });

    hls.on(Hls.Events.ERROR, function (event, data) {
      console.error("Erro HLS:", data);

      if (data.fatal) {

        switch (data.type) {

          case Hls.ErrorTypes.NETWORK_ERROR:
            status.textContent = "Erro de conexão. Tentando novamente...";
            hls.startLoad();
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            status.textContent = "Recuperando transmissão...";
            hls.recoverMediaError();
            break;

          default:
            mostrarErro("Não foi possível reproduzir este canal.");
            hls.destroy();
            break;
        }
      }
    });

  }

  // Safari / iPhone / iPad
  else if (video.canPlayType("application/vnd.apple.mpegurl")) {

    video.src = streamUrl;

    video.addEventListener("loadedmetadata", function () {
      status.textContent = "Transmissão carregada.";

      video.play().catch(() => {
        status.textContent = "Toque no botão ▶ para iniciar.";
      });
    });

    video.addEventListener("error", function () {
      mostrarErro("Não foi possível reproduzir este canal.");
    });

  }

  // Navegador sem suporte
  else {
    mostrarErro("Seu navegador não suporta reprodução HLS.");
  }
}
