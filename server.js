require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_NOW";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, "db.json");
const initialDb = {
  users: [],
  films: [],
  categories: [
    { id: "cat-action", name: "Aksiyon" },
    { id: "cat-drama", name: "Dram" },
    { id: "cat-comedy", name: "Komedi" },
    { id: "cat-scifi", name: "Bilim Kurgu" }
  ],
  payments: [],
  subscriptions: [],
  messages: [],
  rooms: [],
  notifications: [],
  settings: {
    siteName: "FILMKEYFI",
    currency: "TRY",
    monthlyPrice: 50,
    shopier: {
      enabled: process.env.SHOPIER_ENABLED === "true",
      merchantId: process.env.SHOPIER_MERCHANT_ID || "",
      apiKey: process.env.SHOPIER_API_KEY || "",
      apiSecret: process.env.SHOPIER_API_SECRET || ""
    }
  }
};

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let db = loadDb();

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@filmkeyfi.com").toLowerCase();
  if (!db.users.some(u => u.email === email)) {
    const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
    db.users.push({
      id: "admin-" + Date.now(),
      name: "FilmKeyfi Admin",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      active: true,
      createdAt: new Date().toISOString()
    });
    saveDb(db);
    console.log(`Admin hazır: ${email}`);
    if (!process.env.ADMIN_PASSWORD) console.log("UYARI: Varsayılan admin şifresini .env ile değiştirin.");
  }
}
ensureAdmin();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT, "public")));

function signUser(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  try {
    const token = req.cookies.filmkeyfi_token ||
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Giriş yapmanız gerekiyor." });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Oturum geçersiz veya süresi dolmuş." });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin yetkisi gerekli." });
  }
  next();
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype === "video/mp4") cb(null, true);
    else cb(new Error("Sadece MP4 video yükleyebilirsiniz."));
  }
});

// Auth
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: "Ad, e-posta ve en az 6 karakterlik şifre gerekli." });

  const normalized = email.trim().toLowerCase();
  if (db.users.some(u => u.email === normalized))
    return res.status(409).json({ error: "Bu e-posta zaten kayıtlı." });

  const user = {
    id: "usr-" + Date.now(),
    name: name.trim(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, 12),
    role: "user",
    active: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  saveDb(db);

  const token = signUser(user);
  res.cookie("filmkeyfi_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7*24*60*60*1000 });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === String(email || "").trim().toLowerCase());
  if (!user || !user.active || !(await bcrypt.compare(password || "", user.passwordHash)))
    return res.status(401).json({ error: "E-posta veya şifre hatalı." });

  const token = signUser(user);
  res.cookie("filmkeyfi_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7*24*60*60*1000 });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post("/api/auth/logout", (_, res) => {
  res.clearCookie("filmkeyfi_token");
  res.json({ ok: true });
});

app.get("/api/auth/me", auth, (req, res) => {
  const u = db.users.find(x => x.id === req.user.id);
  if (!u) return res.status(401).json({ error: "Kullanıcı bulunamadı." });
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active } });
});

app.post("/api/auth/forgot", (req, res) => {
  // Gerçek e-posta gönderimi için SMTP/e-posta sağlayıcısı eklenmelidir.
  const exists = db.users.some(u => u.email === String(req.body.email || "").trim().toLowerCase());
  res.json({ ok: true, message: exists ? "Şifre sıfırlama bağlantısı hazırlanabilir." : "E-posta kayıtlıysa bağlantı gönderilecektir." });
});

// Public content
app.get("/api/films", (_, res) => {
  res.json(db.films.map(f => ({ ...f, videoUrl: f.videoFile ? `/uploads/${f.videoFile}` : "" })));
});
app.get("/api/categories", (_, res) => res.json(db.categories));

app.get("/api/films/:id", (req, res) => {
  const film = db.films.find(f => f.id === req.params.id);
  if (!film) return res.status(404).json({ error: "Film bulunamadı." });
  res.json({ ...film, videoUrl: film.videoFile ? `/uploads/${film.videoFile}` : "" });
});

// Admin
app.get("/api/admin/stats", auth, adminOnly, (_, res) => {
  res.json({
    users: db.users.length,
    films: db.films.length,
    categories: db.categories.length,
    payments: db.payments.length,
    subscriptions: db.subscriptions.length,
    rooms: db.rooms.length,
    messages: db.messages.length
  });
});

app.get("/api/admin/users", auth, adminOnly, (_, res) => {
  res.json(db.users.map(({ passwordHash, ...u }) => u));
});

