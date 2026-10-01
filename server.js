const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const XTREAM_HOST = 'http://u.l0.ms';

app.use(express.static(__dirname));

// --- CORREÇÃO DO ERRO Cannot GET /index.html ---
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
// --- FIM DA CORREÇÃO ---

app.get('/api/canais', async (req, res) => {
  const { user, pass } = req.query;
  if(!user || !pass) return res.status(400).json({error: 'Falta user e pass'});
  try {
    const url = `${XTREAM_HOST}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`;
    const response = await fetch(url);
    const data = await response.json();
    if(data.user_info && data.user_info.auth === 0){
      return res.status(401).json({error: 'Usuário ou senha inválidos'});
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

app.listen(PORT, () => console.log(`Rodando na ${PORT}`));
