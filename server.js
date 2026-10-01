const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('.'));

// Rota para pegar canais sem erro de CORS
app.get('/api/canais', async (req, res) => {
  const { user, pass } = req.query;
  if (!user || !pass) {
    return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  }
  const server = 'http://u.l0.ms';
  const url = `${server}/player_api.php?username=${user}&password=${pass}&action=get_live_streams`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao conectar no servidor Xtream' });
  }
});

// Rota para filmes
app.get('/api/filmes', async (req, res) => {
  const { user, pass } = req.query;
  const server = 'http://u.l0.ms';
  const url = `${server}/player_api.php?username=${user}&password=${pass}&action=get_vod_streams`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar filmes' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.listen(PORT, () => {
  console.log('Multiplay 2.0 rodando na porta ' + PORT);
});
