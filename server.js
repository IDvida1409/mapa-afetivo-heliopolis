const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'data', 'uploads');
const submissionsFile = path.join(__dirname, 'data', 'submissions.json');

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
app.use(express.static(__dirname));

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
app.listen(port, () => console.log(`Mapa afetivo em http://localhost:${port}`));
