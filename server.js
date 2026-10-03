const express = require('express');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================
   CONFIGURAÇÃO
========================= */

const SESSION_SECRET = crypto
  .createHash('sha256')
  .update(
    process.env.DATABASE_URL ||
    'multiplay-session-secret'
  )
  .digest('hex');

const ADMIN_SESSION_MAX_AGE =
  8 * 60 * 60 * 1000;

app.use(express.json());

/* Evita que celulares mantenham uma versão antiga das páginas HTML */
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use((req,res,next)=>{res.set('X-Multiplay-Version','educacao-v2026-10-02-final');next();});

app.use(express.static(__dirname));

/* =========================
   BANCO
========================= */

pool.query('SELECT NOW()')
  .then(() => {
    console.log(
      'MultiPlay: banco conectado com sucesso'
    );
  })
  .catch((error) => {
    console.error(
      'MultiPlay: erro ao conectar ao banco:',
      error.message
    );
  });

/* =========================
   PÁGINAS
========================= */

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'index.html')
  );
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/entretenimento.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'entretenimento.html'));
});

// Alias sem extensão para facilitar acesso por links, APK e navegador.
app.get('/entretenimento', (req, res) => {
  res.sendFile(path.join(__dirname, 'entretenimento.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'login.html')
  );
});

app.get('/admin.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'admin.html')
  );
});

app.get('/player.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'player.html')
  );
});

app.get('/assinatura.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'assinatura.html'));
});

app.get('/loja.html', (req, res) => {
  res.redirect(301, '/educacao.html');
});

app.get('/educacao', (req, res) => {
  res.sendFile(path.join(__dirname, 'educacao.html'));
});

/* =========================
   HASH DE SENHA
========================= */

function gerarHashSenha(senha) {
  const salt =
    crypto.randomBytes(16).toString('hex');

  const hash =
    crypto
      .scryptSync(senha, salt, 64)
      .toString('hex');

  return `${salt}:${hash}`;
}

function verificarSenha(
  senha,
  passwordHash
) {
  if (
    !passwordHash ||
    !passwordHash.includes(':')
  ) {
    return false;
  }

  const partes =
    passwordHash.split(':');

  const salt = partes[0];
  const hashArmazenado = partes[1];

  const hashInformado =
    crypto
      .scryptSync(senha, salt, 64)
      .toString('hex');

  return hashInformado === hashArmazenado;
}

/* =========================
   SESSÃO ADMIN
========================= */

function criarTokenAdmin(admin) {
  const payload = {
    id: admin.id,
    username: admin.username,
    type: 'admin',
    exp:
      Date.now() +
      ADMIN_SESSION_MAX_AGE
  };

  const texto =
    Buffer
      .from(JSON.stringify(payload))
      .toString('base64url');

  const assinatura =
    crypto
      .createHmac(
        'sha256',
        SESSION_SECRET
      )
      .update(texto)
      .digest('base64url');

  return `${texto}.${assinatura}`;
}

function verificarTokenAdmin(token) {
  if (!token) {
    return null;
  }

  const partes =
    token.split('.');

  if (partes.length !== 2) {
    return null;
  }

  const texto = partes[0];
  const assinatura = partes[1];

  const assinaturaEsperada =
    crypto
      .createHmac(
        'sha256',
        SESSION_SECRET
      )
      .update(texto)
      .digest('base64url');

  if (
    assinatura.length !==
    assinaturaEsperada.length
  ) {
    return null;
  }

  if (
    !crypto.timingSafeEqual(
      Buffer.from(assinatura),
      Buffer.from(assinaturaEsperada)
    )
  ) {
    return null;
  }

  try {
    const payload =
      JSON.parse(
        Buffer
          .from(texto, 'base64url')
          .toString('utf8')
      );

    if (
      !payload.exp ||
      Date.now() > payload.exp
    ) {
      return null;
    }

    if (payload.type !== 'admin') {
      return null;
    }

    return payload;

  } catch (error) {
    return null;
  }
}

function obterCookie(req, nome) {
  const cookies =
    req.headers.cookie;

  if (!cookies) {
    return null;
  }

  const partes =
    cookies.split(';');

  for (const parte of partes) {
    const [chave, ...valor] =
      parte.trim().split('=');

    if (chave === nome) {
      return decodeURIComponent(
        valor.join('=')
      );
    }
  }

  return null;
}

function exigirAdmin(req, res, next) {
  const token =
    obterCookie(
      req,
      'mp_admin_session'
    );

  const admin =
    verificarTokenAdmin(token);

  if (!admin) {
    return res.status(401).json({
      success: false,
      message:
        'Acesso administrativo não autorizado.'
    });
  }

  req.admin = admin;

  next();
}

/* =========================
   LOGIN MULTIPLAY
========================= */

