/* ============================================================
   Devis Designer — Serveur (Cloudflare Worker)  [v2 — diagnostique]
   ------------------------------------------------------------
   v2 : correction du parsing du payload Pulse Chariow
        (la vente est dans payload.sale, pas payload.data),
        reverse-lookup saleId -> purchaseId, journalisation
        des webhooks, et endpoint /debug pour le diagnostic.
   ============================================================ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Chariow-Signature, X-Pulse-Id, X-Pulse-Delivery-Id, X-Pulse-Event',
    };
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
      /* ---- 0. DIAGNOSTIC (ouverture dans le navigateur) ---- */
      if (path === '/debug' && request.method === 'GET') {
        const out = {
          version: '2026-09-06 (quota + parrainage serveur)',
          secretKeysCount: Object.keys(getSecretKeys(env)).length,
          adminPassSet: getAdminPass(env) !== 'change-me',
          /* Contrôles de déploiement : si ces lignes manquent, l'app retombe en local. */
          quotaRoutes: true,
          referralRoutes: true,
          quotaLimit: quotaLimit(env),
          quotaWindowDays: quotaWindowMs(env) / 86400000,
          quotaUseIp: quotaUseIp(env),
          chariowKey: null,
          pulseSecret: null,
          productIds: null,
          kvWorks: false,
          lastCheckout: null,
          lastCheck: null,
          webhookCount: 0,
          lastWebhook: null,
          pendingPayments: [],
        };
        const ck = envGet(env, 'CHARIOW_KEY');
        out.chariowKey = ck ? ('presente (' + String(ck).slice(0, 8) + '...)') : 'ABSENTE';
        const ps = envGet(env, 'CHARIOW_PULSE_SECRET');
        out.pulseSecret = ps ? {
          prefix: String(ps).slice(0, 8),
          suffix: String(ps).slice(-4),
          length: String(ps).length,
          whitespace: /\s/.test(String(ps)),
          placeholder: String(ps).indexOf('REMPLACER') !== -1,
        } : 'ABSENTE';
        try {
          const p = JSON.parse(envGet(env, 'PRODUCT_IDS') || '{}');
          out.productIds = { MONTHLY: !!p.MONTHLY, ANNUAL: !!p.ANNUAL, DESIGN: !!p.DESIGN, ALL: !!p.ALL };
        } catch { out.productIds = 'JSON INVALIDE'; }
        try {
          await env.DD_KV.put('debug:test', JSON.stringify(1));
          out.kvWorks = (await env.DD_KV.get('debug:test')) === '1';
          await env.DD_KV.delete('debug:test');
        } catch { out.kvWorks = false; }
        out.lastCheckout = await kvGet(env, 'log:checkout', null);
        out.lastCheck = await kvGet(env, 'log:check', null);
        out.webhookCount = await kvGet(env, 'log:webhook:count', 0);
        out.lastWebhook = await kvGet(env, 'log:webhook:last', null);
        try {
          const listed = await env.DD_KV.list({ prefix: 'pay:' });
          out.pendingPayments = (listed.keys || []).map(k => k.name).slice(-10);
        } catch { out.pendingPayments = 'KV list indisponible'; }
        return json({ ok: true, debug: out }, 200, cors);
      }

      /* ---- 1. VALIDER UN CODE (appelé par l'application) ---- */
      if (path === '/validate' && request.method === 'POST') {
        const body = await request.json();
        const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const deviceId = String(body.deviceId || '');

        const result = await verifyCode(code, env);
        if (!result.ok) return json({ ok: false, message: result.message }, 400, cors);

        const used = await kvGet(env, 'used:' + deviceId, 0);
        if (used >= 20) {
          return json({ ok: false, message: 'Quota gratuit de 20 exports atteint sur cet appareil.' }, 403, cors);
        }
        const already = await kvGet(env, 'code:' + code, null);
        if (already) return json({ ok: false, message: 'Ce code a deja ete utilise.' }, 403, cors);
        await kvPut(env, 'code:' + code, 'used');

        return json({ ok: true, ...result.license }, 200, cors);
      }

      /* ---- 2. ENREGISTRER UN EXPORT (appelé par l'application) ---- */
      if (path === '/export' && request.method === 'POST') {
        const body = await request.json();
        const deviceId = String(body.deviceId || '');
        const used = await kvGet(env, 'used:' + deviceId, 0);
        await kvPut(env, 'used:' + deviceId, used + 1);
        return json({ ok: true, used: used + 1 }, 200, cors);
      }

      /* ---- 2bis. PARRAINAGE : enregistrement (installation + code parrain) ---- */
      if (path === '/referral/register' && request.method === 'POST') {
        const body = await request.json();
        const deviceId = normDevice(body.deviceId);
        if (!deviceId) return json({ ok: false, message: 'Code parrain de cette installation manquant.' }, 400, cors);

        // L'installation est connue : son code parrain peut donc en récompenser d'autres.
        const devKey = 'refdev:' + deviceId;
        if (!(await kvGet(env, devKey, null))) await kvPut(env, devKey, { at: Date.now() });

        const out = { ok: true, deviceId, referred: false, validated: false, exports: 0, reward: null, parrainKnown: false };
        const refCode = normRefCode(body.refCode);
        if (refCode && refCode !== deviceId) {
          const key = REF_LINK_KEY + deviceId;
          let rec = await kvGet(env, key, null);
          if (!rec) {
            // 1 filleul = 1 seul parrain : le premier code enregistré gagne, il n'est jamais écrasé.
            rec = { parrain: refCode, at: Date.now(), exports: 0, validated: false, reward: null };
            await kvPut(env, key, rec);
          }
          out.referred = true;
          out.validated = !!rec.validated;
          out.exports = rec.exports || 0;
          out.reward = rec.reward || null;
          out.parrainKnown = !!(await kvGet(env, 'refdev:' + rec.parrain, null));
        }
        return json(out, 200, cors);
      }

      /* ---- 2ter. PARRAINAGE : le filleul déclare un export = parrainage valide ---- */
      if (path === '/referral/export' && request.method === 'POST') {
        const body = await request.json();
        const deviceId = normDevice(body.deviceId);
        if (!deviceId) return json({ ok: false, message: 'Installation inconnue.' }, 400, cors);

        const refCode = normRefCode(body.refCode);
        const key = REF_LINK_KEY + deviceId;
        let rec = await kvGet(env, key, null);
        if (!rec) {
          if (!refCode || refCode === deviceId) return json({ ok: true, referred: false }, 200, cors);
          rec = { parrain: refCode, at: Date.now(), exports: 0, validated: false, reward: null };
        }
        if (!(await kvGet(env, 'refdev:' + deviceId, null))) await kvPut(env, 'refdev:' + deviceId, { at: Date.now() });

        rec.exports = (rec.exports || 0) + 1;
        // Le quota d'exports gratuit suit la même source de vérité (le serveur ne peut pas être doublé).
        const used = await kvGet(env, 'used:' + deviceId, 0);
        await kvPut(env, 'used:' + deviceId, used + 1);

        if (!rec.validated) {
          const minAge = referralMinAgeMs(env);
          if (minAge > 0 && Date.now() - (rec.at || 0) < minAge) {
            rec.holdUntil = (rec.at || 0) + minAge;
            await kvPut(env, key, rec);
            return json({ ok: true, referred: true, validated: false, exports: rec.exports, reward: null, hold: true, holdUntil: rec.holdUntil }, 200, cors);
          }
          const granted = await monthsGrantedTo(env, rec.parrain);
          if (granted + REF_REWARD_MONTHS > REF_MAX_MONTHS_PER_YEAR) {
            // Parrainage valide, mais le parrain a atteint son plafond annuel : aucune émission.
            rec.validated = true;
            rec.reason = 'cap';
            rec.reward = null;
            await kvPut(env, key, rec);
            return json({ ok: true, referred: true, validated: true, exports: rec.exports, reward: null, reason: 'cap', parrainMonths: granted }, 200, cors);
          }
          rec.validated = true;
          rec.reason = null;
          rec.issuedAt = Date.now();
          // Code nominatif : lié à l'empreinte du code parrain destinataire.
          rec.reward = await makeCode('REFERRAL', REF_REWARD_MONTHS, env, rec.parrain);
          await kvPut(env, key, rec);
          await addMonthsGranted(env, rec.parrain, REF_REWARD_MONTHS, deviceId);
          await kvPut(env, 'refissued:' + refFingerprint(rec.reward), deviceId);
          return json({ ok: true, referred: true, validated: true, exports: rec.exports, reward: rec.reward, parrainMonths: granted + REF_REWARD_MONTHS }, 200, cors);
        }

        await kvPut(env, key, rec);
        return json({ ok: true, referred: true, validated: true, exports: rec.exports, reward: rec.reward || null, reason: rec.reason || null }, 200, cors);
      }

      /* ---- 2quater. PARRAINAGE : etat d'une installation (ressau après réinstall) ---- */
      if (path === '/referral/status' && request.method === 'POST') {
        const body = await request.json();
        const deviceId = normDevice(body.deviceId);
        if (!deviceId) return json({ ok: false, message: 'Installation inconnue.' }, 400, cors);
        const rec = await kvGet(env, REF_LINK_KEY + deviceId, null);
        if (!rec) return json({ ok: true, referred: false }, 200, cors);
        return json({
          ok: true, referred: true, parrain: rec.parrain, exports: rec.exports || 0,
          validated: !!rec.validated, reward: rec.reward || null, reason: rec.reason || null, issuedAt: rec.issuedAt || null,
        }, 200, cors);
      }

      /* ---- 2quinq. PARRAINAGE : stats vendeur (mot de passe requis) ---- */
      if (path === '/referral/stats' && request.method === 'POST') {
        const body = await request.json();
        if (body.admin !== getAdminPass(env)) return json({ ok: false, message: 'Non autorise.' }, 401, cors);
        const out = { ok: true, referred: 0, validated: 0, pending: 0, rewardsIssued: 0, monthsGranted: 0, capBlocked: 0, parrains: 0, truncated: false, top: [] };
        try {
          const listed = await env.DD_KV.list({ prefix: REF_LINK_KEY, limit: 1000 });
          const keys = (listed.keys || []).slice(0, 500);
          if ((listed.keys || []).length >= 1000) out.truncated = true;
          const perParrain = {};
          for (const k of keys) {
            const rec = await kvGet(env, k.name, null);
            if (!rec) continue;
            out.referred++;
            if (rec.validated) out.validated++; else out.pending++;
            if (rec.reward) { out.rewardsIssued++; out.monthsGranted += REF_REWARD_MONTHS; }
            if (rec.reason === 'cap') out.capBlocked++;
            perParrain[rec.parrain] = (perParrain[rec.parrain] || 0) + (rec.reward ? 1 : 0);
          }
          out.parrains = Object.keys(perParrain).length;
          out.top = Object.entries(perParrain).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([code, months]) => ({ code, months }));
        } catch (e) {
          out.error = 'KV indisponible : ' + (e && e.message ? String(e.message).slice(0, 80) : 'erreur');
        }
        return json(out, 200, cors);
      }

      /* ---- 2sex. QUOTA : etat courant (appelé à l'ouverture de l'app) ---- */
      if (path === '/quota/state' && request.method === 'POST') {
        const body = await readJson(request);
        const st = await quotaState(env, normFp(body.fp), normDevice(body.deviceId), request);
        return json({ ok: true, ...st }, 200, cors);
      }

      /* ---- 2sex2. QUOTA : reserver 1 export AVANT de le produire ----
         C'est l'appel qui compte : un client qui ne declare pas ses exports
         ne gagne rien, la fenetre glissante de 30 jours tourne quand meme. */
      if (path === '/quota/reserve' && request.method === 'POST') {
        const body = await readJson(request);
        const fp = normFp(body.fp), deviceId = normDevice(body.deviceId);
        if (!fp && !deviceId) return json({ ok: false, error: 'Empreinte manquante.' }, 200, cors);
        /* On decide sur l'etat AVANT de compter : le 20e export gratuit doit
           passer, le 21e seulement est refusé. */
        const before = await quotaState(env, fp, deviceId);
        if (!before.allowed) {
          await kvPut(env, 'log:quota', { at: new Date().toISOString(), fp: fp.slice(0, 10), deviceId, used: before.used, limit: before.limit });
          return json({ ok: true, ...before, reserved: false, allowed: false, blocked: true }, 200, cors);
        }
        const st = await quotaBump(env, fp, deviceId, +1, request);
        return json({ ok: true, ...st, reserved: true, allowed: true }, 200, cors);
      }

      /* ---- 2sex3. QUOTA : confirmation / restitution ---- */
      if (path === '/quota/confirm' && request.method === 'POST') {
        const body = await readJson(request);
        const fp = normFp(body.fp);
        await kvPut(env, 'qok:' + fp, { at: Date.now(), deviceId: normDevice(body.deviceId) });
        /* On renvoie l'etat : l'app rafraichit son compteur sans 2e appel. */
        const st = await quotaState(env, fp, normDevice(body.deviceId));
        return json({ ok: true, ...st }, 200, cors);
      }
      if (path === '/quota/release' && request.method === 'POST') {
        const body = await readJson(request);
        const st = await quotaBump(env, normFp(body.fp), normDevice(body.deviceId), -1, request);
        return json({ ok: true, ...st }, 200, cors);
      }

      /* ---- 2sex4. QUOTA : demande de deblocage formule par le client ---- */
      if (path === '/quota/request' && request.method === 'POST') {
        const body = await readJson(request);
        const fp = normFp(body.fp);
        if (!fp) return json({ ok: false, message: 'Empreinte manquante.' }, 400, cors);
        const key = 'qreq:' + fp;
        const prev = await kvGet(env, key, null);
        if (prev && Date.now() - (prev.atMs || 0) < 12 * 3600000) {
          return json({ ok: true, already: true, message: 'Votre demande est deja enregistree, le vendeur va la traiter.' }, 200, cors);
        }
        await kvPut(env, key, {
          atMs: Date.now(), at: new Date().toISOString(), fp, deviceId: normDevice(body.deviceId),
          note: String(body.note || '').slice(0, 300), ip: request.headers.get('cf-connecting-ip') || null,
          country: (request.cf && request.cf.country) || null, ua: (request.headers.get('user-agent') || '').slice(0, 160),
        });
        return json({ ok: true, message: 'Demande transmise au vendeur. Vous serez debloque des qu il valide.' }, 200, cors);
      }

      /* ---- 2sex5. QUOTA : file d'attente + grants (espace vendeur) ---- */
      if (path === '/quota/pending' && request.method === 'POST') {
        const body = await readJson(request);
        if (body.admin !== getAdminPass(env)) return json({ ok: false, message: 'Non autorise.' }, 401, cors);
        const out = { ok: true, requests: [], blocked: 0, truncated: false };
        try {
          const listed = await env.DD_KV.list({ prefix: 'qreq:', limit: 200 });
          const keys = (listed.keys || []).slice(0, 60);
          if ((listed.keys || []).length >= 200) out.truncated = true;
          for (const k of keys) {
            const r = await kvGet(env, k.name, null);
            if (!r) continue;
            const st = await quotaState(env, r.fp || k.name.slice(5), r.deviceId || '');
            out.requests.push({ ...r, used: st.used, limit: st.limit, remaining: st.remaining, unlocked: st.unlocked, resetInDays: st.resetInDays });
          }
          out.requests.sort((a, b) => (b.atMs || 0) - (a.atMs || 0));
          out.blocked = out.requests.length;
        } catch (e) {
          out.error = 'KV indisponible : ' + (e && e.message ? String(e.message).slice(0, 80) : 'erreur');
        }
        return json(out, 200, cors);
      }
      if (path === '/quota/grant' && request.method === 'POST') {
        const body = await readJson(request);
        if (body.admin !== getAdminPass(env)) return json({ ok: false, message: 'Non autorise.' }, 401, cors);
        const fp = normFp(body.fp);
        if (!fp) return json({ ok: false, message: 'Empreinte manquante.' }, 400, cors);
        const days = Math.max(1, Math.min(365, parseInt(String(body.days || '30'), 10) || 30));
        await kvPut(env, 'qunlock:' + fp, { until: Date.now() + days * 86400000, days, at: new Date().toISOString() });
        if (body.clearRequest !== false) await kvDelete(env, 'qreq:' + fp);
        return json({ ok: true, message: 'Deblocage de ' + days + ' jour(s) accorde.' }, 200, cors);
      }
      if (path === '/quota/revoke' && request.method === 'POST') {
        const body = await readJson(request);
        if (body.admin !== getAdminPass(env)) return json({ ok: false, message: 'Non autorise.' }, 401, cors);
        const fp = normFp(body.fp);
        await kvDelete(env, 'qunlock:' + fp);
        return json({ ok: true }, 200, cors);
      }

      /* ---- 3. ESPACE VENDEUR : générer un code (avec mot de passe) ---- */
      if (path === '/vendor/gen' && request.method === 'POST') {
        const body = await readJson(request);
        if (body.admin !== getAdminPass(env)) return json({ ok: false, message: 'Non autorise.' }, 401, cors);
        const code = await makeCode(body.kind, body.months || 1, env, body.to);
        return json({ ok: true, code }, 200, cors);
      }

      /* ---- 4. PAIEMENT AUTO : créer la vente Chariow ---- */
      if (path === '/checkout' && request.method === 'POST') {
        const body = await readJson(request);
        const offer = String(body.offer || '').toUpperCase();
        const deviceId = String(body.deviceId || '').toUpperCase();
        const customer = body.customer || {};
        const name = String(customer.name || 'Client').trim();
        const email = String(customer.email || '').trim();
        const phone = String(customer.phone || '').replace(/\D/g, '');

        if (!['MONTHLY', 'ANNUAL', 'DESIGN', 'ALL'].includes(offer)) {
          return json({ ok: false, message: 'Offre inconnue.' }, 400, cors);
        }
        if (!deviceId || !email || !phone) {
          return json({ ok: false, message: 'Nom, email et numero requis.' }, 400, cors);
        }
        const key = envGet(env, 'CHARIOW_KEY');
        if (!key) {
          await kvPut(env, 'log:checkout', { at: new Date().toISOString(), offer, error: 'CHARIOW_KEY absente' });
          return json({ ok: false, message: 'Paiement auto non configure (clé Chariow manquante).' }, 503, cors);
        }

        const products = JSON.parse(envGet(env, 'PRODUCT_IDS') || '{}');
        const productId = products[offer];
        if (!productId) {
          await kvPut(env, 'log:checkout', { at: new Date().toISOString(), offer, error: 'produit non configure' });
          return json({ ok: false, message: 'Produit Chariow non configure pour cette offre.' }, 503, cors);
        }

        const purchaseId = 'dd_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
        const [firstName, ...rest] = name.split(/\s+/);
        const lastName = rest.join(' ') || name;

        const res = await fetch('https://api.chariow.com/v1/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({
            product_id: productId,
            email,
            first_name: firstName.slice(0, 50),
            last_name: lastName.slice(0, 50),
            phone: { number: phone, country_code: 'BJ' },
            custom_metadata: { purchaseId, deviceId },
          }),
        });
        if (!res.ok) {
          const err = await res.text().catch(() => '');
          await kvPut(env, 'log:checkout', { at: new Date().toISOString(), offer, purchaseId, error: 'Chariow HTTP ' + res.status + ' : ' + err.slice(0, 300) });
          return json({ ok: false, message: 'Erreur Chariow (' + res.status + ').' + (err ? ' ' + err.slice(0, 200) : '') }, 502, cors);
        }
        const data = await res.json();
        const step = data.data && data.data.step;
        const saleId = data.data && data.data.purchase && data.data.purchase.id;
        const checkoutUrl = data.data && data.data.payment && data.data.payment.checkout_url;

        if (step === 'completed') {
          await kvPut(env, 'pay:' + purchaseId, { offer, deviceId, saleId, status: 'paid', createdAt: Date.now(), delivered: false });
          const code = await makeCode(offer, 1, env);
          await kvPut(env, 'pay:' + purchaseId, { offer, deviceId, saleId, status: 'paid', createdAt: Date.now(), delivered: true, code });
          await kvPut(env, 'log:checkout', { at: new Date().toISOString(), offer, purchaseId, saleId, result: 'paid immediat' });
          return json({ ok: true, status: 'paid', code, purchaseId }, 200, cors);
        }
        if (step !== 'payment' || !checkoutUrl) {
          await kvPut(env, 'log:checkout', { at: new Date().toISOString(), offer, purchaseId, error: 'reponse Chariow inattendue : ' + JSON.stringify(data).slice(0, 300) });
          return json({ ok: false, message: 'Réponse Chariow inattendue.' }, 502, cors);
        }

        await kvPut(env, 'pay:' + purchaseId, { offer, deviceId, saleId, status: 'pending', createdAt: Date.now(), delivered: false });
        if (saleId) await kvPut(env, 'sale:' + saleId, purchaseId);
        await kvPut(env, 'log:checkout', { at: new Date().toISOString(), offer, purchaseId, saleId, result: 'pending', checkoutUrl: String(checkoutUrl).slice(0, 80) });
        return json({ ok: true, status: 'pending', checkout_url: checkoutUrl, purchaseId }, 200, cors);
      }

      /* ---- 5. PULSE CHARIOW (webhook signé) ---- */
      if (path === '/webhook' && request.method === 'POST') {
        const rawBody = await request.arrayBuffer();
        const signature = request.headers.get('x-chariow-signature') || '';
        const deliveryId = request.headers.get('x-pulse-delivery-id') || '';
        const event = request.headers.get('x-pulse-event') || '';
        const pulseSecret = envGet(env, 'CHARIOW_PULSE_SECRET');

        let payload;
        try { payload = JSON.parse(new TextDecoder().decode(rawBody)); } catch { payload = null; }

        // Parsing robuste du payload Pulse (la vente est dans payload.sale)
        const d = (payload && (payload.sale || payload.data || payload)) || {};
        const saleId = (d.id) ? String(d.id) : null; // accepte tous les formats d'ID Chariow (sal_..., SALEZ...)
        const meta = d.custom_metadata || (payload && payload.custom_metadata) || {};
        let purchaseId = meta.purchaseId || null;
        const evt = (payload && payload.event) || event;

        // Vérification de signature — tolérante aux erreurs de collage
        // (espace en fin de chaîne, guillemets ajoutés par copier-coller)
        let sigOk = false;
        let secretLen = 0;
        if (pulseSecret) {
          const raw = String(pulseSecret);
          secretLen = raw.length;
          const candidates = [...new Set([raw, raw.trim(), raw.replace(/^["']|["']$/g, ''), raw.trim().replace(/^["']|["']$/g, '')])];
          for (const sec of candidates) {
            const expected = 'sha256=' + await hmacHex(new Uint8Array(rawBody), sec);
            if (signature.startsWith('sha256=') && timingSafeEqual(signature, expected)) { sigOk = true; break; }
          }
        }

        // Reverse-lookup : si purchaseId absent, on le retrouve via le saleId
        if (!purchaseId && saleId) purchaseId = await kvGet(env, 'sale:' + saleId, null);

        let action = 'ignore';
        if (!sigOk) {
          action = 'signature REJETEE';
        } else if (deliveryId && (await kvGet(env, 'pulse:' + deliveryId, 0))) {
          action = 'deja traite (idempotent)';
        } else if (purchaseId) {
          if (deliveryId) await kvPut(env, 'pulse:' + deliveryId, 1);
          const rec = await kvGet(env, 'pay:' + purchaseId, null);
          if (rec) {
            const isSuccess = evt.indexOf('success') !== -1 || event.indexOf('success') !== -1;
            const isFail = evt.indexOf('fail') !== -1 || event.indexOf('fail') !== -1;
            const isAbandon = evt.indexOf('abandon') !== -1 || event.indexOf('abandon') !== -1;
            if (isSuccess) {
              // Confirmer auprès de Chariow (source de vérité) avant d'activer
              const key = envGet(env, 'CHARIOW_KEY');
              let paid = true;
              const sid = saleId || rec.saleId;
              if (key && sid) {
                try {
                  const r = await fetch('https://api.chariow.com/v1/sales/' + sid, { headers: { 'Authorization': 'Bearer ' + key } });
                  if (r.ok) {
                    const sd = await r.json();
                    paid = !!(sd.data && (sd.data.status === 'completed' || sd.data.status === 'settled'));
                  }
                } catch { paid = true; }
              }
              if (paid) {
                rec.status = 'paid';
                rec.paidAt = Date.now();
                await kvPut(env, 'pay:' + purchaseId, rec);
                action = 'paiement marque PAID';
              } else {
                action = 're-vérification Chariow : vente pas complete';
              }
            } else if (isFail || isAbandon) {
              rec.status = 'failed';
              await kvPut(env, 'pay:' + purchaseId, rec);
              action = 'paiement marque FAILED';
            } else {
              action = 'evenement non géré : ' + (evt || event);
            }
          } else {
            action = 'purchaseId inconnu du Worker : ' + purchaseId;
          }
        } else {
          action = 'aucun purchaseId/saleId exploitable dans le payload';
        }

        // Journalisation (diagnostic)
        await kvPut(env, 'log:webhook:last', {
          at: new Date().toISOString(),
          event: evt || event || '?',
          deliveryId: deliveryId || null,
          signature: signature ? (signature.slice(0, 15) + '...') : 'ABSENTE',
          signatureOk: sigOk,
          secretLength: secretLen,
          secretSuffix: pulseSecret ? String(pulseSecret).trim().slice(-4) : null,
          pulseSecretSet: !!pulseSecret,
          saleId,
          purchaseId,
          action,
        });
        await kvPut(env, 'log:webhook:count', (await kvGet(env, 'log:webhook:count', 0)) + 1);

        if (!sigOk) return json({ ok: false, message: 'Signature invalide.' }, 401, cors);
        return new Response('OK', { status: 200, headers: cors });
      }

      /* ---- 6. PAIEMENT AUTO : l'app interroge le statut ---- */
      if (path === '/check' && request.method === 'POST') {
        const body = await readJson(request);
        const purchaseId = String(body.purchaseId || '');
        const deviceId = String(body.deviceId || '').toUpperCase();
        const rec = await kvGet(env, 'pay:' + purchaseId, null);
        if (!rec) {
          await kvPut(env, 'log:check', { at: new Date().toISOString(), purchaseId, status: 'unknown' });
          return json({ ok: false, status: 'unknown', message: 'Vente inconnue.' }, 404, cors);
        }
        // Si toujours "pending", vérifier le statut RÉEL de la vente chez Chariow
        // (filet de sécurité si le Pulse/webhook ne passe pas) — max 1 appel API / 15 s
        let realStatus = null;
        if (rec.status === 'pending' && rec.saleId) {
          const key = envGet(env, 'CHARIOW_KEY');
          const cached = await kvGet(env, 'salestatus:' + rec.saleId, null);
          if (key && (!cached || Date.now() - cached.at > 15000)) {
            try {
              const r = await fetch('https://api.chariow.com/v1/sales/' + rec.saleId, { headers: { 'Authorization': 'Bearer ' + key } });
              if (r.ok) {
                const sd = await r.json();
                realStatus = sd.data && sd.data.status;
                await kvPut(env, 'salestatus:' + rec.saleId, { at: Date.now(), status: realStatus });
                if (realStatus === 'completed' || realStatus === 'settled') {
                  rec.status = 'paid';
                  rec.paidAt = Date.now();
                  await kvPut(env, 'pay:' + purchaseId, rec);
                } else if (realStatus === 'failed' || realStatus === 'abandoned') {
                  rec.status = 'failed';
                  await kvPut(env, 'pay:' + purchaseId, rec);
                }
              }
            } catch { realStatus = 'erreur reseau'; }
          } else if (cached) {
            realStatus = cached.status;
          }
        }
        await kvPut(env, 'log:check', { at: new Date().toISOString(), purchaseId, status: rec.status, realSaleStatus: realStatus });
        if (rec.deviceId !== deviceId) return json({ ok: false, status: 'forbidden', message: 'Vente non liee a cette installation.' }, 403, cors);
        // Expire après 15 minutes (le client peut relancer un paiement)
        if (rec.status === 'pending' && Date.now() - rec.createdAt > 15 * 60 * 1000) {
          return json({ ok: true, status: 'expired', message: 'Paiement expiré, relancez.', realSaleStatus: realStatus }, 200, cors);
        }
        if (rec.status === 'paid' && !rec.delivered) {
          const code = await makeCode(rec.offer, 1, env);
          rec.delivered = true;
          rec.code = code;
          await kvPut(env, 'pay:' + purchaseId, rec);
        }
        return json({ ok: true, status: rec.status, code: rec.code || null, realSaleStatus: realStatus }, 200, cors);
      }

      return json({ ok: false, message: 'Route inconnue.' }, 404, cors);
    } catch (e) {
      return json({ ok: false, message: 'Erreur serveur : ' + (e && e.message ? e.message : String(e)).slice(0, 200) }, 500, cors);
    }
  },
};

/* ---------------- QUOTA D'EXPORTS (anti-navigtion-privee) ----------------
   Le compteur local (localStorage/IndexedDB) est remise a zero par une fenetre
   privee ou un autre navigateur : la verite est donc ici, sur deux seaux :
     qfp:<empreinte>   = exports sur 30 jours glissants pour cet appareil (signaux
                        stables, identiques en navigation privee)
     qdev:<deviceId>   = idem pour cette installation (code parrain)
   Le nombre retenu est le MAX des deux : creer un nouveau pseudo-appareil ne
   remet pas le compteur a zero. Deblocage manuel du vendeur : qunlock:<empreinte>.
   Reglable par variables : QUOTA_LIMIT, QUOTA_WINDOW_DAYS, QUOTA_USE_IP. */

/** Corps JSON tolérant : un body invalide ne doit jamais finir en 500. */
async function readJson(request) {
  try {
    const b = await request.json();
    return b && typeof b === 'object' ? b : {};
  } catch { return {}; }
}

function quotaLimit(env) {
  const n = parseInt(String(envGet(env, 'QUOTA_LIMIT') || '20'), 10);
  return isFinite(n) && n > 0 ? n : 20;
}
function quotaWindowMs(env) {
  const d = parseFloat(envGet(env, 'QUOTA_WINDOW_DAYS') || '30');
  return (isFinite(d) && d > 0 ? d : 30) * 86400000;
}
function quotaUseIp(env) {
  return String(envGet(env, 'QUOTA_USE_IP') || '0') === '1';
}
function normFp(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

/** Lit (sans le modifier) l'etat du quota pour une empreinte / une installation. */
async function quotaState(env, fp, deviceId) {
  const limit = quotaLimit(env), win = quotaWindowMs(env), now = Date.now();
  const buckets = [];
  if (fp) buckets.push(await kvGet(env, 'qfp:' + fp, null));
  if (deviceId) buckets.push(await kvGet(env, 'qdev:' + deviceId, null));
  const live = buckets.filter(b => b && typeof b.count === 'number' && now - (b.start || 0) <= win);
  const used = live.reduce((m, b) => Math.max(m, b.count || 0), 0);
  const nextReset = live.length ? Math.min(...live.map(b => (b.start || now) + win)) : now + win;
  const unl = fp ? await kvGet(env, 'qunlock:' + fp, null) : null;
  const unlocked = !!(unl && unl.until > now);
  return {
    used, limit, remaining: unlocked ? limit : Math.max(0, limit - used),
    allowed: unlocked || used < limit, unlocked,
    unlockDays: unlocked ? Math.max(1, Math.ceil((unl.until - now) / 86400000)) : 0,
    resetInDays: Math.max(0, Math.ceil((nextReset - now) / 86400000)),
    windowDays: Math.round(win / 86400000),
  };
}

/** Increment (-1 = restitution) les deux seaux, puis renvoie l'etat. */
async function quotaBump(env, fp, deviceId, delta, request) {
  const limit = quotaLimit(env), win = quotaWindowMs(env), now = Date.now();
  const ip = request && request.headers ? (request.headers.get('cf-connecting-ip') || '') : '';
  const keys = [];
  if (fp) keys.push('qfp:' + fp);
  if (deviceId) keys.push('qdev:' + deviceId);
  if (quotaUseIp(env) && ip && fp) keys.push('qip:' + fp.slice(0, 6) + ':' + ip);
  /* Tentative au-dela du plafond : on NE COMPTE PAS (sinon le compteur
     afficherait 21/20 et chaque refus aggraverait la peine). On renvoie juste
     l'etat, blocked = true. */
  if (delta > 0 && keys.length) {
    const peek = [];
    for (const key of keys) {
      const b = await kvGet(env, key, null);
      if (b && typeof b.count === 'number' && now - (b.start || 0) <= win) peek.push(b.count);
    }
    const unl = fp ? await kvGet(env, 'qunlock:' + fp, null) : null;
    const unlOk = !!(unl && unl.until > now);
    if (!unlOk && peek.length && Math.max(...peek) >= limit) {
      const st = await quotaState(env, fp, deviceId);
      return { ...st, blocked: !st.allowed, delta: 0 };
    }
  }
  for (const key of keys) {
    let b = await kvGet(env, key, null);
    if (!b || typeof b.count !== 'number' || now - (b.start || 0) > win) b = { start: now, count: 0 };
    b.count = Math.max(0, (b.count || 0) + delta);
    b.at = now;
    await kvPut(env, key, b);
  }
  if (fp) {
    const meta = (await kvGet(env, 'qmeta:' + fp, null)) || { devices: [], ips: [], at: now };
    if (deviceId && !meta.devices.includes(deviceId)) meta.devices = [deviceId, ...(meta.devices || [])].slice(0, 6);
    if (ip && !meta.ips.includes(ip)) meta.ips = [ip, ...(meta.ips || [])].slice(0, 6);
    meta.at = now;
    await kvPut(env, 'qmeta:' + fp, meta);
  }
  const st = await quotaState(env, fp, deviceId);
  return { ...st, blocked: !st.allowed, delta };
}

/* ---------------- PARRAINAGE (politique unique de mois offerts) ----------------
   1 parrainage valide (1er export du filleul) = 1 mois offert AU PARRAIN.
   Le serveur est la source de verite : 1 seule recompense par installation de
   filleul, plafond annuel de 12 mois par parrain, codes nominatifs.
   Ces constantes doivent rester identiques a celles de src/lib/license.ts. */

const REF_REWARD_MONTHS = 1;
const REF_MAX_MONTHS_PER_YEAR = 12;
const REF_LINK_KEY = 'ref:';
const REF_MONTHS_KEY = 'refmonths:';
const REF_YEAR_MS = 365 * 86400000;
const REF_CODE_RE = /^DDREF-[A-Z0-9]{4,}$/;

function normDevice(v) {
  const s = String(v || '').trim().toUpperCase();
  return REF_CODE_RE.test(s) ? s : '';
}
function normRefCode(v) {
  const s = String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  return REF_CODE_RE.test(s) ? s : '';
}

/** Empreinte courte du code parrain — ALGORITHME IDENTIQUE a refFingerprint() de l'app. */
function refFingerprint(code) {
  const s = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

/** Anti-abus optionnel : age minimal d'une installation avant que son export valide un parrainage. */
function referralMinAgeMs(env) {
  const h = parseFloat(envGet(env, 'REF_MIN_AGE_HOURS') || '0');
  return (isFinite(h) && h > 0) ? h * 3600000 : 0;
}

/** Mois deja offerts a un parrain sur 12 mois glissants (compteur serveur). */
async function monthsGrantedTo(env, parrainCode) {
  const rec = await kvGet(env, REF_MONTHS_KEY + parrainCode, null);
  if (!rec || !Array.isArray(rec.entries)) return 0;
  const now = Date.now();
  return rec.entries.filter(e => now - e.at <= REF_YEAR_MS).reduce((sum, e) => sum + (e.months || 0), 0);
}

async function addMonthsGranted(env, parrainCode, months, filleul) {
  const rec = (await kvGet(env, REF_MONTHS_KEY + parrainCode, null)) || { entries: [] };
  const now = Date.now();
  rec.entries = (rec.entries || []).filter(e => now - e.at <= REF_YEAR_MS);
  rec.entries.unshift({ at: now, months, filleul: filleul || null });
  rec.entries = rec.entries.slice(0, 100);
  await kvPut(env, REF_MONTHS_KEY + parrainCode, rec);
}

/* ---------------- Utilitaires ---------------- */

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

function envGet(env, name) {
  try {
    if (env && env[name] !== undefined) return env[name];
    if (globalThis[name] !== undefined) return globalThis[name];
  } catch { /* ignore */ }
  return undefined;
}

/* Lecture des variables depuis le binding `env` (CORRECT) —
   IMPORTANT : ne jamais lire les secrets au niveau module (envGet(null, ...))
   sinon les valeurs saisies dans le dashboard Cloudflare ne sont jamais vues. */
function getSecretKeys(env) {
  try { return JSON.parse(envGet(env, 'SECRET_KEYS') || '{}'); } catch { return {}; }
}
function getAdminPass(env) {
  return envGet(env, 'ADMIN_PASS') || 'change-me';
}

async function kvGet(env, key, fallback) {
  try {
    const v = await env.DD_KV.get(key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

async function kvPut(env, key, value) {
  try { await env.DD_KV.put(key, JSON.stringify(value)); } catch { /* ignore */ }
}

async function kvDelete(env, key) {
  try { await env.DD_KV.delete(key); } catch { /* ignore */ }
}

/* ---------------- Base32 (identique à l'app) ---------------- */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32encode(bytes) {
  let out = '', bits = 0, value = 0;
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function b32decode(s) {
  const bytes = []; let bits = 0, value = 0;
  for (const ch of s) { const v = B32.indexOf(ch); if (v < 0) continue; value = (value << 5) | v; bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(bytes);
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
async function hmacHex(message, secret) {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/* ---------------- Vérification d'un code ---------------- */

async function verifyCode(code, env) {
  if (!code.startsWith('DD')) return { ok: false, message: 'Code invalide.' };
  const raw = code.slice(2);
  const body = raw.slice(0, -10);
  const sig = raw.slice(-10);
  for (const [, secret] of Object.entries(getSecretKeys(env))) {
    const expected = b32encode(hexToBytes(await hmacHex(body, secret))).slice(0, 10);
    if (sig === expected) {
      try {
        const payload = JSON.parse(new TextDecoder().decode(b32decode(body)));
        const exp = 30 * 86400000;
        if (!payload.iat || Date.now() - payload.iat > exp) return { ok: false, message: 'Code expire. Contactez le designer.' };
        const kind = payload.kind;
        const now = Date.now();
        const MONTH = 30 * 86400000, YEAR = 365 * 86400000;
        let type, expiresAt = 0, customDesign = false;
        if (kind === 'MONTHLY') { type = 'monthly'; expiresAt = now + (payload.months || 1) * MONTH; }
        else if (kind === 'REFERRAL') {
          /* Recompense de parrainage : 1 mois offert au PARRAIN (jamais facture).
             Plafond : 12 mois offerts sur 12 mois glissants, applique cote application. */
          type = 'monthly';
          expiresAt = now + Math.min(12, Math.max(1, payload.months || 1)) * MONTH;
        }
        else if (kind === 'ANNUAL') { type = 'annual'; expiresAt = now + YEAR; }
        else if (kind === 'ALL') { type = 'all'; expiresAt = now + YEAR; customDesign = true; }
        else if (kind === 'DESIGN') {
          /* Design sur mesure = 1 mois d'exports offerts avec : sinon le client
             bloque a 20 exports paie un design sans pouvoir exporter. */
          type = 'monthly';
          expiresAt = now + MONTH;
          customDesign = true;
        }
        else return { ok: false, message: 'Type de code inconnu.' };
        return { ok: true, license: { type, expiresAt, customDesign } };
      } catch { return { ok: false, message: 'Code illisible.' }; }
    }
  }
  return { ok: false, message: 'Code invalide ou corrompu.' };
}

/* ---------------- Génération d'un code (vendeur / paiement) ---------------- */

async function makeCode(kind, months, env, bindTo) {
  const timed = kind === 'MONTHLY' || kind === 'REFERRAL';
  const payload = {
    kind,
    months: timed ? months : undefined,
    iat: Date.now(),
    n: Math.random().toString(36).slice(2, 8),
    // empreinte du code parrain destinataire : le code n'est activable que chez lui
    to: bindTo ? refFingerprint(String(bindTo).toUpperCase()) : undefined,
  };
  const keys = getSecretKeys(env);
  const secret = Object.values(keys)[Object.keys(keys).length - 1] || 'default-secret';
  const body = b32encode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = b32encode(hexToBytes(await hmacHex(body, secret))).slice(0, 10);
  const raw = 'DD' + body + sig;
  return 'DD-' + raw.slice(2).match(/.{1,4}/g).join('-');
}
