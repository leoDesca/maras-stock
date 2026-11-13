
// Maras Beauty Stock App — Express server with role-based access
// Owner / Staff

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const DB = path.join(
  process.env.DATA_DIR || path.join(__dirname, 'data'),
  'db.json'
);

const uid = () => crypto.randomBytes(5).toString('hex');
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');

const mkUser = (username, name, role, pw) => {
  const salt = uid();
  return {
    id: uid(),
    username,
    name,
    role,
    salt,
    hash: hash(pw, salt),
    active: true
  };
};

const today = () => new Date().toLocaleDateString('en-CA');

// ---------- starting data ----------

function seed() {
  const items = [];

  const L = (cat, price, s) => s.split(',').forEach(x => {
    const [n, q] = x.split(':');
    items.push({
      id: uid(),
      type: 'lipstick',
      name: n.trim(),
      cat,
      color: '',
      len: '',
      qty: +q,
      price,
      cost: 0
    });
  });

  L('Matte & Gloss', 25000,
    'Crown:20,Owl:4,Royalty:4,Rouge queen:20,Berrybliss:10,Reagent:7,Sweet crush:15,Blossom:10,Kulture:13,Lipcandy:13,Crystal:30,Maiden:5,Empire:11,No.05:2,Famous:23,Gorgeous:20,Power:26,Vintage:16,Positions:19,Mysterious:4,Amour:15,No.012:9,No.049:13,No.010:3'
  );

  L('Lip butter', 25000,
    'Espresso:10,Raspberry jelly:3,Salty tan:9,Guava spritz:10,Short cake:9,Toast:8'
  );

  L('Lip liners', 15000, 'No.17:9,Brown:8,No.10:2');

  const W = (name, color, lens, cat = 'Wig') => {
    lens.forEach(l => {
      const e = items.find(i =>
        i.type == 'wig' &&
        i.name == name &&
        i.color == color &&
        i.len === l &&
        i.cat == cat
      );

      if (e) {
        e.qty++;
      } else {
        items.push({
          id: uid(),
          type: 'wig',
          name,
          cat,
          color,
          len: l,
          qty: 1,
          price: 0,
          cost: 0
        });
      }
    });
  };

  W('Deepwave', '', [14, 12, 12, 18]);
  W('#44 wig', '', [20, 20]);
  W('#134 wig', 'maroon', [18]);

  ['black', 'maroon', 'piano'].forEach(c =>
    W('Water wave', c, [''])
  );

  W('Fringe straight', 'black', [10]);
  W('Bob straight', 'maroon', [10, 12, 16, 16]);
  W('Bob straight', 'black', [8, 10, 12, 12]);
  W('Bob straight', 'orange', [12, 14]);
  W('Bodywave', '', [16, 16, 22]);
  W('Straight', 'coffee brown', [22, 20]);
  W('Straight', 'blond', [16, 22, 16, 14]);
  W('Straight', 'piano', ['', '', '']);

  ['coffee brown', 'black', 'blond'].forEach(c =>
    W('Kinky curly', c, [''])
  );

  W('Pixie', '', ['', '', '', '', '']);
  W('Bundles', '', Array(17).fill(''), 'Bundles');

  return {
    users: [
      mkUser('owner', 'Shop Owner', 'owner',
        process.env.OWNER_PASSWORD || 'owner123'),
      mkUser('staff', 'Shop Attendant', 'staff',
        process.env.STAFF_PASSWORD || 'staff123')
    ],
    items,
    sales: [],
    expenses: [],
    counts: [],
    log: [],
    settings: {
      shop: 'Maras Beauty',
      low: 3,
      maxDiscount: 5000,
      open: 162500
    }
  };
}

// ---------- database ----------

let db;

const save = () => {
  fs.mkdirSync(path.dirname(DB), { recursive: true });
  fs.writeFileSync(DB + '.tmp', JSON.stringify(db, null, 1));
  fs.renameSync(DB + '.tmp', DB);
};

if (fs.existsSync(DB)) {
  db = JSON.parse(fs.readFileSync(DB, 'utf8'));
} else {
  db = seed();
  save();
}

const audit = (u, action, detail = '') => {
  db.log.push({
    ts: new Date().toISOString(),
    by: u.username,
    action,
    detail
  });

  if (db.log.length > 2000) db.log.shift();
};