app.post(
  '/api/login',
  async (req, res) => {

    const {
      username,
      password
    } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message:
          'Usuário e senha são obrigatórios.'
      });
    }

    try {

      /* =====================
         ADMIN
      ===================== */

      const adminResult =
        await pool.query(
          `SELECT
            id,
            username,
            password_hash,
            active
           FROM admins
           WHERE username = $1`,
          [username]
        );

      if (
        adminResult.rows.length > 0
      ) {

        const admin =
          adminResult.rows[0];

        if (!admin.active) {
          return res.status(403).json({
            success: false,
            message:
              'Usuário administrador desativado.'
          });
        }

        if (
          !verificarSenha(
            password,
            admin.password_hash
          )
        ) {
          return res.status(401).json({
            success: false,
            message:
              'Usuário ou senha inválidos.'
          });
        }

        const token =
          criarTokenAdmin(admin);

        res.setHeader(
          'Set-Cookie',
          [
            `mp_admin_session=${encodeURIComponent(token)}`,
            'HttpOnly',
            'Secure',
            'SameSite=Lax',
            'Path=/',
            `Max-Age=${Math.floor(
              ADMIN_SESSION_MAX_AGE / 1000
            )}`
          ].join('; ')
        );

        return res.json({
          success: true,
          message:
            'Login administrativo realizado.',
          user: {
            id: admin.id,
            username: admin.username,
            type: 'admin'
          }
        });
      }


      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos.'
      });
    } catch (e) {
      console.error('Erro no login administrativo:', e);
      return res.status(500).json({
        success: false,
        message: 'Erro ao realizar login.'
      });
    }
  }
);

/* =========================
   LOGOUT ADMIN
========================= */

app.post(
  '/api/admin/logout',
  (req, res) => {

    res.setHeader(
      'Set-Cookie',
      [
        'mp_admin_session=',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Path=/',
        'Max-Age=0'
      ].join('; ')
    );

    res.json({
      success: true
    });
  }
);

/* =========================
   ADMIN - ME
========================= */

app.get(
  '/api/admin/me',
  exigirAdmin,
  (req, res) => {

    res.json({
      success: true,
      admin: req.admin
    });
  }
);

/* =========================================================
   MULTIPLAY EDUCAÇÃO — BANCO, PAINEL E ÁREA DO ALUNO
========================================================= */
const uploadEducacao=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024},fileFilter:(req,file,cb)=>{const ok=file.mimetype==='application/pdf'||/\.pdf$/i.test(file.originalname||'');cb(ok?null:new Error('Apenas arquivos PDF são aceitos.'),ok);}});
const EDU_SESSION_MAX_AGE=30*24*60*60*1000;
function criarTokenEducacao(a){const p={id:a.id,username:a.username,type:'education_student',exp:Date.now()+EDU_SESSION_MAX_AGE};const t=Buffer.from(JSON.stringify(p)).toString('base64url');return t+'.'+crypto.createHmac('sha256',SESSION_SECRET).update(t).digest('base64url');}
function verificarTokenEducacao(token){if(!token)return null;const p=String(token).split('.');if(p.length!==2)return null;const e=crypto.createHmac('sha256',SESSION_SECRET).update(p[0]).digest('base64url');if(p[1].length!==e.length)return null;if(!crypto.timingSafeEqual(Buffer.from(p[1]),Buffer.from(e)))return null;try{const x=JSON.parse(Buffer.from(p[0],'base64url').toString('utf8'));return x.type==='education_student'&&x.exp>Date.now()?x:null;}catch(_){return null;}}
function obterTokenEducacao(req){const a=req.headers.authorization||'';return /^Bearer\s+/i.test(a)?a.replace(/^Bearer\s+/i,'').trim():obterCookie(req,'mp_edu_session');}
function exigirAlunoEducacao(req,res,next){const a=verificarTokenEducacao(obterTokenEducacao(req));if(!a)return res.status(401).json({success:false,message:'Sessão do aluno inválida ou expirada.'});req.aluno=a;next();}

