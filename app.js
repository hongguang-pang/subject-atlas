'use strict';
/* 数学图谱 · 学习助手
   数据源：cn-math-taxonomy (CC BY-NC 4.0) */
(function () {
  const $view = document.getElementById('view');
  const $top = document.getElementById('topbar');
  const $toast = document.getElementById('toast');

  /* ================= 工具 ================= */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const SUBJECTS = {
    math: '数学', chinese: '语文', english: '英语', physics: '物理', chemistry: '化学',
    biology: '生物', geography: '地理', history: '历史', morality: '道德与法治', science: '科学'
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => $toast.classList.remove('show'), 1900);
  }
  function gradeLabel(g, subj) {
    g = Number(g);
    if (g >= 1 && g <= 9) return CN[g] + '年级';
    const arr = DB.bySubj ? (DB.bySubj[subj || P.d.subject] || []) : [];
    const t = arr.find((x) => x.g === g);
    if (t && t.c) {
      const m = t.c.match(/^(\S+)\s/);
      if (m && m[1]) return m[1];
    }
    const map = { 10: '高一', 11: '高二', 12: '高三' };
    return map[g] || (g + '年级');
  }
  function stageOf(g) {
    return g <= 6 ? '小学' : g <= 9 ? '初中' : '高中';
  }
  function chapterShort(c) {
    if (!c) return '';
    const m = c.match(/^(\S+?)\s+(.+)$/);
    if (m) return m[1] + ' · ' + m[2];
    return c;
  }
  function cnNum(s) {
    if (/^\d+$/.test(s)) return Number(s);
    const C = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (s === '十') return 10;
    if (/^十/.test(s)) return 10 + (C[s[1]] || 0);
    if (/十$/.test(s)) return (C[s[0]] || 1) * 10;
    if (s.includes('十')) { const p = s.split('十'); return (C[p[0]] || 1) * 10 + (C[p[1]] || 0); }
    return C[s] || 999;
  }
  function unitOf(t) {
    const m = String(t.c || '').match(/第([一二三四五六七八九十\d]+)(单元|章|课|部分)/);
    return m ? cnNum(m[1]) : 999;
  }
  function secOf(t) {
    const m = String(t.c || '').match(/(\d+)\.(\d+)\s*$/);
    return m ? Number(m[2]) : 999;
  }
  const STATUS = {
    mastered: { label: '已掌握', cls: 'ok' },
    shaky: { label: '不太稳', cls: 'warn' },
    weak: { label: '薄弱', cls: 'bad' },
    '': { label: '未学', cls: 'neutral' }
  };
  const stName = (s) => (STATUS[s] || STATUS['']).label;

  /* ================= 判题 ================= */
  const toHalf = (s) => String(s == null ? '' : s).replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, ' ');
  function norm(s) {
    return toHalf(s).replace(/\s+/g, '').replace(/[。．，]$/, '').replace(/，/g, ',').toLowerCase();
  }
  function parseNum(s) {
    if (s == null) return null;
    let t = toHalf(s).trim().replace(/\s+/g, '');
    if (!t) return null;
    if (/^[＝=]/.test(t)) t = t.slice(1);
    let pct = /%$/.test(t);
    if (pct) t = t.slice(0, -1);
    const fm = t.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/);
    if (fm) {
      const a = Number(fm[1]), b = Number(fm[2]);
      if (!b) return null;
      return pct ? a / b / 100 : a / b;
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) {
      const v = Number(t);
      return pct ? v / 100 : v;
    }
    return null;
  }
  function onlyNums(s) {
    const t = toHalf(s).replace(/\s+/g, '');
    const m = t.match(/-?\d+(?:\.\d+)?(?:\/-?\d+(?:\.\d+)?)?/g);
    return m ? m.map((x) => parseNum(x)).filter((x) => x !== null) : [];
  }
  function splitAns(s) {
    return toHalf(s).split(/[或；;,、\/]|以及/).map((x) => x.trim()).filter(Boolean);
  }
  function judge(q, input) {
    const ans = String(q.a == null ? '' : q.a).trim();
    if (q.y === 'choice') {
      return String(input).trim().toUpperCase() === ans.toUpperCase();
    }
    if (q.y === 'self') return true;
    const a = parseNum(ans), b = parseNum(input);
    if (a !== null && b !== null) {
      const tol = Math.max(1e-9, Math.abs(a) * 1e-6);
      if (Math.abs(a - b) <= tol) return true;
    }
    const ni = norm(input);
    if (!ni) return false;
    if (splitAns(ans).some((c) => norm(c) === ni)) return true;
    if (q.ac && q.ac.some((c) => norm(c) === ni)) return true;
    const na = onlyNums(ans), nb = onlyNums(input);
    if (na.length === 1 && nb.length === 1 && Math.abs(na[0] - nb[0]) < 1e-6) return true;
    if (q.u) {
      const sa = na.slice().sort((x, y) => x - y).join(','), sb = nb.slice().sort((x, y) => x - y).join(',');
      if (sa && sa === sb) return true;
    }
    return false;
  }

  /* ================= 数据层 ================= */
  const DB = {
    core: null, std: null, T: {}, pre: {}, nxt: {}, bySubj: {},
    shards: {}, loading: {},
    async init() {
      const [core, std] = await Promise.all([
        fetch('data/core.json').then((r) => r.json()),
        fetch('data/std.json').then((r) => r.json())
      ]);
      this.core = core; this.std = std;
      core.topics.forEach((t) => {
        this.T[t.i] = t;
        if (!this.pre[t.i]) this.pre[t.i] = [];
        if (!this.nxt[t.i]) this.nxt[t.i] = [];
        const b = t.b || 'math';
        if (!this.bySubj[b]) this.bySubj[b] = [];
        this.bySubj[b].push(t);
      });
      core.edges.forEach((e) => {
        const [tid, pid, s, r] = e;
        if (this.pre[tid]) this.pre[tid].push({ id: pid, s: s, r: r });
        if (this.nxt[pid]) this.nxt[pid].push({ id: tid, s: s, r: r });
      });
    },
    async shard(id) {
      const t = this.T[id];
      if (!t) return { topics: {}, questions: {} };
      const h = t.h;
      if (this.shards[h]) return this.shards[h];
      if (!this.loading[h]) {
        this.loading[h] = fetch('data/shard/' + h + '.json').then((r) => r.json()).then((d) => (this.shards[h] = d));
      }
      return this.loading[h];
    },
    async detail(id) {
      const sh = await this.shard(id);
      return sh.topics[id] || { desc: '', mc: [], std: [] };
    },
    async questions(id) {
      const sh = await this.shard(id);
      return (sh.questions[id] || []).slice();
    }
  };

  /* ================= 进度 ================= */
  const P = {
    d: { v: 1, subject: 'math', grade: null, rec: {}, recent: [] },
    load() {
      try {
        const raw = localStorage.getItem('cnm.v1');
        if (raw) this.d = Object.assign(this.d, JSON.parse(raw));
      } catch (e) { }
      if (!this.d.rec) this.d.rec = {};
      if (!Array.isArray(this.d.recent)) this.d.recent = [];
    },
    save() {
      try { localStorage.setItem('cnm.v1', JSON.stringify(this.d)); } catch (e) { }
    },
    get(id) { return this.d.rec[id] || null; },
    set(id, st, extra) {
      this.d.rec[id] = Object.assign({ st: st, at: Date.now() }, this.d.rec[id] || {}, extra || {});
      this.save();
    },
    touch(id) {
      this.d.recent = [id].concat(this.d.recent.filter((x) => x !== id)).slice(0, 12);
      this.save();
    },
    stats() {
      const c = { mastered: 0, shaky: 0, weak: 0, none: 0 };
      allTopics().forEach((t) => {
        const r = this.d.rec[t.i];
        c[r && r.st ? r.st : 'none'] = (c[r && r.st ? r.st : 'none'] || 0) + 1;
      });
      return c;
    }
  };

  /* ================= 路由 ================= */
  let routeToken = 0;
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function setTop(o) {
    const cls = o.back ? 'tb-btn' : '';
    $top.innerHTML =
      (o.back ? '<button class="tb-btn" id="tbback" aria-label="返回"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' : '') +
      '<div class="tb-title">' + esc(o.title || '') + (o.sub ? '<span class="tb-sub">' + esc(o.sub) + '</span>' : '') + '</div>' +
      (o.action || '');
    const b = document.getElementById('tbback');
    if (b) b.onclick = o.onBack || (() => history.back());
  }
  function activeTab(name) {
    document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === name));
  }
  function scrollTop() { $view.scrollTop = 0; }

  /* ---------- 学科与年级选择面板 ---------- */
  function openGradeSheet() {
    if (document.getElementById('gm')) return;
    const el = document.createElement('div');
    el.id = 'gm';
    el.className = 'sheet-mask';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 280); };

    function paint() {
      const grades = [...new Set(allTopics().map((t) => t.g))].sort((a, b) => a - b);
      const groups = [
        { name: '小学', list: grades.filter((g) => g <= 6) },
        { name: '初中', list: grades.filter((g) => g >= 7 && g <= 9) },
        { name: '高中', list: grades.filter((g) => g >= 10) }
      ].filter((x) => x.list.length);
      const subjKeys = Object.keys(SUBJECTS).filter((k) => DB.bySubj[k] && DB.bySubj[k].length);
      el.innerHTML = '<div class="sheet"><div class="sheet-bar"></div>' +
        '<div class="sheet-h">学科与年级</div>' +
        '<div class="g-name">学科（共 ' + (DB.bySubj[P.d.subject] || []).length + ' 个知识点）</div>' +
        '<div class="s-grid">' + subjKeys.map((k) =>
          '<button class="s-btn' + (P.d.subject === k ? ' on' : '') + '" data-s="' + k + '">' + SUBJECTS[k] + '</button>').join('') +
        '</div>' +
        '<div class="g-name" style="margin-top:16px">年级 · ' + esc(SUBJECTS[P.d.subject] || '') + '</div>' +
        groups.map((gr) => '<div class="g-grid" style="margin-bottom:10px">' +
          gr.list.map((x) => '<button class="g-btn' + (P.d.grade === x ? ' on' : '') + '" data-g="' + x + '">' + gradeLabel(x) + '</button>').join('') +
          '</div>').join('') +
        '<button class="btn ghost block" id="gclear" style="margin-top:4px">暂不设置年级</button>' +
        '<div class="tiny" style="text-align:center;margin-top:10px">选择后保存在本机，随时可以修改</div></div>';

      el.querySelectorAll('.s-btn').forEach((b) => (b.onclick = () => {
        if (P.d.subject === b.dataset.s) return;
        P.d.subject = b.dataset.s; P.save();
        const gs = new Set(allTopics().map((t) => t.g));
        if (P.d.grade != null && !gs.has(P.d.grade)) { P.d.grade = null; P.save(); }
        paint();
      }));
      el.querySelectorAll('.g-btn').forEach((b) => (b.onclick = () => {
        P.d.grade = Number(b.dataset.g); P.d.seenGrade = true; P.save();
        toast('已保存：' + (SUBJECTS[P.d.subject] || '') + ' ' + gradeLabel(P.d.grade));
        close(); render();
      }));
      document.getElementById('gclear').onclick = () => {
        P.d.grade = null; P.d.seenGrade = true; P.save();
        close(); toast('已取消年级设置'); render();
      };
    }
    el.onclick = (e) => { if (e.target === el) close(); };
    paint();
  }

  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/');
    return { name: parts[0] || 'home', args: parts.slice(1) };
  }

  async function render() {
    const token = ++routeToken;
    if (window.__diag) { window.__diag.abort(); window.__diag = null; }
    document.body.classList.remove('in-quiz');
    const r = parseRoute();
    try {
      if (r.name === 'topic') { await viewTopic(r.args[0], token); }
      else if (r.name === 'browse') { viewBrowse(token); }
      else if (r.name === 'diagnose') { viewDiagnose(token); }
      else if (r.name === 'me') { viewMe(token); }
      else if (r.name === 'session') { await viewSession(r.args[0], token); }
      else { viewHome(token); }
    } catch (e) {
      console.error(e);
      $view.innerHTML = '<div class="page"><div class="card empty">出错了：' + esc(e.message) + '</div></div>';
    }
  }

  /* ================= 首页 ================= */
  function allTopics(subj) {
    if (!DB.core) return [];
    return DB.bySubj[subj || P.d.subject || 'math'] || [];
  }

  function readyTopics() {
    const rec = P.d.rec;
    const ok = (id) => rec[id] && rec[id].st === 'mastered';
    return allTopics().filter((t) => {
      if (ok(t.i)) return false;
      const ps = DB.pre[t.i] || [];
      if (!ps.length) return true;
      return ps.every((p) => p.s === 'soft' || ok(p.id));
    });
  }

  function recommend(n) {
    const rec = P.d.rec;
    const g = P.d.grade;
    let pool;
    if (g != null) {
      // 设了年级：只推荐当前年级，按学期与章节顺序
      pool = allTopics().filter((t) => t.g === g && !(rec[t.i] && rec[t.i].st === 'mastered'));
      pool.sort((a, b) => {
        const wa = rec[a.i] && rec[a.i].st === 'weak' ? -1 : 0;
        const wb = rec[b.i] && rec[b.i].st === 'weak' ? -1 : 0;
        if (wa !== wb) return wa - wb;
        const sa = a.s === '下' ? 1 : 0, sb = b.s === '下' ? 1 : 0;
        if (sa !== sb) return sa - sb;
        const ua = unitOf(a), ub = unitOf(b);
        if (ua !== ub) return ua - ub;
        const va = secOf(a), vb = secOf(b);
        if (va !== vb) return va - vb;
        return a.n.localeCompare(b.n, 'zh');
      });
    } else {
      pool = readyTopics().filter((t) => !(rec[t.i] && rec[t.i].st === 'mastered'));
      pool = pool.slice().sort((a, b) => {
        const wa = rec[a.i] && rec[a.i].st === 'weak' ? -1 : 0;
        const wb = rec[b.i] && rec[b.i].st === 'weak' ? -1 : 0;
        if (wa !== wb) return wa - wb;
        return a.g - b.g;
      });
    }
    return pool.slice(0, n || 3);
  }

  function ringHTML(pct) {
    const r = 33, c = 2 * Math.PI * r;
    const off = c * (1 - clamp(pct, 0, 1));
    return '<div class="ring"><svg width="78" height="78" viewBox="0 0 78 78">' +
      '<circle cx="39" cy="39" r="' + r + '" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="7"/>' +
      '<circle cx="39" cy="39" r="' + r + '" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg><div class="rv">' + Math.round(pct * 100) + '%</div></div>';
  }

  function itemHTML(t, opts) {
    const r = P.get(t.i);
    const st = (r && r.st) || '';
    return '<a class="item" data-st="' + st + '" href="#/topic/' + t.i + '">' +
      '<i class="bar"></i>' +
      '<div class="body"><div class="name">' + esc(t.n) + '</div>' +
      '<div class="meta">' + esc(gradeLabel(t.g)) + ' · ' + esc(chapterShort(t.c)) + '</div></div>' +
      (st ? '<span class="badge ' + STATUS[st].cls + '">' + STATUS[st].label + '</span>' : (opts && opts.hideBadge ? '' : '<span class="chev"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>')) +
      '</a>';
  }

  function viewHome(token) {
    activeTab('home');
    setTop({ title: '数学图谱', sub: '中小学知识点' });
    const s = P.stats();
    const total = allTopics().length;
    const masteredPct = total ? s.mastered / total : 0;
    const rec = recommend(3);
    const recent = P.d.recent.map((id) => DB.T[id]).filter(Boolean).slice(0, 3);
    const today = new Date();
    const hh = today.getHours();
    const greet = hh < 6 ? '夜深了' : hh < 11 ? '早上好' : hh < 14 ? '中午好' : hh < 18 ? '下午好' : '晚上好';

    $view.innerHTML =
      '<div class="page">' +
      '<div class="hero">' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;position:relative;z-index:3">' +
      '<button class="hero-pill" id="subjPill">📚 ' + esc(SUBJECTS[P.d.subject] || '数学') + ' ▾</button>' +
      '<button class="hero-pill' + (P.d.grade ? '' : ' empty') + '" id="gradePill">🎓 ' + (P.d.grade ? gradeLabel(P.d.grade) : '选年级') + ' ▾</button>' +
      '</div>' +
      '<h1>' + greet + '，今天学一点</h1>' +
      '<p>' + (P.d.grade ? gradeLabel(P.d.grade) + ' · ' : '') + '已收录 ' + total + ' 个' + esc(SUBJECTS[P.d.subject] || '') + '知识点</p>' +
      '<div class="hero-row">' + ringHTML(masteredPct) +
      '<div class="hero-stats">' +
      '<div><b>' + s.mastered + '</b>已掌握</div>' +
      '<div><b>' + (s.shaky + s.weak) + '</b>待加强</div>' +
      '<div><b>' + s.none + '</b>未学习</div>' +
      '<div><b>' + (s.mastered + s.shaky + s.weak) + '</b>已诊断</div>' +
      '</div></div></div>' +

      '<div class="section-h"><h2>继续学习</h2><a class="more" href="#/browse">全部图谱</a></div>' +
      (recent.length
        ? recent.map((t) => itemHTML(t)).join('')
        : '<div class="card" style="text-align:center;padding:22px"><div class="muted" style="margin-bottom:12px">还没有学习记录，从一个知识点开始吧</div><a class="btn" href="#/topic/' + (allTopics()[0] ? allTopics()[0].i : '') + '">从「' + esc(allTopics()[0] ? allTopics()[0].n : '') + '」开始</a></div>') +

      '<div class="section-h"><h2>现在可以学' + (P.d.grade ? '<span class="tiny" style="font-weight:400;margin-left:6px">' + gradeLabel(P.d.grade) + '优先</span>' : '') + '</h2><a class="more" href="#/diagnose">做个诊断</a></div>' +
      '<div id="recList">' + (rec.length ? rec.map((t) => itemHTML(t)).join('') : '') + '</div>' +
      (rec.length
        ? '<div id="recMore" style="text-align:center;margin-top:12px"><button class="btn ghost btn-sm" id="reshuffle">换一批</button></div>'
        : '<div class="card empty">' + (P.d.grade != null ? gradeLabel(P.d.grade) + '的知识点都掌握啦，去图谱里看看别的年级吧' : '这一阶段都掌握啦，去图谱里挑战更多知识点吧') + '</div>') +

      '<div class="section-h"><h2>快速开始</h2></div>' +
      '<div class="card" style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<a class="btn soft btn-sm" href="#/browse">浏览知识点</a>' +
      '<a class="btn soft btn-sm" href="#/diagnose">薄弱点诊断</a>' +
      '<a class="btn ghost btn-sm" href="#/me">查看进度</a>' +
      '</div>' +

      '<div class="tiny" style="text-align:center;margin:22px 0 6px">数据来自开源项目 cn-math-taxonomy · CC BY-NC 4.0</div>' +
      '</div>';

    const gp = document.getElementById('gradePill');
    if (gp) gp.onclick = () => openGradeSheet();
    const sp = document.getElementById('subjPill');
    if (sp) sp.onclick = () => openGradeSheet();
    const rb = document.getElementById('reshuffle');
    if (rb) {
      let off = 0;
      rb.onclick = () => {
        off += 3;
        const list = recommend(off + 3).slice(off);
        if (!list.length) { toast('当前年级的推荐都看过了，去做个诊断试试'); off = 0; return; }
        document.getElementById('recList').innerHTML = list.map((t) => itemHTML(t)).join('');
      };
    }
    scrollTop();
  }

  /* ================= 图谱 ================= */
  const browseState = { q: '', stage: '', domain: '', shown: 40, subject: '' };

  function viewBrowse(token) {
    activeTab('browse');
    setTop({ title: '知识图谱' });
    // 切换了学科（或首次进入）时：默认只看「我的年级」
    if (browseState.subject !== P.d.subject) {
      browseState.subject = P.d.subject;
      browseState.q = ''; browseState.domain = ''; browseState.shown = 40;
      browseState.stage = (P.d.grade != null && allTopics().some((t) => t.g === P.d.grade)) ? '__my' : '';
    }
    const domains = [...new Set(allTopics().map((t) => t.d))];
    $view.innerHTML =
      '<div class="page">' +
      '<div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<input id="q" type="search" placeholder="搜索' + esc(SUBJECTS[P.d.subject] || '') + '知识点、章节…" value="' + esc(browseState.q) + '"></div>' +
      '<div class="chips" id="subjChips" style="margin-top:12px">' +
      Object.keys(SUBJECTS).filter((k) => DB.bySubj[k] && DB.bySubj[k].length).map((k) =>
        '<button class="chip' + (P.d.subject === k ? ' on' : '') + '" data-v="' + k + '">' + SUBJECTS[k] + '</button>').join('') +
      '</div>' +
      '<div class="chips" id="stageChips">' +
      ['', '小学', '初中', '高中'].map((x) => '<button class="chip' + (browseState.stage === x ? ' on' : '') + '" data-v="' + x + '">' + (x || '全部学段') + '</button>').join('') +
      (P.d.grade != null ? '<button class="chip' + (browseState.stage === '__my' ? ' on' : '') + '" data-v="__my">🎓 ' + gradeLabel(P.d.grade) + '</button>' : '') +
      '</div>' +
      '<div class="chips" id="domChips">' +
      ['', ...domains].map((x) => '<button class="chip' + (browseState.domain === x ? ' on' : '') + '" data-v="' + x + '">' + (x || '全部领域') + '</button>').join('') +
      '</div>' +
      '<div class="tiny" id="count" style="margin:10px 2px 8px"></div>' +
      '<div id="list"></div>' +
      '<div style="text-align:center;margin:16px 0"><button class="btn ghost btn-sm" id="more" style="display:none">加载更多</button></div>' +
      '</div>';

    const input = document.getElementById('q');
    const list = document.getElementById('list');
    const countEl = document.getElementById('count');
    const moreBtn = document.getElementById('more');

    function filtered() {
      const q = browseState.q.trim().toLowerCase();
      return allTopics().filter((t) => {
        if (browseState.stage === '__my') { if (t.g !== P.d.grade) return false; }
        else if (browseState.stage && stageOf(t.g) !== browseState.stage) return false;
        if (browseState.domain && t.d !== browseState.domain) return false;
        if (q) {
          const hay = (t.n + ' ' + t.c + ' ' + t.d).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }
    function paint() {
      if (token !== routeToken) return;
      const arr = filtered();
      countEl.textContent = '共 ' + arr.length + ' 个' + (SUBJECTS[P.d.subject] || '') + '知识点';
      const part = arr.slice(0, browseState.shown);
      list.innerHTML = part.length ? part.map((t) => itemHTML(t)).join('') : '<div class="card empty">没有匹配的知识点，换个关键词试试</div>';
      moreBtn.style.display = arr.length > browseState.shown ? '' : 'none';
    }
    input.oninput = () => { browseState.q = input.value; browseState.shown = 40; paint(); };
    document.querySelectorAll('#subjChips .chip').forEach((c) => (c.onclick = () => {
      if (P.d.subject === c.dataset.v) return;
      P.d.subject = c.dataset.s || c.dataset.v; P.save();
      browseState.subject = P.d.subject;
      browseState.q = ''; browseState.domain = ''; browseState.shown = 40;
      browseState.stage = (P.d.grade != null && allTopics().some((t) => t.g === P.d.grade)) ? '__my' : '';
      render();
    }));
    document.querySelectorAll('#stageChips .chip').forEach((c) => (c.onclick = () => {
      browseState.stage = c.dataset.v; browseState.shown = 40;
      document.querySelectorAll('#stageChips .chip').forEach((x) => x.classList.toggle('on', x === c));
      paint();
    }));
    document.querySelectorAll('#domChips .chip').forEach((c) => (c.onclick = () => {
      browseState.domain = c.dataset.v; browseState.shown = 40;
      document.querySelectorAll('#domChips .chip').forEach((x) => x.classList.toggle('on', x === c));
      paint();
    }));
    moreBtn.onclick = () => { browseState.shown += 60; paint(); };
    paint();
    scrollTop();
  }

  /* ================= 知识点详情 ================= */
  async function viewTopic(id, token) {
    const t = DB.T[id];
    if (!t) { $view.innerHTML = '<div class="page"><div class="card empty">找不到这个知识点</div></div>'; return; }
    activeTab('');
    setTop({ title: t.n, sub: gradeLabel(t.g), back: true, onBack: () => history.length > 1 ? history.back() : go('#/browse') });
    const r = P.get(id);
    const st = (r && r.st) || '';
    $view.innerHTML =
      '<div class="page">' +
      '<div class="detail-head"><div class="crumb">' + esc(gradeLabel(t.g) + ' · ' + chapterShort(t.c)) + '</div>' +
      '<h1>' + esc(t.n) + '</h1>' +
      '<div class="tagrow"><span class="badge ' + STATUS[st].cls + '">' + stName(st) + '</span>' +
      '<span class="badge neutral">' + esc(t.d) + '</span>' +
      '<span class="badge neutral">' + ({ conceptual: '概念', procedural: '方法', reasoning: '推理', application: '应用', modeling: '建模' }[t.y] || '知识') + '</span></div></div>' +
      '<div id="detailBody"><div class="card" style="margin-top:16px"><div class="sk" style="height:16px;width:70%"></div><div class="sk" style="height:14px;width:93%;margin-top:10px"></div><div class="sk" style="height:14px;width:55%;margin-top:8px"></div></div></div>' +
      '</div>';

    let d;
    try { d = await DB.detail(id); } catch (e) { document.getElementById('detailBody').innerHTML = '<div class="card empty">内容加载失败，请检查网络</div>'; return; }
    if (token !== routeToken) return;
    P.touch(id);

    const pre = (DB.pre[id] || []).slice().sort((a, b) => (a.s === b.s ? 0 : a.s === 'hard' ? -1 : 1));
    const nxt = DB.nxt[id] || [];
    const stds = (d.std || []).map((x) => ({ c: x.c, item: DB.std[x.id] })).filter((x) => x.item);

    const relHTML = (arr, dir) => arr.length ? '<div class="rel">' + arr.slice(0, 6).map((p) => {
      const pt = DB.T[p.id]; if (!pt) return '';
      const pst = (P.get(p.id) || {}).st || '';
      return '<a class="rel-item" href="#/topic/' + p.id + '"><span class="dot ' + pst + '"></span><span class="nm">' + esc(pt.n) + '</span>' +
        (p.s === 'soft' ? '<span class="rs">相关</span>' : '<span class="badge ' + STATUS[pst].cls + '" style="font-size:10.5px">' + stName(pst) + '</span>') + '</a>' +
        (p.r ? '<div class="rel-reason">' + esc(p.r) + '</div>' : '');
    }).join('') + '</div>' : '<div class="tiny">' + (dir === 'pre' ? '这是起点知识，没有前置要求' : '暂无后续知识点') + '</div>';

    document.getElementById('detailBody').innerHTML =
      '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>知识点说明</h3>' +
      '<div class="desc">' + esc(d.desc || '暂无说明') + '</div></div>' +

      (d.mc && d.mc.length ? '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>学会的标准</h3>' +
        '<ul class="criteria">' + d.mc.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') +

      '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>学习它之前需要</h3>' + relHTML(pre, 'pre') + '</div>' +

      (nxt.length ? '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>学完可以接着学</h3>' + relHTML(nxt, 'next') + '</div>' : '') +

      (stds.length ? '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M4 19.5V6a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 1.5z"/><path d="M8 8h8M8 12h6"/></svg>课标要求</h3>' +
        stds.map((x) => '<div class="stdq"><p>' + esc(x.item.t) + '</p><div class="src">' + esc([x.item.d, x.item.s].filter(Boolean).join(' · ')) + ' · ' + (x.c === 'exact' ? '课标直接要求' : '课标相关') + '</div></div>').join('') + '</div>' : '') +

      (d.links && d.links.length ? '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>跨学科联系</h3>' +
        '<div class="rel">' + d.links.map((l) => {
          const lt = DB.T[l.id];
          if (!lt) return '';
          return '<a class="rel-item" href="#/topic/' + l.id + '"><span class="nm">' + esc(lt.n) + '</span><span class="rs">' + esc(SUBJECTS[lt.b || 'math'] || '') + '</span></a>' +
            (l.reason ? '<div class="rel-reason">' + esc(l.reason) + '</div>' : '');
        }).join('') + '</div></div>' : '') +

      '<div class="cta-bar"><button class="btn block" id="startDiag">' + (st ? '再测一次' : '开始诊断这个知识点') + '</button></div>' +
      '<div class="tiny" style="text-align:center;margin:6px 0 10px">诊断会根据答题情况，沿先修关系回查你的知识断层</div>';

    const b = document.getElementById('startDiag');
    if (b) b.onclick = () => go('#/session/' + id);
    scrollTop();
  }

  /* ================= 诊断入口 ================= */
  function viewDiagnose(token) {
    activeTab('diagnose');
    setTop({ title: '薄弱点诊断' });
    const s = P.stats();
    const weakList = Object.keys(P.d.rec).filter((id) => P.d.rec[id].st === 'weak' && DB.T[id] && (DB.T[id].b || 'math') === P.d.subject).slice(0, 20);
    $view.innerHTML =
      '<div class="page">' +
      '<div class="hero" style="background:linear-gradient(135deg,#3b3f9e,#6d5bd0 60%,#9b7be6)">' +
      '<h1>找到真正的知识断层</h1>' +
      '<p>不是简单判你会或不会，而是顺着先修关系一路回溯，找到卡住你的那一环。</p></div>' +

      '<div class="section-h"><h2>选择诊断目标</h2></div>' +
      '<div class="card">' +
      '<div class="row" id="gradeRow"><span>学科与年级</span><span class="rv">' +
      '<span class="badge brand">' + esc(SUBJECTS[P.d.subject] || '') + '</span>' +
      (P.d.grade ? '<span class="badge brand">' + gradeLabel(P.d.grade) + '</span>' : '<span style="font-size:12.5px">年级未设置</span>') + ' ›</span></div>' +
      '<div style="margin-top:14px"><button class="btn block" id="quick">' +
      (P.d.grade ? '检测一个' + gradeLabel(P.d.grade) + (SUBJECTS[P.d.subject] || '') + '知识点' : '随机检测一个未掌握知识点') + '</button></div>' +
      '<div style="margin-top:10px"><a class="btn ghost block" href="#/browse">从图谱中挑选知识点</a></div>' +
      '</div>' +

      (s.weak || s.shaky ? '<div class="section-h"><h2>待加强（' + (s.weak + s.shaky) + '）</h2></div>' +
        (weakList.length ? weakList.map((id) => itemHTML(DB.T[id])).join('') : '<div class="card empty">薄弱点都补齐了，继续保持</div>') : '') +

      '<div class="section-h"><h2>诊断怎么工作</h2></div>' +
      '<div class="card">' +
      '<ul class="criteria">' +
      '<li>每个知识点出 3 道题，答对 2 道判为「已掌握」，会跳过它的所有先修知识</li>' +
      '<li>答错会追加 1 道确认题：对了记为「不太稳」，还错就记为「薄弱」</li>' +
      '<li>「薄弱」会沿先修关系继续向上追问，直到找到最底层的断点</li>' +
      '<li>最后给出一条按年级从低到高的补漏路径</li>' +
      '</ul></div>' +
      '<div style="height:20px"></div></div>';

    document.getElementById('gradeRow').onclick = () => openGradeSheet();
    document.getElementById('quick').onclick = () => {
      const g = P.d.grade;
      let pool = readyTopics();
      if (g != null) {
        const same = pool.filter((t) => t.g === g);
        pool = same.length ? same : allTopics().filter((t) => t.g === g);
      } else {
        pool = pool.concat(allTopics().filter((t) => !(P.get(t.i) || {}).st));
      }
      if (!pool.length) pool = allTopics();
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) go('#/session/' + pick.i);
    };
    scrollTop();
  }

  /* ================= 答题会话 ================= */
  class Diag {
    constructor(target) {
      this.target = target;
      this.queue = [target];
      this.done = {};
      this.asked = 0;
      this.max = 15;
      this.log = [];
      this.aborted = false;
      this.resolve = null;
    }
    abort() {
      this.aborted = true;
      if (this.resolve) { const f = this.resolve; this.resolve = null; f(false); }
    }
    async run() {
      while (this.queue.length && this.asked < this.max && !this.aborted) {
        const tid = this.queue.shift();
        if (this.done[tid]) continue;
        const res = await this.examine(tid);
        if (this.aborted) return null;
        this.done[tid] = res.status;
        if (res.status === 'weak') {
          const pres = (DB.pre[tid] || []).filter((p) => p.s === 'hard' && !this.done[p.id] && DB.T[p.id]);
          pres.slice(0, 3).forEach((p) => { if (this.queue.indexOf(p.id) < 0) this.queue.push(p.id); });
        }
      }
      return this.result();
    }
    async examine(tid) {
      const all = await DB.questions(tid);
      const order = { basic: 0, standard: 1, challenge: 2, advanced: 3 };
      all.sort((a, b) => (order[a.f] || 0) - (order[b.f] || 0));
      let picks = all.slice(0, 3);
      if (!picks.length) {
        const d = await DB.detail(tid);
        const dq = d.dq || {};
        if (dq.question) picks = [{ id: tid + '_dq', y: 'short', p: dq.question, a: dq.answer || '', e: '' }];
      }
      if (!picks.length) return { status: 'shaky', ok: 0, n: 0, noQuiz: true };
      let ok = 0, n = 0;
      for (const q of picks) {
        if (this.asked >= this.max || this.aborted) break;
        const good = await this.ask(tid, q, {});
        if (this.aborted) return { status: 'shaky', ok: 0, n: 0 };
        n++; if (good) ok++;
      }
      if (ok >= Math.min(2, picks.length)) return { status: 'mastered', ok: ok, n: n };
      const rest = all.filter((q) => picks.indexOf(q) < 0);
      const cq = rest[0] || picks[0];
      if (this.asked >= this.max) return { status: ok > 0 ? 'shaky' : 'weak', ok: ok, n: n };
      const good = await this.ask(tid, cq, { confirm: true });
      if (this.aborted) return { status: 'shaky', ok: ok, n: n };
      return { status: good ? 'shaky' : 'weak', ok: ok, n: n + 1 };
    }
    ask(tid, q, opt) {
      return new Promise((res) => {
        this.resolve = res;
        renderQuiz(this, tid, q, opt);
      });
    }
    onAnswer(ok) {
      if (this.resolve) { const f = this.resolve; this.resolve = null; f(ok); }
    }
    result() {
      const st = this.done;
      const weak = Object.keys(st).filter((id) => st[id] === 'weak');
      // 最底层断点：weak 且没有 weak 先修
      const roots = weak.filter((id) => !(DB.pre[id] || []).some((p) => st[p.id] === 'weak' && p.s === 'hard'));
      // 路径：从根因到目标的所有需补节点，按年级+拓扑
      const need = new Set();
      const visit = (id, depth) => {
        if (need.has(id) || depth > 12) return;
        need.add(id);
        (DB.pre[id] || []).forEach((p) => { if (st[p.id] !== 'mastered' && st[p.id] !== 'shaky') visit(p.id, depth + 1); });
      };
      weak.forEach((id) => visit(id, 0));
      const path = [...need].map((id) => DB.T[id]).filter(Boolean).sort((a, b) => (a.g - b.g) || unitOf(a) - unitOf(b) || a.n.localeCompare(b.n, 'zh'));
      return {
        target: this.target,
        status: this.done[this.target] || 'shaky',
        done: this.done,
        roots: roots.map((id) => DB.T[id]).filter(Boolean),
        path: path,
        asked: this.asked,
        log: this.log
      };
    }
  }

  const TYPE_LABEL = { choice: '选择题', numeric: '填空题', short: '简答题', self: '自评' };
  const DIFF_LABEL = { basic: '基础', standard: '标准', challenge: '提高', advanced: '拓展' };

  function renderQuiz(session, tid, q, opt) {
    const t = DB.T[tid] || { n: '', g: 1 };
    document.body.classList.add('in-quiz');
    const target = DB.T[session.target] || t;
    setTop({
      title: '诊断中', sub: opt.confirm ? '确认题' : '', back: true,
      onBack: () => { session.abort(); go('#/topic/' + session.target); }
    });
    let settled = false;
    let finalOk = null;

    const head = '<div class="page quiz-wrap">' +
      '<div class="quiz-top"><div class="qbar"><i style="width:' + Math.round((session.asked / session.max) * 100) + '%"></i></div>' +
      '<span class="qcount">' + Math.min(session.asked + 1, session.max) + '/' + session.max + '</span></div>' +
      '<div class="tiny" style="margin-bottom:10px">正在诊断：<b style="color:var(--text)">' + esc(t.n) + '</b>' +
      (tid !== session.target ? ' <span style="color:var(--text-3)">（「' + esc(target.n) + '」的先修）</span>' : '') + '</div>' +
      '<div class="qcard">' +
      '<div class="qtag"><span class="badge brand">' + (TYPE_LABEL[q.y] || '练习') + '</span>' +
      (q.f ? '<span class="badge neutral">' + (DIFF_LABEL[q.f] || q.f) + '</span>' : '') +
      (opt.confirm ? '<span class="badge warn">确认题</span>' : '') + '</div>' +
      '<div class="qprompt">' + esc(q.p) + '</div>' +
      (q.fg ? '<div class="figure">' + q.fg + '</div>' : '') +
      '<div id="answerArea"></div>' +
      '<div id="feedback"></div>' +
      '</div>' +
      '<div class="mini-note">答错不要紧，诊断就是在找断点</div></div>';

    $view.innerHTML = head;
    scrollTop();
    session.asked++;

    const area = document.getElementById('answerArea');
    const fb = document.getElementById('feedback');

    function record(ok) {
      finalOk = ok;
      session.log.push({ tid: tid, qid: q.id, ok: ok });
      const correctText = q.y === 'choice'
        ? (function () {
          const c = (q.c || []).find((x) => String(x.k).toUpperCase() === String(q.a).toUpperCase());
          return c ? q.a + '. ' + c.t : q.a;
        })()
        : q.a;
      fb.innerHTML =
        '<div class="feedback ' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? '答对了' : '这题没答对') + '</b>' +
        (ok ? '' : '<div style="font-size:14px">正确答案：' + esc(correctText) + '</div>') +
        (q.e ? '<div class="exp">' + esc(q.e) + '</div>' : '') +
        (!ok ? '<div class="selfjudge"><button class="btn ghost btn-sm" id="appeal">我其实答对了</button></div>' : '') +
        '</div>' +
        '<div style="margin-top:14px"><button class="btn block" id="nextQ">下一题</button></div>';
      const nx = document.getElementById('nextQ');
      nx.onclick = () => {
        if (settled) return;
        settled = true;
        session.onAnswer(finalOk);
      };
      const ap = document.getElementById('appeal');
      if (ap) ap.onclick = () => {
        finalOk = true;
        if (session.log.length) session.log[session.log.length - 1].ok = true;
        fb.querySelector('.feedback').className = 'feedback ok';
        fb.querySelector('.feedback').innerHTML = '<b>已记为答对</b><div class="exp">判题按文本比对，表述不同可能误判，以你的判断为准</div>';
        fb.insertAdjacentHTML('beforeend', '<div style="margin-top:14px"><button class="btn block" id="nextQ2">下一题</button></div>');
        document.getElementById('nextQ2').onclick = () => { if (!settled) { settled = true; session.onAnswer(true); } };
      };
      nx.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    if (q.y === 'choice' && q.c && q.c.length) {
      let picked = null;
      area.innerHTML = '<div class="choices">' + q.c.map((c) =>
        '<button class="choice" data-k="' + esc(c.k) + '"><span class="k">' + esc(c.k) + '</span><span>' + esc(c.t) + '</span></button>'
      ).join('') + '</div><div style="margin-top:14px"><button class="btn block" id="submit" disabled>提交答案</button></div>';
      const btns = area.querySelectorAll('.choice');
      btns.forEach((b) => (b.onclick = () => {
        if (settled) return;
        btns.forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        picked = b.dataset.k;
        document.getElementById('submit').disabled = false;
      }));
      document.getElementById('submit').onclick = () => {
        if (picked == null) return;
        const ok = judge(q, picked);
        btns.forEach((b) => {
          b.classList.toggle('ok', b.dataset.k === String(q.a).toUpperCase());
          if (b.dataset.k === picked && !ok) b.classList.add('no');
          b.disabled = true;
        });
        const sb = document.getElementById('submit');
        if (sb) sb.remove();
        record(ok);
      };
    } else {
      area.innerHTML = '<div class="answer-box"><input id="ansInput" type="text" inputmode="text" autocomplete="off" ' +
        'placeholder="输入答案" enterkeyhint="done"><div style="margin-top:12px"><button class="btn block" id="submit">提交答案</button></div></div>';
      const inp = document.getElementById('ansInput');
      const submit = () => {
        if (settled) return;
        const v = inp.value.trim();
        if (!v) return toast('先写下你的答案');
        const ok = judge(q, v);
        inp.disabled = true;
        document.getElementById('submit').remove();
        record(ok);
      };
      document.getElementById('submit').onclick = submit;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      setTimeout(() => inp.focus(), 250);
    }
  }

  async function viewSession(id, token) {
    const t = DB.T[id];
    if (!t) { go('#/browse'); return; }
    activeTab('');
    $view.innerHTML = '<div class="page"><div class="card" style="margin-top:20px;text-align:center"><div class="sk" style="height:18px;width:60%;margin:0 auto"></div><div class="tiny" style="margin-top:12px">准备诊断…</div></div></div>';
    const s = new Diag(id);
    window.__diag = s;
    const res = await s.run();
    if (token !== routeToken || !res) return;
    window.__diag = null;
    document.body.classList.remove('in-quiz');
    P.set(id, res.status, { asked: res.asked, lastOk: res.log.filter((x) => x.ok).length });
    showResult(res);
  }

  function showResult(res) {
    const t = DB.T[res.target];
    const conf = {
      mastered: { t: '这个知识点你已经掌握了', d: '答题表现稳定，可以继续往后学。' },
      shaky: { t: '掌握得不太稳', d: '有些题答错或犹豫，建议再练几道巩固一下。' },
      weak: { t: '这里是薄弱点', d: '答题暴露出明显问题，下面帮你找到更底层的断点。' }
    }[res.status] || { t: '诊断完成', d: '' };
    setTop({ title: '诊断结果', back: true, onBack: () => go('#/topic/' + res.target) });
    const rootHTML = res.roots.length && res.status === 'weak'
      ? '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>真正的断点可能在这里</h3>' +
        '<div class="rel">' + res.roots.map((r) => '<a class="rel-item" href="#/topic/' + r.i + '"><span class="dot weak"></span><span class="nm">' + esc(r.n) + '</span><span class="rs">' + esc(gradeLabel(r.g)) + '</span></a>').join('') + '</div>' +
        '<div class="tiny" style="margin-top:10px">诊断沿先修关系回溯，这些知识点的前置都没掌握，是最该先补的一层。</div></div>'
      : '';
    const pathHTML = res.path.length && res.status !== 'mastered'
      ? '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>建议补漏顺序</h3>' +
        '<ol class="path">' + res.path.map((p) => '<li><a href="#/topic/' + p.i + '"><div class="pn">' + esc(p.n) + '</div><div class="pm">' + esc(gradeLabel(p.g) + ' · ' + chapterShort(p.c)) + '</div></a></li>').join('') + '</ol></div>'
      : '';
    $view.innerHTML = '<div class="page">' +
      '<div class="result-hero ' + res.status + '" style="margin-top:8px">' +
      '<h2>' + conf.t + '</h2><p>' + esc(t.n) + ' · 共答 ' + res.asked + ' 题</p><p style="margin-top:6px">' + conf.d + '</p></div>' +
      rootHTML + pathHTML +
      '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>本次结果</h3>' +
      '<div class="rel">' + Object.keys(res.done).map((id) => {
        const tt = DB.T[id]; if (!tt) return '';
        const s = res.done[id];
        return '<a class="rel-item" href="#/topic/' + id + '"><span class="dot ' + s + '"></span><span class="nm">' + esc(tt.n) + '</span><span class="badge ' + STATUS[s].cls + '" style="font-size:10.5px">' + stName(s) + '</span></a>';
      }).join('') + '</div></div>' +
      '<div style="display:flex;gap:10px;margin:16px 0 24px">' +
      '<a class="btn ghost" style="flex:1" href="#/topic/' + res.target + '">看看知识点</a>' +
      '<a class="btn" style="flex:1" href="#/session/' + res.target + '">再测一次</a></div>' +
      '<div class="tiny" style="text-align:center;margin-bottom:10px">诊断结果已保存到本机，可在「我的」中查看</div>' +
      '</div>';
    activeTab('');
    scrollTop();
  }

  /* ================= 我的 ================= */
  function viewMe(token) {
    activeTab('me');
    setTop({ title: '我的' });
    const s = P.stats();
    const total = allTopics().length || 1;
    const domains = ['数与代数', '图形与几何', '统计与概率', '综合与实践'];
    const byDom = domains.map((d) => {
      const arr = allTopics().filter((t) => t.d === d);
      const m = arr.filter((t) => (P.get(t.i) || {}).st === 'mastered').length;
      return { d: d, n: arr.length, m: m, pct: arr.length ? m / arr.length : 0 };
    }).filter((x) => x.n);
    const stages = ['小学', '初中', '高中'].map((st) => {
      const arr = allTopics().filter((t) => stageOf(t.g) === st);
      const m = arr.filter((t) => (P.get(t.i) || {}).st === 'mastered').length;
      return { st: st, n: arr.length, m: m, pct: arr.length ? m / arr.length : 0 };
    });
    const weakList = Object.keys(P.d.rec).filter((id) => P.d.rec[id].st === 'weak' && DB.T[id] && (DB.T[id].b || 'math') === P.d.subject);

    $view.innerHTML = '<div class="page">' +
      '<div class="statgrid" style="margin-top:8px">' +
      '<div class="s ok"><b>' + s.mastered + '</b><span>已掌握</span></div>' +
      '<div class="s warn"><b>' + s.shaky + '</b><span>不太稳</span></div>' +
      '<div class="s bad"><b>' + s.weak + '</b><span>薄弱</span></div>' +
      '<div class="s"><b>' + s.none + '</b><span>未学习</span></div></div>' +

      '<div class="list-block"><h3><svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>各学段进度</h3>' +
      '<div class="bars">' + stages.map((x) => '<div class="bar-row"><div class="bl"><span>' + x.st + ' · ' + x.m + '/' + x.n + '</span><span>' + Math.round(x.pct * 100) + '%</span></div>' +
        '<div class="bar-track"><i style="width:' + (x.pct * 100).toFixed(1) + '%"></i></div></div>').join('') + '</div></div>' +

      '<div class="list-block"><h3><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>领域进度 · ' + esc(SUBJECTS[P.d.subject] || '') + '</h3>' +
      '<div class="bars">' + byDom.map((x) => '<div class="bar-row"><div class="bl"><span>' + x.d + ' · ' + x.m + '/' + x.n + '</span><span>' + Math.round(x.pct * 100) + '%</span></div>' +
        '<div class="bar-track"><i style="width:' + (x.pct * 100).toFixed(1) + '%"></i></div></div>').join('') + '</div></div>' +

      '<div class="section-h"><h2>设置</h2></div>' +
      '<div class="list-block" style="padding:6px 16px">' +
      '<div class="row" id="gradeRow2"><span>学科与年级</span><span class="rv">' +
      '<span class="badge brand">' + esc(SUBJECTS[P.d.subject] || '') + '</span>' +
      (P.d.grade ? '<span class="badge brand">' + gradeLabel(P.d.grade) + '</span>' : '<span style="color:var(--text-3);font-size:12.5px">年级未设置</span>') + ' ›</span></div>' +
      '<div class="row"><span>学习记录</span><span class="rv">全学科 ' + Object.keys(P.d.rec).length + ' 个知识点</span></div>' +
      '<div class="row"><span>保存状态</span><span class="rv" style="color:var(--ok)">本机已自动保存</span></div>' +
      '<div class="row" id="exportRow"><span>导出学习数据</span><span class="rv">JSON ›</span></div>' +
      '<div class="row" id="importRow"><span>导入学习数据</span><span class="rv">选择文件 ›</span></div>' +
      '<div class="row" id="resetRow"><span style="color:var(--bad)">清空全部记录</span><span class="rv"></span></div>' +
      '</div>' +

      (weakList.length ? '<div class="section-h"><h2>待补的薄弱点</h2></div>' + weakList.slice(0, 8).map((id) => itemHTML(DB.T[id])).join('') : '') +

      '<div class="section-h"><h2>关于</h2></div>' +
      '<div class="list-block"><div class="tiny" style="line-height:1.8">' +
      '知识点、先修关系与题库来自开源项目 <b>cn-math-taxonomy</b>（作者 xiaoyang111222），覆盖数学、语文、英语、物理、化学、生物、地理、历史、道德与法治、科学十个学科，按 CC BY-NC 4.0 许可用于非商业学习。数据经人工整理但仍可能有误，且原项目声明「未经一线教师审核」，请作为学习参考而非权威教材。<br><br>' +
      '本应用为离线优先的网页应用：所有学习记录只保存在你的手机浏览器里，不会上传。<br><br>' +
      '当前版本 <b>v1.3.0</b>' +
      '</div></div>' +
      '<div style="height:26px"></div></div>';

    document.getElementById('gradeRow2').onclick = () => openGradeSheet();
    document.getElementById('exportRow').onclick = () => {
      const blob = new Blob([JSON.stringify(P.d, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'subject-graph-progress.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    };
    document.getElementById('importRow').onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json';
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const fr = new FileReader();
        fr.onload = () => {
          try {
            const d = JSON.parse(fr.result);
            if (!d || typeof d !== 'object' || !d.rec) throw new Error('格式不对');
            P.d = Object.assign({ v: 1, grade: null, rec: {}, recent: [] }, d);
            P.save(); toast('已导入'); render();
          } catch (e) { toast('导入失败：文件格式不对'); }
        };
        fr.readAsText(f);
      };
      inp.click();
    };
    document.getElementById('resetRow').onclick = () => {
      if (!confirm('确定清空全部学习记录？此操作不可恢复。')) return;
      P.d = { v: 1, grade: P.d.grade, rec: {}, recent: [] };
      P.save(); toast('已清空'); render();
    };
    scrollTop();
  }

  /* ================= 启动 ================= */
  async function boot() {
    P.load();
    $view.innerHTML = '<div class="page" style="padding-top:60px;text-align:center"><div class="tiny">正在加载知识图谱…</div></div>';
    try {
      await DB.init();
    } catch (e) {
      $view.innerHTML = '<div class="page"><div class="card empty" style="margin-top:40px">数据加载失败<br><span class="tiny">' + esc(e.message) + '</span><br><br><button class="btn btn-sm" onclick="location.reload()">重试</button></div></div>';
      return;
    }
    if (!location.hash) location.replace('#/home');
    window.addEventListener('hashchange', render);
    render();
    const r0 = parseRoute();
    if (P.d.grade == null && !P.d.seenGrade && (r0.name === 'home' || !location.hash)) {
      setTimeout(() => openGradeSheet(), 650);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }
  }
  boot();
})();