// ---------- authentication ----------

const sess = new Map();

const cookies = r =>
  Object.fromEntries(
    (r.headers.cookie || '')
      .split(';')
      .map(c => c.trim().split('='))
      .filter(a => a[0])
  );

const app = express();

app.set('trust proxy', 1);
app.use(express.json());

app.use((req, res, next) => {
  const t = cookies(req).sid;
  req.user = t && sess.get(t);
  next();
});

const need = (...roles) => (req, res, next) =>
  !req.user
    ? res.status(401).json({ error: 'Please log in' })
    : roles.length && !roles.includes(req.user.role)
      ? res.status(403).json({ error: 'Owner only' })
      : next();

const fail = (res, msg, code = 400) =>
  res.status(code).json({ error: msg });

// ---------- login ----------

const tries = new Map();

app.post('/api/login', (req, res) => {
  const now = Date.now();

  const t0 = (tries.get(req.ip) || [])
    .filter(t => now - t < 900000);

  if (t0.length >= 8) {
    return fail(
      res,
      'Too many attempts. Try again in 15 minutes.',
      429
    );
  }

  const u = db.users.find(x =>
    x.username == String(req.body.username || '')
      .toLowerCase()
      .trim()
  );

  if (
    !u ||
    !u.active ||
    hash(String(req.body.password || ''), u.salt) !== u.hash
  ) {
    t0.push(now);
    tries.set(req.ip, t0);
    return fail(res, 'Wrong username or password', 401);
  }

  const t = crypto.randomBytes(24).toString('hex');

  sess.set(t, {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role
  });

  res.setHeader(
    'Set-Cookie',
    `sid=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200${req.secure ? '; Secure' : ''}`
  );

  audit(u, 'login');
  save();

  res.json({ role: u.role });
});