async function garantirTabelasEducacao(){
 await pool.query("CREATE TABLE IF NOT EXISTS edu_students(id SERIAL PRIMARY KEY,name VARCHAR(180) NOT NULL,email VARCHAR(180) UNIQUE NOT NULL,username VARCHAR(100) UNIQUE NOT NULL,password_hash TEXT NOT NULL,phone VARCHAR(40),plan VARCHAR(80) DEFAULT 'Multiplay Educação',active BOOLEAN DEFAULT TRUE,access_until TIMESTAMP NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,last_login_at TIMESTAMP NULL); CREATE TABLE IF NOT EXISTS edu_courses(id SERIAL PRIMARY KEY,title VARCHAR(220) NOT NULL,description TEXT,category VARCHAR(100),provider VARCHAR(180),workload_hours NUMERIC(8,2) DEFAULT 0,content_url TEXT,cover_url TEXT,active BOOLEAN DEFAULT TRUE,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS edu_enrollments(id SERIAL PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES edu_students(id) ON DELETE CASCADE,course_id INTEGER NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,status VARCHAR(30) DEFAULT 'ATIVO',progress_percent NUMERIC(5,2) DEFAULT 0,minutes_studied INTEGER DEFAULT 0,enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,completed_at TIMESTAMP NULL,last_access_at TIMESTAMP NULL,UNIQUE(student_id,course_id)); CREATE TABLE IF NOT EXISTS edu_progress(id SERIAL PRIMARY KEY,enrollment_id INTEGER NOT NULL REFERENCES edu_enrollments(id) ON DELETE CASCADE,lesson_title VARCHAR(220),progress_percent NUMERIC(5,2) DEFAULT 0,minutes_studied INTEGER DEFAULT 0,metadata JSONB DEFAULT '{}'::jsonb,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS edu_certificates(id SERIAL PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES edu_students(id) ON DELETE CASCADE,course_id INTEGER REFERENCES edu_courses(id) ON DELETE SET NULL,certificate_number VARCHAR(100) UNIQUE NOT NULL,title VARCHAR(220) NOT NULL,issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,file_name VARCHAR(255),mime_type VARCHAR(100),file_data BYTEA,status VARCHAR(30) DEFAULT 'VALIDO',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS edu_activity(id BIGSERIAL PRIMARY KEY,student_id INTEGER REFERENCES edu_students(id) ON DELETE CASCADE,activity_type VARCHAR(80) NOT NULL,details JSONB DEFAULT '{}'::jsonb,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS idx_edu_enrollments_student ON edu_enrollments(student_id); CREATE INDEX IF NOT EXISTS idx_edu_activity_student ON edu_activity(student_id); CREATE INDEX IF NOT EXISTS idx_edu_activity_created ON edu_activity(created_at)");
 const cursos=[['Excel na Prática','Planilhas, fórmulas e produtividade.','TECNOLOGIA','Fundação Bradesco',16,'https://www.ev.org.br/cursos/excel-na-pratica'],['Atendimento ao Público','Comunicação e excelência no atendimento.','ADMINISTRAÇÃO','Fundação Bradesco',10,'https://www.ev.org.br/cursos/atendimento-ao-publico'],['Introdução à Administração','Fundamentos para quem quer atuar na área administrativa.','ADMINISTRAÇÃO','Fundação Bradesco',12,'https://www.ev.org.br/cursos/introducao-a-administracao'],['Introdução à Gestão de Projetos','Conceitos essenciais de gestão de projetos.','GESTÃO','Fundação Bradesco',10,'https://www.ev.org.br/cursos/introducao-a-gestao-de-projetos'],['Introdução à Análise de Dados — Power BI','Primeiros passos em análise de dados e Power BI.','TECNOLOGIA','Fundação Bradesco',5,'https://www.ev.org.br/cursos/introducao-a-analise-de-dados-microsoft-power-bi'],['Administração: fundamentos — Turma 2026B','Curso aberto e autoinstrucional.','ADMINISTRAÇÃO','Aprenda Mais • MEC / IFRS',40,'https://aprendamais.mec.gov.br/course/search.php?search=Administra%C3%A7%C3%A3o%20fundamentos'],['Elaboração e Análise de Projetos — Turma 2026B','Fundamentos de projetos.','GESTÃO','Aprenda Mais • MEC / IFRS',30,'https://aprendamais.mec.gov.br/course/search.php?search=Elabora%C3%A7%C3%A3o%20e%20An%C3%A1lise%20de%20Projetos'],['Empreendedorismo — Turma 2026B','Conceitos e práticas de empreendedorismo.','NEGÓCIOS','Aprenda Mais • MEC / IFRS',40,'https://aprendamais.mec.gov.br/course/search.php?search=Empreendedorismo'],['Gestão de Marketing — Turma 2026B','Fundamentos de marketing.','MARKETING','Aprenda Mais • MEC / IFRS',20,'https://aprendamais.mec.gov.br/course/search.php?search=Gest%C3%A3o%20de%20Marketing'],['Marketing Digital e Redes Sociais — Turma 2026B','Estratégias digitais e redes sociais.','MARKETING','Aprenda Mais • MEC / IFRS',20,'https://aprendamais.mec.gov.br/course/search.php?search=Marketing%20Digital%20e%20Redes%20Sociais']];
 for(const curso of cursos)await pool.query("INSERT INTO edu_courses(title,description,category,provider,workload_hours,content_url) SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM edu_courses WHERE title=$1)",curso);
}
garantirTabelasEducacao().then(()=>console.log('MultiPlay Educação: banco educacional verificado.')).catch(e=>console.error('MultiPlay Educação:',e.message));
app.get('/educacao-admin.html',(req,res)=>res.sendFile(path.join(__dirname,'educacao-admin.html')));

