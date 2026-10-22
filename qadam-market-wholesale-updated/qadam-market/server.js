const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'qadam2026';
const sessions = new Set();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Требуется вход администратора' });
  next();
}
app.get('/api/health', (req, res) => res.json({ ok: true, name: 'Qadam Market' }));
app.get('/api/products', (req, res) => res.json(readDB().products));
app.get('/api/settings', (req, res) => res.json(readDB().settings));
app.post('/api/login', (req, res) => {
  const password = String(req.body.password || '');
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Неверный пароль' });
  const token = crypto.randomBytes(24).toString('hex'); sessions.add(token);
  res.json({ token });
});
app.post('/api/logout', requireAdmin, (req, res) => { sessions.delete(req.headers.authorization.replace(/^Bearer\s+/i, '')); res.json({ ok: true }); });
app.post('/api/products', requireAdmin, (req, res) => {
  const db = readDB(); const p = req.body;
  if (!p.name || !p.price || !p.category) return res.status(400).json({ error: 'Заполните название, категорию и цену' });
  const product = { ...p, id: p.id || crypto.randomUUID(), price: Number(p.price), oldPrice: Number(p.oldPrice || 0), stock: Number(p.stock || 0), rating: Number(p.rating || 4.8), reviews: Number(p.reviews || 0), featured: Boolean(p.featured) };
  const index = db.products.findIndex(x => x.id === product.id);
  if (index >= 0) db.products[index] = product; else db.products.unshift(product);
  writeDB(db); res.json(product);
});
app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const db = readDB(); db.products = db.products.filter(p => p.id !== req.params.id); writeDB(db); res.json({ ok: true });
});
app.put('/api/settings', requireAdmin, (req, res) => {
  const db = readDB(); db.settings = { ...db.settings, ...req.body }; writeDB(db); res.json(db.settings);
});
app.post('/api/orders', (req, res) => {
  const { customer, phone, address, items, total, note } = req.body;
  if (!customer || !phone || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Укажите имя, телефон и товары в заказе' });
  const db = readDB();
  const order = { id: 'TM-' + Date.now().toString().slice(-8), createdAt: new Date().toISOString(), customer: String(customer).slice(0,100), phone: String(phone).slice(0,50), address: String(address || '').slice(0,300), note: String(note || '').slice(0,500), items: items.map(i => ({ id: String(i.id), name: String(i.name).slice(0,120), price: Number(i.price), quantity: Math.max(1, Math.min(99, Number(i.quantity) || 1)) })), total: Number(total) || 0, status: 'Новый' };
  db.orders.unshift(order); writeDB(db); res.status(201).json({ ok: true, orderId: order.id });
});
app.get('/api/orders', requireAdmin, (req, res) => res.json(readDB().orders));
app.patch('/api/orders/:id', requireAdmin, (req, res) => { const db = readDB(); const o = db.orders.find(x => x.id === req.params.id); if (!o) return res.status(404).json({ error: 'Заказ не найден' }); o.status = String(req.body.status || o.status); writeDB(db); res.json(o); });
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`Qadam Market запущен: http://localhost:${PORT}`));
