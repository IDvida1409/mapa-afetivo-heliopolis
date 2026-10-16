const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const formDataDir = process.env.FORM_DATA_DIR || path.join(__dirname, 'data');
const uploadDir = process.env.UPLOAD_DIR || path.join(formDataDir, 'uploads');
const submissionsFile = path.join(formDataDir, 'submissions.json');
const adminToken = process.env.ADMIN_TOKEN || '';

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.dirname(submissionsFile), { recursive: true });
if (!fs.existsSync(submissionsFile)) fs.writeFileSync(submissionsFile, '[]', 'utf8');

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, safeName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, allowedTypes.has(file.mimetype))
});

app.use(express.urlencoded({ extended: true }));
// A cartografia usa o disco persistente já destinado às contribuições.
process.env.CARTOGRAPHY_DATA_DIR = path.join(path.dirname(submissionsFile), 'cartografia');
const cartography = require('./cartografia/server.cjs');
app.get(/^\/cartografia$/, (_req, res) => res.redirect(302, '/cartografia/'));
app.use('/cartografia', (req, res) => cartography.emit('request', req, res));
// Somente os arquivos públicos do formulário são servidos na raiz.
for (const [route, filename] of [['/', 'index.html'], ['/index.html', 'index.html'], ['/obrigado.html', 'obrigado.html'], ['/mural-cartografico-heliopolis.png', 'mural-cartografico-heliopolis.png']]) {
  app.get(route, (_req, res) => res.sendFile(path.join(__dirname, filename)));
}

app.post('/enviar', upload.single('foto'), (req, res) => {
  if (!req.file || req.body.autorizacao !== 'sim' || !req.body.local || !req.body.relato) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).send('Preencha o local, o relato, envie uma imagem válida e confirme a autorização.');
  }

  let submissions = [];
  try { submissions = JSON.parse(fs.readFileSync(submissionsFile, 'utf8')); } catch (_err) {}
  submissions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    local: req.body.local.trim(),
    categoria: (req.body.categoria || '').trim(),
    relato: req.body.relato.trim(),
    nome: (req.body.nome || '').trim(),
    foto: req.file.filename,
    autorizado: true,
    revisado: false
  });
  fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2), 'utf8');
  res.redirect('/obrigado.html');
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/contagem', (req, res) => {
  if (!adminToken || req.query.token !== adminToken) return res.status(401).send('Acesso restrito.');
  let submissions = [];
  try { submissions = JSON.parse(fs.readFileSync(submissionsFile, 'utf8')); } catch (_err) {}
  let photos = 0;
  try { photos = fs.readdirSync(uploadDir).filter((name) => /\.(jpe?g|png|webp)$/i.test(name)).length; } catch (_err) {}
  submissions = submissions.map((item) => item.nome === 'Equipe do projeto - foto de referência editada para retirar uma pessoa'
    ? { ...item, nome: 'Sem informação' }
    : item);
  res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contribuições</title><style>body{margin:0;background:#f4f0e8;color:#1d2922;font:16px/1.5 Arial,sans-serif}main{max-width:760px;margin:0 auto;padding:32px 18px}h1{font:36px Georgia,serif;margin:0 0 8px}p{color:#526058}.stats{display:flex;gap:12px;margin:24px 0}.stat{background:#fff;border:1px solid #ddd5c8;padding:16px 20px;border-radius:8px}.stat strong{display:block;font-size:28px}.card{background:#fff;border:1px solid #ddd5c8;border-radius:8px;padding:18px;margin-top:18px}.card img{max-width:100%;border-radius:6px;margin-top:12px}.label{font-size:12px;text-transform:uppercase;color:#69776e;letter-spacing:.08em;margin-top:14px}</style><main><h1>Contribuições recebidas</h1><p>Área de consulta do projeto de Psicologia Social Comunitária.</p><div class="stats"><div class="stat"><strong>${submissions.length}</strong>resposta(s)</div><div class="stat"><strong>${photos}</strong>foto(s)</div></div>${submissions.map((item) => `<article class="card"><div class="label">Local</div><div>${escapeHtml(item.local)}</div><div class="label">Categoria</div><div>${escapeHtml(item.categoria || 'Não informada')}</div><div class="label">Relato</div><div>${escapeHtml(item.relato)}</div>${item.nome ? `<div class="label">Identificação</div><div>${escapeHtml(item.nome)}</div>` : ''}<img src="/contribuicao-foto/${encodeURIComponent(item.foto)}?token=${encodeURIComponent(adminToken)}" alt="Foto enviada para o projeto"></article>`).join('')}</main></html>`);
});

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

app.get('/contribuicao-foto/:filename', (req, res) => {
  if (!adminToken || req.query.token !== adminToken) return res.sendStatus(401);
  const filename = path.basename(req.params.filename);
  if (!filename || !fs.existsSync(path.join(uploadDir, filename))) return res.sendStatus(404);
  res.sendFile(path.join(uploadDir, filename));
});

if (require.main === module) app.listen(port, () => console.log(`Mapa afetivo em http://localhost:${port}`));
module.exports = app;
