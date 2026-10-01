const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const XTREAM_HOST = 'http://u.l0.ms';

app.use(express.static(__dirname));


// ===============================
// PÁGINA INICIAL
// ===============================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});


// ===============================
// LOGIN
// ===============================

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});


// ===============================
// ÁREA DE CANAIS
// ===============================

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// ===============================
// PLAYER
// ===============================

app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'player.html'));
});


// ===============================
// API DE CANAIS
// ===============================

app.get('/api/canais', async (req, res) => {

  const { user, pass } = req.query;

  if (!user || !pass) {
    return res.status(400).json({
      error: 'Falta usuário ou senha'
    });
  }

  try {

    const url =
      `${XTREAM_HOST}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({
        error: 'Servidor de canais indisponível'
      });
    }

    const data = await response.json();

    if (data.user_info && data.user_info.auth === 0) {
      return res.status(401).json({
        error: 'Usuário ou senha inválidos'
      });
    }

    return res.json(data);

  } catch (error) {

    console.error('Erro ao buscar canais:', error);

    return res.status(500).json({
      error: 'Erro ao conectar ao servidor de canais'
    });
  }
});


// ===============================
// INICIAR SERVIDOR
// ===============================

app.listen(PORT, () => {
  console.log(`Multiplay rodando na porta ${PORT}`);
});
