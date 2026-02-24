# 81 Okey — Deployment

## Klasör Yapısı

```
81-okey/
├── backend/    → Render.com'a deploy edilir
└── frontend/   → Vercel'e deploy edilir
```

---

## 1. Backend — Render.com

### Deploy Adımları
1. [render.com](https://render.com) → **New Web Service**
2. Git reponuzda `backend/` klasörünü seçin (ya da root directory = `backend`)
3. Build command: *(boş bırakın)*
4. Start command: `node server.js`
5. **Environment Variables** ekleyin:
   | Key | Value |
   |-----|-------|
   | `FRONTEND_URL` | `https://your-app.vercel.app` |

---

## 2. Frontend — Vercel

### Deploy Adımları
1. [vercel.com](https://vercel.com) → **New Project**
2. Git reponuzda `frontend/` klasörünü seçin (Root Directory = `frontend`)
3. Framework: **Other** (statik site)
4. Deploy edin

### ⚠️ Deploy Öncesi Yapılması Gereken
`frontend/config.js` dosyasındaki URL'yi Render URL'nizle güncelleyin:

```js
window.BACKEND_URL = 'https://YOUR-APP.onrender.com'; // ← Bunu değiştirin
```

---

## Yerel Geliştirme

Backend ve frontend ayrı ayrı çalıştırılabilir:

```bash
# Backend (port 3000)
cd backend
npm install
npm start

# Frontend: Tarayıcıda doğrudan aç
# frontend/config.js içinde:
#   window.BACKEND_URL = 'http://localhost:3000';
```