app.post('/api/logout', (req, res) => {
  sess.delete(cookies(req).sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  res.json({ ok: 1 });
});

app.get('/api/me', need(), (req, res) =>
  res.json({ ...req.user, shop: db.settings.shop })
);

app.post('/api/password', need(), (req, res) => {
  const u = db.users.find(x => x.id == req.user.id);

  if (hash(String(req.body.old || ''), u.salt) !== u.hash) {
    return fail(res, 'Current password is wrong');
  }

  if (String(req.body.new || '').length < 6) {
    return fail(res, 'New password needs 6+ characters');
  }

  u.salt = uid();
  u.hash = hash(req.body.new, u.salt);

  save();
  res.json({ ok: 1 });
});

// ---------- pages ----------

const view = f => path.join(__dirname, 'views', f);

app.get('/login', (q, s) =>
  s.sendFile(view('login.html'))
);

app.get('/', (q, s) =>
  s.redirect(
    !q.user
      ? '/login'
      : q.user.role == 'owner'
        ? '/owner'
        : '/shop'
  )
);

app.get('/shop', (q, s) =>
  q.user
    ? s.sendFile(view('shop.html'))
    : s.redirect('/login')
);

app.get('/owner', (q, s) =>
  !q.user
    ? s.redirect('/login')
    : q.user.role != 'owner'
      ? s.redirect('/shop')
      : s.sendFile(view('owner.html'))
);

app.use('/assets', express.static(path.join(__dirname, 'public')));

// ---------- items ----------

const pub = i => ({
  id: i.id,
  type: i.type,
  name: i.name,
  cat: i.cat,
  color: i.color,
  len: i.len,
  qty: i.qty,
  price: i.price
});

const lab = i =>
  i.name +
  (i.color ? ' ' + i.color : '') +
  (i.len ? ' ' + i.len + '"' : '');

app.get('/api/items', need(), (q, s) =>
  s.json(
    q.user.role == 'owner'
      ? db.items
      : db.items.map(pub)
  )
);

app.post('/api/items', need('owner'), (q, s) => {
  const b = q.body;

  if (!String(b.name || '').trim()) {
    return fail(s, 'Name required');
  }

  const i = {
    id: uid(),
    type: b.type == 'wig' ? 'wig' : 'lipstick',
    name: b.name.trim(),
    cat: (b.cat || 'Other').trim(),
    color: b.color || '',
    len: String(b.len || ''),
    qty: +b.qty || 0,
    price: +b.price || 0,
    cost: +b.cost || 0
  };

  db.items.push(i);
  audit(q.user, 'item.add', lab(i));
  save();
  s.json(i);
});

app.put('/api/items/:id', need('owner'), (q, s) => {
  const i = db.items.find(x => x.id == q.params.id);

  if (!i) return fail(s, 'Not found', 404);

  const b = q.body;
  const old = i.qty;

  Object.assign(i, {
    name: b.name ?? i.name,
    cat: b.cat ?? i.cat,
    color: b.color ?? i.color,
    len: String(b.len ?? i.len),
    qty: +b.qty >= 0 ? +b.qty : i.qty,
    price: +b.price >= 0 ? +b.price : i.price,
    cost: +b.cost >= 0 ? +b.cost : i.cost
  });

  audit(q.user, 'item.edit', `${lab(i)} qty ${old}->${i.qty}`);
  save();
  s.json(i);
});

app.delete('/api/items/:id', need('owner'), (q, s) => {
  const i = db.items.find(x => x.id == q.params.id);

  db.items = db.items.filter(x => x != i);

  if (i) audit(q.user, 'item.delete', lab(i));

  save();
  s.json({ ok: 1 });
});

app.post('/api/items/:id/restock', need('owner'), (q, s) => {
  const i = db.items.find(x => x.id == q.params.id);
  const n = +q.body.qty;

  if (!i || !(n > 0)) return fail(s, 'Invalid restock');

  i.qty += n;

  const c = +q.body.cost || 0;

  if (c) {
    db.expenses.push({
      id: uid(),
      date: today(),
      desc: 'Restock: ' + lab(i),
      amount: c,
      kind: 'out',
      by: q.user.username
    });
  }

  audit(q.user, 'restock', `${lab(i)} +${n}`);
  save();
  s.json(i);
});

// ---------- sales ----------

app.post('/api/sales', need(), (q, s) => {
  const i = db.items.find(x => x.id == q.body.itemId);
  const n = +q.body.qty;
  const owner = q.user.role == 'owner';

  if (!i || !Number.isInteger(n) || n < 1) {
    return fail(s, 'Invalid sale');
  }

  if (n > i.qty) {
    return fail(s, `Only ${i.qty} in stock`);
  }

  const disc = Math.max(0, +q.body.discount || 0);
  const unit = owner && q.body.unit != null
    ? +q.body.unit
    : i.price;

  if (!(unit > 0)) {
    return fail(s, 'Price not set for this item — ask the owner');
  }

  if (!owner && disc > db.settings.maxDiscount * n) {
    return fail(
      s,
      `Discount is above the limit of ${db.settings.maxDiscount} per item — ask the owner`,
      403
    );
  }

  i.qty -= n;

  const sale = {
    id: uid(),
    ts: new Date().toISOString(),
    date: today(),
    itemId: i.id,
    name: lab(i),
    cat: i.cat,
    type: i.type,
    qty: n,
    unit,
    cost: i.cost || 0,
    discount: disc,
    total: unit * n - disc,
    by: q.user.username,
    void: false
  };

  db.sales.push(sale);
  audit(q.user, 'sale', `${sale.name} x${n} = ${sale.total}`);

  save();
  s.json(sale);
});

app.get('/api/sales', need(), (q, s) => {
  let r = db.sales;

  if (q.user.role != 'owner') {
    r = r.filter(x =>
      x.date == today() &&
      x.by == q.user.username &&
      !x.void
    );
  }

  s.json(
    r.slice(-500).reverse().map(x =>
      q.user.role == 'owner'
        ? x
        : { ...x, cost: undefined }
    )
  );
});

app.post('/api/sales/:id/void', need('owner'), (q, s) => {
  const x = db.sales.find(v => v.id == q.params.id);

  if (!x || x.void) return fail(s, 'Cannot void');

  x.void = true;

  const i = db.items.find(v => v.id == x.itemId);
  if (i) i.qty += x.qty;

  audit(q.user, 'sale.void', `${x.name} x${x.qty}`);

  save();
  s.json({ ok: 1 });
});

// ---------- stock counts ----------

app.post('/api/counts', need(), (q, s) => {
  const lines = (q.body.lines || [])
    .map(l => {
      const i = db.items.find(x => x.id == l.itemId);

      return i && l.counted !== '' && +l.counted >= 0
        ? {
            itemId: i.id,
            name: lab(i),
            system: i.qty,
            counted: +l.counted
          }
        : null;
    })
    .filter(l => l && l.counted != l.system);

  db.counts.push({
    id: uid(),
    date: today(),
    by: q.user.username,
    lines,
    status: lines.length ? 'pending' : 'matched'
  });

  audit(q.user, 'count.submit', `${lines.length} differences`);

  save();
  s.json({ differences: lines.length });
});

app.get('/api/counts', need('owner'), (q, s) =>
  s.json(db.counts.slice(-50).reverse())
);

app.post('/api/counts/:id/:act', need('owner'), (q, s) => {
  const c = db.counts.find(x => x.id == q.params.id);

  if (!c || c.status != 'pending') {
    return fail(s, 'Not pending');
  }

  if (q.params.act == 'apply') {
    c.lines.forEach(l => {
      const i = db.items.find(x => x.id == l.itemId);
      if (i) i.qty = l.counted;
    });
  }

  c.status = q.params.act == 'apply' ? 'applied' : 'dismissed';

  audit(q.user, 'count.' + c.status, c.id);

  save();
  s.json({ ok: 1 });
});

// ---------- cash book ----------

app.get('/api/expenses', need(), (q, s) =>
  s.json(
    (
      q.user.role == 'owner'
        ? db.expenses
        : db.expenses.filter(e =>
            e.date == today() &&
            e.by == q.user.username
          )
    ).slice(-300).reverse()
  )
);

app.post('/api/expenses', need(), (q, s) => {
  const b = q.body;
  const a = +b.amount;

  if (!(a > 0) || !String(b.desc || '').trim()) {
    return fail(s, 'Description and amount required');
  }

  const e = {
    id: uid(),
    date: q.user.role == 'owner' && b.date ? b.date : today(),
    cat: String(b.cat || 'Other').trim().slice(0, 40),
    desc: b.desc.trim().slice(0, 120),
    amount: a,
    kind: b.kind == 'in' ? 'in' : 'out',
    by: q.user.username
  };

  db.expenses.push(e);
  audit(q.user, 'cash.' + e.kind, `${e.desc} ${a}`);

  save();
  s.json(e);
});

app.delete('/api/expenses/:id', need('owner'), (q, s) => {
  db.expenses = db.expenses.filter(x => x.id != q.params.id);

  save();
  s.json({ ok: 1 });
});

// ---------- users and settings ----------

const safeUser = u => ({
  id: u.id,
  username: u.username,
  name: u.name,
  role: u.role,
  active: u.active
});

app.get('/api/users', need('owner'), (q, s) =>
  s.json(db.users.map(safeUser))
);

app.post('/api/users', need('owner'), (q, s) => {
  const b = q.body;
  const un = String(b.username || '').toLowerCase().trim();

  if (!un || String(b.password || '').length < 6) {
    return fail(s, 'Username and a 6+ character password required');
  }

  if (db.users.some(x => x.username == un)) {
    return fail(s, 'Username already exists');
  }

  const u = mkUser(
    un,
    b.name || un,
    b.role == 'owner' ? 'owner' : 'staff',
    b.password
  );

  db.users.push(u);
  audit(q.user, 'user.add', un);

  save();
  s.json(safeUser(u));
});

app.put('/api/users/:id', need('owner'), (q, s) => {
  const u = db.users.find(x => x.id == q.params.id);

  if (!u) return fail(s, 'Not found', 404);

  if (u.id == q.user.id && q.body.active === false) {
    return fail(s, "You can't deactivate yourself");
  }

  if (q.body.name) u.name = q.body.name;

  if (typeof q.body.active == 'boolean') {
    u.active = q.body.active;
  }

  if (q.body.password) {
    if (q.body.password.length < 6) {
      return fail(s, 'Password needs 6+ characters');
    }

    u.salt = uid();
    u.hash = hash(q.body.password, u.salt);
  }

  audit(q.user, 'user.edit', u.username);

  save();
  s.json(safeUser(u));
});

app.get('/api/settings', need(), (q, s) =>
  s.json(db.settings)
);

app.put('/api/settings', need('owner'), (q, s) => {
  const b = q.body;

  Object.assign(db.settings, {
    shop: b.shop || db.settings.shop,
    low: +b.low >= 0 ? +b.low : db.settings.low,
    maxDiscount: +b.maxDiscount >= 0
      ? +b.maxDiscount
      : db.settings.maxDiscount,
    open: +b.open || 0
  });

  audit(q.user, 'settings');

  save();
  s.json(db.settings);
});

app.get('/api/backup', need('owner'), (q, s) =>
  s.download(DB, `maras-backup-${today()}.json`)
);

app.get('/api/log', need('owner'), (q, s) =>
  s.json(db.log.slice(-100).reverse())
);

// ---------- analytics ----------

app.get('/api/analytics', need('owner'), (q, s) => {
  const live = db.sales.filter(x => !x.void);

  const sum = (a, f) =>
    a.reduce((t, x) => t + f(x), 0);

  const by = (a, k, v) => {
    const o = {};
    a.forEach(x => {
      o[k(x)] = (o[k(x)] || 0) + v(x);
    });
    return o;
  };

  const t = today();
  const m = t.slice(0, 7);

  const month = live.filter(x => x.date.startsWith(m));
  const dayS = live.filter(x => x.date == t);

  const days = [...Array(14)].map((_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + k);
    return d.toLocaleDateString('en-CA');
  });

  const rev = by(live, x => x.date, x => x.total);
  const units = by(live, x => x.date, x => x.qty);

  const per = q.query.period || 'month';

  const from =
    per == 'today'
      ? t
      : per == 'week'
        ? days[7]
        : per == 'all'
          ? ''
          : m + '-01';

  const prod = {};

  live.filter(x => x.date >= from).forEach(x => {
    const p = prod[x.name] ||= {
      name: x.name,
      qty: 0,
      rev: 0
    };

    p.qty += x.qty;
    p.rev += x.total;
  });

  const cash =
    db.settings.open +
    sum(live, x => x.total) +
    sum(db.expenses, e =>
      e.kind == 'in' ? e.amount : -e.amount
    );

  const mExp = sum(
    db.expenses.filter(e =>
      e.date.startsWith(m) && e.kind == 'out'
    ),
    e => e.amount
  );

  s.json({
    kpi: {
      today: sum(dayS, x => x.total),
      todayUnits: sum(dayS, x => x.qty),
      month: sum(month, x => x.total),
      monthUnits: sum(month, x => x.qty),
      monthProfit: sum(month, x => x.total - x.cost * x.qty),
      monthExpenses: mExp,
      cash,
      stockValue: sum(db.items, i => i.qty * i.price),
      stockUnits: sum(db.items, i => i.qty),
      pendingCounts: db.counts.filter(c => c.status == 'pending').length
    },

    daily: {
      labels: days.map(d => d.slice(5)),
      rev: days.map(d => rev[d] || 0),
      units: days.map(d => units[d] || 0)
    },

    cat: by(month, x => x.cat, x => x.total),
    staff: by(month, x => x.by, x => x.total),

    top: Object.values(prod)
      .sort((a, b) => b.qty - a.qty || b.rev - a.rev)
      .slice(0, 10),

    period: per,

    expCat: by(
      db.expenses.filter(e =>
        e.date.startsWith(m) && e.kind == 'out'
      ),
      e => e.cat || 'Other',
      e => e.amount
    ),

    low: db.items
      .filter(i => i.qty <= db.settings.low)
      .sort((a, b) => a.qty - b.qty)
      .map(i => ({
        name: lab(i),
        qty: i.qty,
        type: i.type
      })),

    dead: db.items.filter(i =>
      i.qty > 0 &&
      !live.some(x =>
        x.itemId == i.id && x.date >= days[0]
      )
    ).length
  });
});

app.get('/api/export/sales.csv', need('owner'), (q, s) => {
  const rows = [
    ['Date', 'Item', 'Category', 'Qty', 'Unit', 'Discount', 'Total', 'Sold by', 'Voided'],
    ...db.sales.map(x => [
      x.date,
      x.name,
      x.cat,
      x.qty,
      x.unit,
      x.discount,
      x.total,
      x.by,
      x.void
    ])
  ];

  s.type('text/csv')
    .attachment('sales.csv')
    .send(
      rows.map(r =>
        r.map(v =>
          '"' + String(v).replace(/"/g, '""') + '"'
        ).join(',')
      ).join('\n')
    );
});

// ---------- start server on Render ----------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Maras Stock running on port ${PORT}`);
});