app.post('/api/educacao/login',async(req,res)=>{const{username,password}=req.body||{};if(!username||!password)return res.status(400).json({success:false,message:'Usuário e senha são obrigatórios.'});try{const q=await pool.query("SELECT id,name,email,username,password_hash,active,access_until,plan FROM edu_students WHERE username=$1 OR email=$1 LIMIT 1",[String(username).trim()]);if(!q.rows.length)return res.status(401).json({success:false,message:'Aluno não encontrado ou senha inválida.'});const a=q.rows[0];if(!a.active)return res.status(403).json({success:false,message:'Acesso do aluno desativado.'});if(a.access_until&&new Date(a.access_until)<new Date())return res.status(403).json({success:false,message:'Acesso do aluno expirado.'});if(!verificarSenha(password,a.password_hash))return res.status(401).json({success:false,message:'Aluno não encontrado ou senha inválida.'});await pool.query("UPDATE edu_students SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1",[a.id]);await pool.query("INSERT INTO edu_activity(student_id,activity_type,details) VALUES($1,'LOGIN',$2)",[a.id,JSON.stringify({platform:'app'})]);res.json({success:true,token:criarTokenEducacao(a),user:{id:a.id,name:a.name,email:a.email,username:a.username,plan:a.plan}});}catch(e){res.status(500).json({success:false,message:'Erro ao realizar login.'});}});
app.get('/api/educacao/me',exigirAlunoEducacao,async(req,res)=>{try{const q=await pool.query("SELECT id,name,email,username,phone,plan,active,access_until,created_at,last_login_at FROM edu_students WHERE id=$1",[req.aluno.id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Aluno não encontrado.'});res.json({success:true,student:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar perfil.'});}});
app.get('/api/educacao/courses',exigirAlunoEducacao,async(req,res)=>{try{const q=await pool.query("SELECT c.id,c.title,c.description,c.category,c.provider,c.workload_hours,c.content_url,c.cover_url,COALESCE(e.progress_percent,0) progress_percent,e.status enrollment_status,e.enrolled_at,e.last_access_at FROM edu_courses c LEFT JOIN edu_enrollments e ON e.course_id=c.id AND e.student_id=$1 WHERE c.active=true ORDER BY c.category,c.title",[req.aluno.id]);res.json({success:true,courses:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar cursos.'});}});
app.post('/api/educacao/enrollments/:courseId',exigirAlunoEducacao,async(req,res)=>{const id=Number(req.params.courseId);try{const c=await pool.query("SELECT id,title FROM edu_courses WHERE id=$1 AND active=true",[id]);if(!c.rows.length)return res.status(404).json({success:false,message:'Curso não encontrado.'});await pool.query("INSERT INTO edu_enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT(student_id,course_id) DO NOTHING",[req.aluno.id,id]);await pool.query("INSERT INTO edu_activity(student_id,activity_type,details) VALUES($1,'MATRICULA',$2)",[req.aluno.id,JSON.stringify({course_id:id})]);res.json({success:true,message:'Curso adicionado aos seus estudos.'});}catch(e){res.status(500).json({success:false,message:'Não foi possível matricular no curso.'});}});
app.patch('/api/educacao/enrollments/:courseId/progress',exigirAlunoEducacao,async(req,res)=>{const id=Number(req.params.courseId),p=Math.max(0,Math.min(100,Number(req.body?.progress_percent||0))),m=Math.max(0,Number(req.body?.minutes_studied||0)),lesson=String(req.body?.lesson_title||'').slice(0,220);try{const e=await pool.query("SELECT id FROM edu_enrollments WHERE student_id=$1 AND course_id=$2",[req.aluno.id,id]);if(!e.rows.length)return res.status(404).json({success:false,message:'Matrícula não encontrada.'});const eid=e.rows[0].id;await pool.query("UPDATE edu_enrollments SET progress_percent=$1,minutes_studied=minutes_studied+$2,last_access_at=NOW(),status=$3,completed_at=CASE WHEN $1>=100 THEN COALESCE(completed_at,NOW()) ELSE completed_at END WHERE id=$4",[p,m,p>=100?'CONCLUIDO':'ATIVO',eid]);await pool.query("INSERT INTO edu_progress(enrollment_id,lesson_title,progress_percent,minutes_studied,metadata) VALUES($1,$2,$3,$4,$5)",[eid,lesson,p,m,JSON.stringify({source:'app'})]);res.json({success:true,progress_percent:p});}catch(e){res.status(500).json({success:false,message:'Erro ao salvar progresso.'});}});
app.get('/api/educacao/my-certificates',exigirAlunoEducacao,async(req,res)=>{try{const q=await pool.query("SELECT c.id,c.certificate_number,c.title,c.issued_at,c.file_name,c.status,ec.title course_title FROM edu_certificates c LEFT JOIN edu_courses ec ON ec.id=c.course_id WHERE c.student_id=$1 ORDER BY c.issued_at DESC",[req.aluno.id]);res.json({success:true,certificates:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar certificados.'});}});
app.get('/api/educacao/certificates/:id/file',exigirAlunoEducacao,async(req,res)=>{try{const q=await pool.query("SELECT file_name,mime_type,file_data,status FROM edu_certificates WHERE id=$1 AND student_id=$2",[Number(req.params.id),req.aluno.id]);if(!q.rows.length||!q.rows[0].file_data)return res.status(404).json({success:false,message:'Arquivo não encontrado.'});res.setHeader('Content-Type',q.rows[0].mime_type||'application/pdf');res.setHeader('Content-Disposition','inline; filename="'+String(q.rows[0].file_name||'certificado.pdf').replace(/"/g,'')+'"');res.send(q.rows[0].file_data);}catch(e){res.status(500).json({success:false,message:'Erro ao abrir certificado.'});}});

app.get('/api/admin/educacao/dashboard',exigirAdmin,async(req,res)=>{try{const[a,c,m,f,h,x]=await Promise.all([pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE active)::int ativos,COUNT(*) FILTER(WHERE NOT active)::int inativos FROM edu_students"),pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE active)::int ativos FROM edu_courses"),pool.query("SELECT COUNT(*)::int total FROM edu_enrollments"),pool.query("SELECT COUNT(*)::int total FROM edu_enrollments WHERE status='CONCLUIDO'"),pool.query("SELECT COALESCE(SUM(minutes_studied),0)::int minutes FROM edu_enrollments"),pool.query("SELECT COUNT(*)::int total FROM edu_activity WHERE created_at>=NOW()-INTERVAL '30 days'")]);res.json({success:true,stats:{alunos:a.rows[0],cursos:c.rows[0],matriculas:m.rows[0].total,concluidos:f.rows[0].total,minutos_estudados:h.rows[0].minutes,atividades_30_dias:x.rows[0].total}});}catch(e){res.status(500).json({success:false,message:'Erro no dashboard.'});}});
app.get('/api/admin/educacao/students',exigirAdmin,async(req,res)=>{try{const q=await pool.query("SELECT s.id,s.name,s.email,s.username,s.phone,s.plan,s.active,s.access_until,s.created_at,s.last_login_at,COUNT(DISTINCT e.id)::int courses_count,COALESCE(ROUND(AVG(e.progress_percent),1),0)::float progress_average,COUNT(DISTINCT cert.id)::int certificates_count FROM edu_students s LEFT JOIN edu_enrollments e ON e.student_id=s.id LEFT JOIN edu_certificates cert ON cert.student_id=s.id AND cert.status='VALIDO' GROUP BY s.id ORDER BY s.created_at DESC");res.json({success:true,students:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao listar alunos.'});}});
app.post('/api/admin/educacao/students',exigirAdmin,async(req,res)=>{const{name,email,username,password,phone,plan,access_until}=req.body||{};if(!name||!email||!username||!password)return res.status(400).json({success:false,message:'Nome, e-mail, usuário e senha são obrigatórios.'});try{const e=await pool.query("SELECT id FROM edu_students WHERE username=$1 OR email=$2",[username,email]);if(e.rows.length)return res.status(409).json({success:false,message:'Usuário ou e-mail já cadastrado.'});const q=await pool.query("INSERT INTO edu_students(name,email,username,password_hash,phone,plan,access_until) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,username,phone,plan,active,access_until,created_at",[name,email,username,gerarHashSenha(password),phone||null,plan||'Multiplay Educação',access_until||null]);res.status(201).json({success:true,student:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao cadastrar aluno.'});}});
app.patch('/api/admin/educacao/students/:id',exigirAdmin,async(req,res)=>{const id=Number(req.params.id),{name,email,username,password,phone,plan,active,access_until}=req.body||{};try{const o=await pool.query("SELECT * FROM edu_students WHERE id=$1",[id]);if(!o.rows.length)return res.status(404).json({success:false,message:'Aluno não encontrado.'});const s=o.rows[0],q=await pool.query("UPDATE edu_students SET name=$1,email=$2,username=$3,password_hash=$4,phone=$5,plan=$6,active=$7,access_until=$8,updated_at=NOW() WHERE id=$9 RETURNING id,name,email,username,phone,plan,active,access_until,created_at,last_login_at",[name??s.name,email??s.email,username??s.username,password?gerarHashSenha(password):s.password_hash,phone??s.phone,plan??s.plan,active===undefined?s.active:Boolean(active),access_until===undefined?s.access_until:access_until||null,id]);res.json({success:true,student:q.rows[0]});}catch(e){if(e.code==='23505')return res.status(409).json({success:false,message:'Usuário ou e-mail já está em uso.'});res.status(500).json({success:false,message:'Erro ao atualizar aluno.'});}});
app.delete('/api/admin/educacao/students/:id',exigirAdmin,async(req,res)=>{try{const q=await pool.query("DELETE FROM edu_students WHERE id=$1 RETURNING id,name",[Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Aluno não encontrado.'});res.json({success:true,message:'Aluno excluído.'});}catch(e){res.status(500).json({success:false,message:'Erro ao excluir aluno.'});}});
app.get('/api/admin/educacao/courses',exigirAdmin,async(req,res)=>{try{const q=await pool.query("SELECT c.*,COUNT(e.id)::int students_count FROM edu_courses c LEFT JOIN edu_enrollments e ON e.course_id=c.id GROUP BY c.id ORDER BY c.created_at DESC");res.json({success:true,courses:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao listar cursos.'});}});
app.post('/api/admin/educacao/courses',exigirAdmin,async(req,res)=>{const{title,description,category,provider,workload_hours,content_url,cover_url}=req.body||{};if(!title)return res.status(400).json({success:false,message:'Título do curso é obrigatório.'});try{const q=await pool.query("INSERT INTO edu_courses(title,description,category,provider,workload_hours,content_url,cover_url) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[title,description||null,category||null,provider||null,Number(workload_hours)||0,content_url||null,cover_url||null]);res.status(201).json({success:true,course:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao cadastrar curso.'});}});
app.patch('/api/admin/educacao/courses/:id',exigirAdmin,async(req,res)=>{const id=Number(req.params.id),{title,description,category,provider,workload_hours,content_url,cover_url,active}=req.body||{};try{const q=await pool.query("UPDATE edu_courses SET title=COALESCE($1,title),description=COALESCE($2,description),category=COALESCE($3,category),provider=COALESCE($4,provider),workload_hours=COALESCE($5,workload_hours),content_url=COALESCE($6,content_url),cover_url=COALESCE($7,cover_url),active=COALESCE($8,active),updated_at=NOW() WHERE id=$9 RETURNING *",[title,description,category,provider,workload_hours===undefined?null:Number(workload_hours),content_url,cover_url,active===undefined?null:Boolean(active),id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Curso não encontrado.'});res.json({success:true,course:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao atualizar curso.'});}});
app.delete('/api/admin/educacao/courses/:id',exigirAdmin,async(req,res)=>{try{const q=await pool.query("DELETE FROM edu_courses WHERE id=$1 RETURNING id,title",[Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Curso não encontrado.'});res.json({success:true,message:'Curso excluído.'});}catch(e){res.status(500).json({success:false,message:'Erro ao excluir curso.'});}});
app.get('/api/admin/educacao/students/:id',exigirAdmin,async(req,res)=>{const id=Number(req.params.id);try{const[s,e,c,a]=await Promise.all([pool.query("SELECT id,name,email,username,phone,plan,active,access_until,created_at,last_login_at FROM edu_students WHERE id=$1",[id]),pool.query("SELECT e.id,e.progress_percent,e.minutes_studied,e.status,e.enrolled_at,e.completed_at,e.last_access_at,c.id course_id,c.title,c.category,c.workload_hours FROM edu_enrollments e JOIN edu_courses c ON c.id=e.course_id WHERE e.student_id=$1 ORDER BY e.enrolled_at DESC",[id]),pool.query("SELECT cert.id,cert.certificate_number,cert.title,cert.issued_at,cert.file_name,cert.status,c.title course_title FROM edu_certificates cert LEFT JOIN edu_courses c ON c.id=cert.course_id WHERE cert.student_id=$1 ORDER BY cert.issued_at DESC",[id]),pool.query("SELECT activity_type,details,created_at FROM edu_activity WHERE student_id=$1 ORDER BY created_at DESC LIMIT 50",[id])]);if(!s.rows.length)return res.status(404).json({success:false,message:'Aluno não encontrado.'});res.json({success:true,student:s.rows[0],enrollments:e.rows,certificates:c.rows,activity:a.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar o aluno.'});}});
app.post('/api/admin/educacao/enrollments',exigirAdmin,async(req,res)=>{const{student_id,course_id}=req.body||{};if(!student_id||!course_id)return res.status(400).json({success:false,message:'Aluno e curso são obrigatórios.'});try{const q=await pool.query("INSERT INTO edu_enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT(student_id,course_id) DO UPDATE SET status='ATIVO' RETURNING *",[Number(student_id),Number(course_id)]);res.status(201).json({success:true,enrollment:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao matricular aluno.'});}});
app.patch('/api/admin/educacao/enrollments/:id',exigirAdmin,async(req,res)=>{const id=Number(req.params.id),{status,progress_percent,minutes_studied}=req.body||{};try{const q=await pool.query("UPDATE edu_enrollments SET status=COALESCE($1,status),progress_percent=COALESCE($2,progress_percent),minutes_studied=COALESCE($3,minutes_studied),completed_at=CASE WHEN COALESCE($2,progress_percent)>=100 THEN COALESCE(completed_at,NOW()) ELSE completed_at END,last_access_at=NOW() WHERE id=$4 RETURNING *",[status,progress_percent===undefined?null:Number(progress_percent),minutes_studied===undefined?null:Number(minutes_studied),id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Matrícula não encontrada.'});res.json({success:true,enrollment:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao atualizar progresso.'});}});
app.post('/api/admin/educacao/certificates',exigirAdmin,uploadEducacao.single('file'),async(req,res)=>{const{student_id,course_id,title}=req.body||{};if(!student_id||!title)return res.status(400).json({success:false,message:'Aluno e título do certificado são obrigatórios.'});if(!req.file)return res.status(400).json({success:false,message:'Envie um arquivo PDF.'});try{const numero='MPE-'+new Date().getFullYear()+'-'+crypto.randomBytes(5).toString('hex').toUpperCase();const q=await pool.query("INSERT INTO edu_certificates(student_id,course_id,certificate_number,title,file_name,mime_type,file_data) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,student_id,course_id,certificate_number,title,issued_at,file_name,status",[Number(student_id),course_id?Number(course_id):null,numero,title,req.file.originalname,req.file.mimetype,req.file.buffer]);res.status(201).json({success:true,certificate:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao salvar certificado.'});}});
app.get('/api/admin/educacao/certificates/:id/file',exigirAdmin,async(req,res)=>{try{const q=await pool.query("SELECT file_name,mime_type,file_data FROM edu_certificates WHERE id=$1",[Number(req.params.id)]);if(!q.rows.length||!q.rows[0].file_data)return res.status(404).send('Certificado não encontrado.');res.setHeader('Content-Type',q.rows[0].mime_type||'application/pdf');res.setHeader('Content-Disposition','inline; filename="'+String(q.rows[0].file_name||'certificado.pdf').replace(/"/g,'')+'"');res.send(q.rows[0].file_data);}catch(e){res.status(500).send('Erro ao abrir certificado.');}});
app.patch('/api/admin/educacao/certificates/:id',exigirAdmin,async(req,res)=>{try{const q=await pool.query("UPDATE edu_certificates SET status=COALESCE($1,status) WHERE id=$2 RETURNING id,status",[req.body?.status,Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Certificado não encontrado.'});res.json({success:true,certificate:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao atualizar certificado.'});}});


/* =========================================================
   MULTIPLAY EDUCAÇÃO — SUPORTE / DÚVIDAS
========================================================= */
async function garantirTabelasSuporteEducacao(){
  await pool.query("CREATE TABLE IF NOT EXISTS edu_support_tickets(id SERIAL PRIMARY KEY,student_id INTEGER REFERENCES edu_students(id) ON DELETE SET NULL,name VARCHAR(180) NOT NULL,email VARCHAR(180),subject VARCHAR(220) NOT NULL,status VARCHAR(30) DEFAULT 'ABERTO',priority VARCHAR(20) DEFAULT 'NORMAL',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,last_reply_at TIMESTAMP NULL); CREATE TABLE IF NOT EXISTS edu_support_messages(id BIGSERIAL PRIMARY KEY,ticket_id INTEGER NOT NULL REFERENCES edu_support_tickets(id) ON DELETE CASCADE,sender_type VARCHAR(20) NOT NULL,message TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS idx_edu_support_status ON edu_support_tickets(status); CREATE INDEX IF NOT EXISTS idx_edu_support_ticket ON edu_support_messages(ticket_id)");
}
garantirTabelasSuporteEducacao().catch(e=>console.error('MultiPlay Suporte:',e.message));

app.post('/api/educacao/support/tickets',async(req,res)=>{
  const aluno=verificarTokenEducacao(obterTokenEducacao(req));
  const {name,email,subject,message}=req.body||{};
  if(!subject||!message)return res.status(400).json({success:false,message:'Assunto e mensagem são obrigatórios.'});
  try{
    const s=aluno?await pool.query('SELECT name,email FROM edu_students WHERE id=$1',[aluno.id]):null;
    const nome=(aluno&&s?.rows[0]?.name)||name||'Aluno';
    const mail=(aluno&&s?.rows[0]?.email)||email||null;
    const t=await pool.query("INSERT INTO edu_support_tickets(student_id,name,email,subject) VALUES($1,$2,$3,$4) RETURNING id,subject,status,created_at",[aluno?.id||null,nome,mail,subject]);
    await pool.query("INSERT INTO edu_support_messages(ticket_id,sender_type,message) VALUES($1,'ALUNO',$2)",[t.rows[0].id,String(message).slice(0,5000)]);
    res.status(201).json({success:true,ticket:t.rows[0]});
  }catch(e){res.status(500).json({success:false,message:'Não foi possível abrir o chamado.'});}
});

app.get('/api/educacao/support/tickets',async(req,res)=>{
  const aluno=verificarTokenEducacao(obterTokenEducacao(req));if(!aluno)return res.status(401).json({success:false,message:'Faça login para consultar suas dúvidas.'});
  try{const q=await pool.query("SELECT id,subject,status,priority,created_at,updated_at,last_reply_at FROM edu_support_tickets WHERE student_id=$1 ORDER BY updated_at DESC",[aluno.id]);res.json({success:true,tickets:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar chamados.'});}
});

app.get('/api/educacao/support/tickets/:id',async(req,res)=>{
  const aluno=verificarTokenEducacao(obterTokenEducacao(req));if(!aluno)return res.status(401).json({success:false,message:'Faça login.'});
  try{const q=await pool.query("SELECT id,subject,status,priority,created_at,updated_at FROM edu_support_tickets WHERE id=$1 AND student_id=$2",[Number(req.params.id),aluno.id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});const m=await pool.query("SELECT sender_type,message,created_at FROM edu_support_messages WHERE ticket_id=$1 ORDER BY created_at",[q.rows[0].id]);res.json({success:true,ticket:q.rows[0],messages:m.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao carregar conversa.'});}
});

app.post('/api/educacao/support/tickets/:id/messages',async(req,res)=>{
  const aluno=verificarTokenEducacao(obterTokenEducacao(req));if(!aluno)return res.status(401).json({success:false,message:'Faça login.'});
  const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({success:false,message:'Mensagem vazia.'});
  try{const q=await pool.query("SELECT id FROM edu_support_tickets WHERE id=$1 AND student_id=$2",[Number(req.params.id),aluno.id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});await pool.query("INSERT INTO edu_support_messages(ticket_id,sender_type,message) VALUES($1,'ALUNO',$2)",[q.rows[0].id,message.slice(0,5000)]);await pool.query("UPDATE edu_support_tickets SET status='ABERTO',updated_at=NOW() WHERE id=$1",[q.rows[0].id]);res.json({success:true});}catch(e){res.status(500).json({success:false,message:'Erro ao enviar mensagem.'});}
});

app.get('/api/admin/educacao/support/tickets',exigirAdmin,async(req,res)=>{
  try{const q=await pool.query("SELECT t.id,t.name,t.email,t.subject,t.status,t.priority,t.created_at,t.updated_at,t.last_reply_at,COUNT(m.id)::int message_count FROM edu_support_tickets t LEFT JOIN edu_support_messages m ON m.ticket_id=t.id GROUP BY t.id ORDER BY CASE WHEN t.status='ABERTO' THEN 0 ELSE 1 END,t.updated_at DESC");res.json({success:true,tickets:q.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao listar suporte.'});}
});
app.get('/api/admin/educacao/support/tickets/:id',exigirAdmin,async(req,res)=>{
  try{const q=await pool.query("SELECT * FROM edu_support_tickets WHERE id=$1",[Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});const m=await pool.query("SELECT sender_type,message,created_at FROM edu_support_messages WHERE ticket_id=$1 ORDER BY created_at",[q.rows[0].id]);res.json({success:true,ticket:q.rows[0],messages:m.rows});}catch(e){res.status(500).json({success:false,message:'Erro ao abrir chamado.'});}
});
app.post('/api/admin/educacao/support/tickets/:id/messages',exigirAdmin,async(req,res)=>{
  const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({success:false,message:'Mensagem vazia.'});
  try{const id=Number(req.params.id);const q=await pool.query("SELECT id FROM edu_support_tickets WHERE id=$1",[id]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});await pool.query("INSERT INTO edu_support_messages(ticket_id,sender_type,message) VALUES($1,'SUPORTE',$2)",[id,message.slice(0,5000)]);await pool.query("UPDATE edu_support_tickets SET status='RESPONDIDO',last_reply_at=NOW(),updated_at=NOW() WHERE id=$1",[id]);res.json({success:true});}catch(e){res.status(500).json({success:false,message:'Erro ao responder.'});}
});
app.patch('/api/admin/educacao/support/tickets/:id',exigirAdmin,async(req,res)=>{
  try{const q=await pool.query("UPDATE edu_support_tickets SET status=COALESCE($1,status),priority=COALESCE($2,priority),updated_at=NOW() WHERE id=$3 RETURNING id,status,priority",[req.body?.status,req.body?.priority,Number(req.params.id)]);if(!q.rows.length)return res.status(404).json({success:false,message:'Chamado não encontrado.'});res.json({success:true,ticket:q.rows[0]});}catch(e){res.status(500).json({success:false,message:'Erro ao atualizar chamado.'});}
});

/* =========================================================
   MULTIPLAY EDUCAÇÃO — ASSINATURAS
========================================================= */
const registerEducacaoAssinaturas = require('./educacao-assinaturas');
registerEducacaoAssinaturas({ app, pool, fetch, exigirAlunoEducacao, exigirAdmin });

/* =========================
   SERVIDOR
========================= */

app.listen(
  PORT,
  () => {

    console.log(
      `MultiPlay rodando na porta ${PORT}`
    );
  }
);
