const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const XTREAM_HOST = 'http://u.l0.ms';

// 1. Servir arquivos estáticos (index.html, login.html, etc)
app.use(express.static(__dirname));

// 2. Rota da API - pega canais do Xtream
app.get('/api/canais', async (req, res) => {
  const { user, pass } = req.query;
  if(!user || !pass) return res.status(400).json({error: 'Falta user e pass'});

  try {
    const url = `${XTREAM_HOST}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`;
    console.log('Buscando:', url);
    const response = await fetch(url);
    const data = await response.json();
    
    // Se retornou user_info com auth 0 = senha errada
    if(data.user_info && data.user_info.auth === 0){
      return res.status(401).json({error: 'Usuário ou senha inválidos'});
    }

    res.json(data);
  } catch (e) {
    console.error('Erro Xtream:', e);
    res.status(500).json({error: 'Erro ao conectar no painel Xtream: ' + e.message});
  }
});

// 3. Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.listen(PORT, () => {
  console.log(`Multiplay rodando na porta ${PORT}`);
});
