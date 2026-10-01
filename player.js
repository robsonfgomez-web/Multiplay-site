// Multiplay 2.0 - Player Oficial
const user = localStorage.getItem('mp_user');
const pass = localStorage.getItem('mp_pass');

if (!user || !pass) {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('bemvindo');
  if (el) el.innerText = `Bem-vindo, ${user}!`;
  carregarCanais();
});

async function carregarCanais() {
  const container = document.getElementById('canais');
  if (!container) return;

  container.innerHTML = '<p style="color:#8892a6;padding:20px">📡 Carregando canais...</p>';

  try {
    // Usa a rota do seu próprio servidor (sem erro de CORS)
    const res = await fetch(`/api/canais?user=${user}&pass=${pass}`);
    if (!res.ok) throw new Error('Falha no servidor');

    const canais = await res.json();

    if (!Array.isArray(canais) || canais.length === 0) {
      container.innerHTML = '<p style="color:#ff5a5a">Nenhum canal encontrado. Verifique seu usuário e senha em login.html</p>';
      return;
    }

    container.innerHTML = canais.slice(0, 80).map(c => `
      <div onclick="abrirCanal('${c.stream_id}')" style="background:#151a25;padding:10px;border-radius:12px;border:1px solid #1e2432;cursor:pointer;transition:0.2s" onmouseover="this.style.borderColor='#0A84FF'" onmouseout="this.style.borderColor='#1e2432'">
        <img src="${c.stream_icon || ''}" style="width:100%;height:95px;object-fit:contain;background:#000;border-radius:8px" loading="lazy" onerror="this.src='https://via.placeholder.com/160x90/0B0E14/8892a6?text=TV'">
        <p style="font-size:12px;margin:8px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600">${c.name}</p>
        <span style="font-size:10px;color:#0A84FF;font-weight:800">● AO VIVO</span>
      </div>
    `).join('');

  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:#ff5a5a">Erro ao carregar: ${e.message}<br><small style="color:#8892a6">Verifique se fez login correto.</small></p>`;
  }
}

function abrirCanal(id) {
  const url = `http://u.l0.ms/live/${user}/${pass}/${id}.m3u8`;
  // Cria player simples
  const win = window.open('', '_blank');
  win.document.write(`
    <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;color:#fff;font-family:sans-serif;flex-direction:column">
      <h3 style="color:#0A84FF">Multiplay Player</h3>
      <video controls autoplay style="width:90%;max-width:900px;background:#000" src="${url}"></video>
      <p style="margin-top:15px"><a href="${