app.patch("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  if (typeof req.body.active === "boolean") u.active = req.body.active;
  if (req.body.role && ["user", "admin"].includes(req.body.role)) u.role = req.body.role;
  saveDb(db);
  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Kendi hesabınızı silemezsiniz." });
  db.users = db.users.filter(u => u.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

app.post("/api/admin/films", auth, adminOnly, upload.single("video"), (req, res) => {
  const { title, description, categoryId, year, duration } = req.body;
  if (!title) return res.status(400).json({ error: "Film adı gerekli." });
  const film = {
    id: "film-" + Date.now(),
    title: title.trim(),
    description: description || "",
    categoryId: categoryId || "",
    year: year || "",
    duration: duration || "",
    videoFile: req.file?.filename || "",
    createdAt: new Date().toISOString()
  };
  db.films.unshift(film);
  saveDb(db);
  res.json({ ...film, videoUrl: film.videoFile ? `/uploads/${film.videoFile}` : "" });
});

app.delete("/api/admin/films/:id", auth, adminOnly, (req, res) => {
  const film = db.films.find(f => f.id === req.params.id);
  if (!film) return res.status(404).json({ error: "Film bulunamadı." });
  if (film.videoFile) {
    const file = path.join(UPLOAD_DIR, film.videoFile);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  db.films = db.films.filter(f => f.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

app.post("/api/admin/categories", auth, adminOnly, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Kategori adı gerekli." });
  const c = { id: "cat-" + Date.now(), name };
  db.categories.push(c);
  saveDb(db);
  res.json(c);
});

app.delete("/api/admin/categories/:id", auth, adminOnly, (req, res) => {
  db.categories = db.categories.filter(c => c.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

app.get("/api/admin/payments", auth, adminOnly, (_, res) => res.json(db.payments));
app.get("/api/admin/subscriptions", auth, adminOnly, (_, res) => res.json(db.subscriptions));

app.get("/api/admin/settings", auth, adminOnly, (_, res) => {
  const s = structuredClone(db.settings);
  if (s.shopier.apiKey) s.shopier.apiKey = "********";
  if (s.shopier.apiSecret) s.shopier.apiSecret = "********";
  res.json(s);
});

app.put("/api/admin/settings", auth, adminOnly, (req, res) => {
  const { siteName, currency, monthlyPrice, shopier } = req.body;
  if (siteName !== undefined) db.settings.siteName = String(siteName);
  if (currency !== undefined) db.settings.currency = String(currency);
  if (monthlyPrice !== undefined) db.settings.monthlyPrice = Number(monthlyPrice) || 0;

  if (shopier) {
    db.settings.shopier.enabled = Boolean(shopier.enabled);
    if (shopier.merchantId !== undefined) db.settings.shopier.merchantId = String(shopier.merchantId);
    if (shopier.apiKey && shopier.apiKey !== "********") db.settings.shopier.apiKey = String(shopier.apiKey);
    if (shopier.apiSecret && shopier.apiSecret !== "********") db.settings.shopier.apiSecret = String(shopier.apiSecret);
  }
  saveDb(db);
  res.json({ ok: true });
});

// Shopier webhook endpoint.
// IMPORTANT: exact signature/field handling must match the Shopier integration method/account configuration.
app.post("/api/payments/shopier/webhook", (req, res) => {
  const payment = {
    id: "pay-" + Date.now(),
    provider: "shopier",
    status: "received",
    payload: req.body,
    receivedAt: new Date().toISOString()
  };
  db.payments.unshift(payment);
  saveDb(db);
  res.status(200).send("OK");
});

app.get("/api/payments/shopier/config", auth, (req, res) => {
  res.json({
    enabled: db.settings.shopier.enabled,
    webhookUrl: `${BASE_URL}/api/payments/shopier/webhook`,
    successUrl: `${BASE_URL}/payment/success`,
    failureUrl: `${BASE_URL}/payment/failure`
  });
});

app.post("/api/support", auth, (req, res) => {
  const message = {
    id: "msg-" + Date.now(),
    userId: req.user.id,
    text: String(req.body.text || "").trim(),
    createdAt: new Date().toISOString(),
    status: "open"
  };
  if (!message.text) return res.status(400).json({ error: "Mesaj boş olamaz." });
  db.messages.unshift(message);
  saveDb(db);
  res.json(message);
});

app.get("/api/admin/messages", auth, adminOnly, (_, res) => res.json(db.messages));

app.get("/payment/success", (_, res) => res.send("<h1>Ödeme başarılı</h1><p>FilmKeyfi üyeliğiniz ödeme sağlayıcısından gelen onayla aktifleştirilebilir.</p>"));
app.get("/payment/failure", (_, res) => res.send("<h1>Ödeme başarısız</h1><p>Lütfen tekrar deneyin.</p>"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Bir hata oluştu." });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`FilmKeyfi çalışıyor: ${BASE_URL}`);
});