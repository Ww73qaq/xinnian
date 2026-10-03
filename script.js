/**
 * 心念星辰 · 星愿守卫
 * 纯前端本地运行：localStorage 存档，本机系统时间做 0 点刷新，断网可用。
 * 能量模型：每日总量 5，可用 = 5 − 占用合计 − 瞬时已消耗；步长 0.5。
 */
(function () {
  'use strict';

  var TOTAL = 5;
  var STATE_KEY = 'xinnian_guard_state_v1';
  var KLEIN = '#002fa7';

  // 真像素星：24x24 细格光栅化标准正五角星（顶点朝上，内外径比 0.382）
  var STAR_N = 24;
  var STAR_CX = 12;
  var STAR_CY = 12;
  var STAR_R = 11.4;
  var STAR_POLY = (function () {
    var pts = [];
    var r = STAR_R * 0.382;
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = i % 2 === 0 ? STAR_R : r;
      pts.push([STAR_CX + rad * Math.cos(ang), STAR_CY + rad * Math.sin(ang)]);
    }
    return pts;
  })();

  function inStar(x, y) {
    var inside = false;
    var n = STAR_POLY.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = STAR_POLY[i][0], yi = STAR_POLY[i][1];
      var xj = STAR_POLY[j][0], yj = STAR_POLY[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // kind: 'full' | 'half' | 'empty'；半颗以第 12 列为界，格子级精确对半
  function buildStarSVG(kind) {
    var rects = '';
    for (var row = 0; row < STAR_N; row++) {
      for (var col = 0; col < STAR_N; col++) {
        if (!inStar(col + 0.5, row + 0.5)) continue;
        var fill;
        if (kind === 'full') fill = KLEIN;
        else if (kind === 'half') fill = col < STAR_N / 2 ? KLEIN : '#c9dffa';
        else fill = '#c9dffa';
        rects += '<rect x="' + col + '" y="' + row + '" width="1.02" height="1.02" fill="' + fill + '"/>';
      }
    }
    return '<svg viewBox="0 0 24 24" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
  }

  var STAR_SVG_FULL = buildStarSVG('full');
  var STAR_SVG_HALF = buildStarSVG('half');
  var STAR_SVG_EMPTY = buildStarSVG('empty');

  // 五功能信息模块（按钮上显示 等级+消耗；详情页显示 冒号内介绍 + 牌/消耗/类型/备注）
  var MODULES = {
    wind: {
      name: '浅层过滤层', elem: '风', level: '低',
      tarot: '星币七（正）', cost: 0.5, type: '常驻占用',
      intro: '过滤碎片杂念、外来独立杂念。',
      note: '被动后台过滤，关闭归还。'
    },
    water: {
      name: '情绪心念隔离层', elem: '水', level: '中',
      tarot: '星币六（逆）', cost: 1.5, type: '按需占用',
      intro: '按需开启，用完收回接地。',
      note: '手动开启，用完收回接地。'
    },
    earth: {
      name: '深层印记拦截层', elem: '土', level: '高',
      tarot: '女皇（正）', cost: 3.0, type: '短时占用',
      intro: '短时开启，用完立刻收回接地。',
      note: '短时开启，用完立刻接地，高消耗。'
    },
    thunder: {
      name: '一次性正雷净化', elem: '雷', level: '瞬时',
      tarot: '倒吊人（逆）', cost: 2.0, type: '瞬时一次性消耗',
      intro: '一次性正雷净化，触发即清理。',
      note: '触发直接消耗，资源不返还。'
    },
    bow: {
      name: '疏导释放弓晶', elem: '晶', level: '按需',
      tarot: '圣杯九（正）', cost: 1.5, type: '按需占用',
      intro: '疏导释放，能量导出后再回收。',
      note: '疏导动作结束，资源归还。'
    },
    calibrate: {
      name: '过滤器校准', elem: '风', level: '瞬时',
      tarot: '圣杯国王（正）', cost: 0.5, type: '瞬时一次性消耗',
      intro: '重置浅层识别判定，刷新白名单身份校验，清理滞留杂讯。浅层屏障维持开启，不会中断基础防护。',
      note: '触发直接扣除，能量不可返还。'
    }
  };

  var CALIBRATE_COPY = '过滤器校准：一次性消耗0.5⭐。重置浅层识别判定，刷新白名单身份校验，清理滞留杂讯。浅层屏障维持开启，不会中断基础防护。消耗能量不可回收。';

  var OCCUPY_IDS = ['wind', 'water', 'earth', 'bow'];

  var starCountEl = document.getElementById('starCount');
  var starsDisplayEl = document.getElementById('starsDisplay');
  var lastResetEl = document.getElementById('lastReset');
  var energyHintEl = document.getElementById('energyHint');
  var detailView = document.getElementById('detailView');
  var homeView = document.getElementById('homeView');
  var currentDetailId = null;

  // 单文件双页面路由：首页 #homeView 与详情页 #detailView 二选一展示
  function freshState() {
    var res = checkMidnightReset(loadState());
    var st = res.state;
    ensureWind(st);
    saveState(st);
    return { state: st, reset: res.reset };
  }

  function showHomePage() {
    currentDetailId = null;
    detailView.hidden = true;
    homeView.hidden = false;
  }

  function showDetailPage(id) {
    if (!MODULES[id]) return;
    currentDetailId = id;
    homeView.hidden = true;
    detailView.hidden = false;
    renderDetail(freshState().state, id);
    detailView.classList.remove('page-enter');
    void detailView.offsetWidth;
    detailView.classList.add('page-enter');
    window.scrollTo(0, 0);
  }

  function openDetail(id) {
    var target = '#m-' + id;
    if (location.hash === target) {
      showDetailPage(id);
    } else {
      location.hash = target; // 经由 hashchange 进入详情页，支持浏览器返回键
    }
  }

  // 确认弹窗（校准专属：先弹窗文案，确认后才扣星）
  var pendingConfirm = null;
  function showConfirm(text, onConfirm) {
    document.getElementById('modalText').textContent = text;
    document.getElementById('modalConfirmBtn').textContent = '确认';
    pendingConfirm = onConfirm;
    document.getElementById('confirmModal').hidden = false;
  }
  function hideConfirm() {
    pendingConfirm = null;
    document.getElementById('confirmModal').hidden = true;
  }

  function closeDetail() {
    if (location.hash) {
      history.back();
    } else {
      showHomePage();
      window.scrollTo(0, 0);
    }
  }

  function route() {
    var m = /^#m-(wind|water|earth|thunder|bow|calibrate)$/.exec(location.hash);
    if (m) {
      showDetailPage(m[1]);
    } else {
      showHomePage();
    }
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function blankState() {
    // 浅层过滤层为常驻被动：每日初始即锁定 0.5，无开启/关闭按钮
    return { date: todayStr(), occupied: { wind: 0.5 }, spent: 0 };
  }

  // 老存档迁移：同日的旧状态补上常驻风占用
  function ensureWind(s) {
    if (!s.occupied || typeof s.occupied !== 'object') s.occupied = {};
    if (!s.occupied.wind) {
      s.occupied.wind = 0.5;
      return true;
    }
    return false;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return blankState();
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return blankState();
      if (!s.occupied || typeof s.occupied !== 'object') s.occupied = {};
      if (typeof s.spent !== 'number' || isNaN(s.spent)) s.spent = 0;
      return s;
    } catch (e) {
      return blankState();
    }
  }

  function saveState(s) {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  }

  // 0 点自动刷新：本机日期变化即清空占用与消耗，回满 5 颗
  function checkMidnightReset(s) {
    var t = todayStr();
    if (s.date !== t) {
      var fresh = blankState();
      saveState(fresh);
      return { state: fresh, reset: true };
    }
    return { state: s, reset: false };
  }

  function occupiedSum(s) {
    var sum = 0;
    for (var k in s.occupied) {
      if (Object.prototype.hasOwnProperty.call(s.occupied, k)) sum += s.occupied[k];
    }
    return Math.round(sum * 10) / 10;
  }

  function available(s) {
    var v = Math.round((TOTAL - occupiedSum(s) - s.spent) * 10) / 10;
    if (v < 0) v = 0;
    if (v > TOTAL) v = TOTAL;
    return v;
  }

  function fmt(n) {
    return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function renderStars(avail, animateLast) {
    starsDisplayEl.innerHTML = '';
    var full = Math.floor(avail + 1e-9);
    var half = (avail - full) >= 0.5 - 1e-9 ? 1 : 0;
    for (var i = 0; i < TOTAL; i++) {
      var wrap = document.createElement('div');
      var fill;
      if (i < full) {
        wrap.className = 'px-star full';
        wrap.innerHTML = STAR_SVG_FULL;
        fill = '满';
      } else if (i === full && half) {
        wrap.className = 'px-star half';
        wrap.innerHTML = STAR_SVG_HALF;
        fill = '半颗';
      } else {
        wrap.className = 'px-star empty';
        wrap.innerHTML = STAR_SVG_EMPTY;
        fill = '空';
      }
      wrap.title = '第 ' + (i + 1) + ' 颗：' + fill;
      wrap.setAttribute('role', 'img');
      wrap.setAttribute('aria-label', '第 ' + (i + 1) + ' 颗' + fill);
      if (animateLast && i === full + half - 1 && avail > 0) wrap.classList.add('pop');
      starsDisplayEl.appendChild(wrap);
    }
  }

  function renderAll(s, opts) {
    opts = opts || {};
    var avail = available(s);
    starCountEl.textContent = fmt(avail);
    renderStars(avail, opts.animateLast);
    var d = new Date();
    lastResetEl.textContent = '今天 · ' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 0点回满5颗';
    energyHintEl.textContent = '可用 ' + fmt(avail) + '★ ＝ 5 − 常驻 ' + fmt(s.occupied.wind || 0) + ' − 占用 ' + fmt(Math.round((occupiedSum(s) - (s.occupied.wind || 0)) * 10) / 10) + ' − 已消耗 ' + fmt(s.spent);

    // 加星上限：可用已顶满（无可补充的消耗）时禁用加星按钮
    var addOneBtn = document.getElementById('addOneBtn');
    var addHalfBtn = document.getElementById('addHalfBtn');
    var removeHalfBtn = document.getElementById('removeHalfBtn');
    if (addOneBtn) addOneBtn.disabled = s.spent < 1 - 1e-9;
    if (addHalfBtn) addHalfBtn.disabled = s.spent < 0.5 - 1e-9;
    if (removeHalfBtn) removeHalfBtn.disabled = avail < 0.5 - 1e-9;

    // 六按钮状态（风层每日自动开启，可手动关闭返还）
    Object.keys(MODULES).forEach(function (id) {
      var m = MODULES[id];
      var slot = document.querySelector('[data-state-for="' + id + '"]');
      if (!slot) return;
      if (id === 'wind') {
        if (s.occupied.wind) {
          slot.textContent = '● 常驻运行中';
          slot.classList.remove('locked');
        } else {
          slot.textContent = '○ 可开启';
          slot.classList.remove('locked');
        }
      } else if (id === 'thunder' || id === 'calibrate') {
        if (avail >= m.cost) {
          slot.textContent = '○ 可触发';
          slot.classList.remove('locked');
        } else {
          slot.textContent = '× 星不足';
          slot.classList.add('locked');
        }
      } else if (s.occupied[id]) {
        slot.textContent = '● 开启中 −' + fmt(m.cost);
        slot.classList.remove('locked');
      } else if (avail >= m.cost) {
        slot.textContent = '○ 可开启';
        slot.classList.remove('locked');
      } else {
        slot.textContent = '× 星不足';
        slot.classList.add('locked');
      }
    });

    if (currentDetailId && !detailView.hidden) renderDetail(s, currentDetailId);
  }

  function renderDetail(s, id) {
    var m = MODULES[id];
    if (!m) return;
    document.getElementById('detailTitle').textContent = m.name + '（' + m.elem + '）';
    document.getElementById('detailSub').textContent = '等级 ' + m.level + ' · ' + fmt(m.cost) + '⭐ · ' + m.type;
    document.getElementById('detailIntro').textContent = '介绍：' + m.intro;
    document.getElementById('detailTarot').textContent = m.tarot;
    document.getElementById('detailCost').textContent = fmt(m.cost) + '⭐';
    document.getElementById('detailType').textContent = m.type;
    document.getElementById('detailNote').textContent = m.note;
    var statusEl = document.getElementById('detailStatus');
    var primaryBtn = document.getElementById('primaryActionBtn');
    var secondaryBtn = document.getElementById('secondaryActionBtn');

    if (id === 'wind') {
      primaryBtn.hidden = false;
      secondaryBtn.hidden = false;
      secondaryBtn.textContent = '前往过滤器校准';
      if (s.occupied.wind) {
        statusEl.textContent = '常驻运行中 · 锁定 0.5⭐（恶意止步，善意无阻）';
        primaryBtn.textContent = '关闭屏障（返还 0.5⭐）';
        primaryBtn.disabled = false;
      } else {
        statusEl.textContent = '屏障已关闭，0.5⭐已返还';
        primaryBtn.textContent = '开启屏障 −0.5⭐';
        primaryBtn.disabled = available(s) < 0.5 - 1e-9;
      }
    } else if (id === 'thunder') {
      statusEl.textContent = '今日已消耗 ' + fmt(s.spent) + '⭐（一次性不返还）';
      primaryBtn.hidden = false;
      primaryBtn.textContent = '触发净化 −' + fmt(m.cost) + '⭐';
      primaryBtn.disabled = available(s) < m.cost;
      secondaryBtn.hidden = true;
    } else if (id === 'calibrate') {
      statusEl.textContent = '浅层专属维护 · 屏障保持开启 · 今日已消耗 ' + fmt(s.spent) + '⭐';
      primaryBtn.hidden = false;
      primaryBtn.textContent = '触发校准 −' + fmt(m.cost) + '⭐';
      primaryBtn.disabled = available(s) < m.cost - 1e-9;
      secondaryBtn.hidden = true;
    } else {
      primaryBtn.hidden = false;
      if (s.occupied[id]) {
        statusEl.textContent = '开启中，占用 ' + fmt(m.cost) + '⭐（收回接地可归还）';
        primaryBtn.textContent = '收回接地（归还' + fmt(m.cost) + '⭐）';
        secondaryBtn.hidden = true;
      } else {
        statusEl.textContent = available(s) >= m.cost ? '未开启，可手动开启' : '星不足，无法开启（需 ' + fmt(m.cost) + '⭐）';
        primaryBtn.textContent = '开启 −' + fmt(m.cost) + '⭐';
        primaryBtn.disabled = available(s) < m.cost;
        secondaryBtn.hidden = true;
      }
    }
  }

  function primaryAction() {
    var s = checkMidnightReset(loadState()).state;
    ensureWind(s);
    var id = currentDetailId;
    if (!id || !MODULES[id]) return;
    var m = MODULES[id];

    if (id === 'wind') {
      // 每日自动开启常驻；手动关闭则全额返还 0.5⭐
      if (s.occupied.wind) {
        delete s.occupied.wind;
        saveState(s);
        renderAll(s, { animateLast: true });
        toast('浅层屏障已关闭，返还 0.5⭐');
      } else {
        if (available(s) < 0.5 - 1e-9) { toast('星不足：开启需要 0.5⭐'); return; }
        s.occupied.wind = 0.5;
        saveState(s);
        renderAll(s, { animateLast: false });
        toast('浅层屏障已开启，占用 0.5⭐');
      }
      return;
    }
    if (id === 'thunder') {
      if (available(s) < m.cost) { toast('星不足：净化需要 ' + fmt(m.cost) + '⭐'); return; }
      s.spent = Math.round((s.spent + m.cost) * 10) / 10;
      saveState(s);
      renderAll(s, { animateLast: false });
      toast('正雷净化已触发 −' + fmt(m.cost) + '⭐（不返还）');
      return;
    }
    if (id === 'calibrate') {
      // 前置资源校验：可用不足 0.5⭐ 直接拦截；通过则弹窗确认后再扣
      if (available(s) < m.cost - 1e-9) { toast('星不足：校准需要 0.5⭐，动作未运行'); return; }
      showConfirm(CALIBRATE_COPY, function () {
        var st = freshState().state;
        if (available(st) < m.cost - 1e-9) { toast('星不足：校准需要 0.5⭐，动作未运行'); return; }
        st.spent = Math.round((st.spent + m.cost) * 10) / 10;
        saveState(st);
        renderAll(st, { animateLast: false });
        toast('过滤器校准完成 −0.5⭐（不返还）');
      });
      return;
    }

    if (s.occupied[id]) {
      delete s.occupied[id]; // 收回接地，归还
      saveState(s);
      renderAll(s, { animateLast: true });
      toast(m.name + '已收回接地，归还 ' + fmt(m.cost) + '⭐');
    } else {
      if (available(s) < m.cost) { toast('星不足：需要 ' + fmt(m.cost) + '⭐'); return; }
      s.occupied[id] = m.cost;
      saveState(s);
      renderAll(s, { animateLast: false });
      toast(m.name + '已开启，占用 ' + fmt(m.cost) + '⭐');
    }
  }

  function adjust(manualDelta) {
    var s = checkMidnightReset(loadState()).state;
    ensureWind(s);
    if (manualDelta > 0) {
      // 补星：只能补回已消耗部分，顶满 5 即止（按钮同步禁用）
      if (s.spent < manualDelta - 1e-9) { toast('已满 5 颗，无法再加'); return; }
      s.spent = Math.round(Math.max(0, s.spent - manualDelta) * 10) / 10;
    } else {
      var want = Math.round((s.spent - manualDelta) * 10) / 10; // manualDelta 为负
      var maxSpent = Math.round((TOTAL - occupiedSum(s)) * 10) / 10;
      if (want > maxSpent + 1e-9) { toast('取消过多：占用中资源不可透支'); return; }
      s.spent = want;
    }
    saveState(s);
    renderAll(s, { animateLast: manualDelta > 0 });
    toast(manualDelta > 0 ? '已补充 ' + fmt(manualDelta) + '⭐' : '已取消 ' + fmt(-manualDelta) + '⭐');
  }

  function init() {
    var res = checkMidnightReset(loadState());
    var s = res.state;
    var migrated = ensureWind(s);
    saveState(s);
    renderAll(s);
    route(); // 支持带 #m-xxx 直连进入详情页
    window.addEventListener('hashchange', route);

    document.getElementById('addOneBtn').addEventListener('click', function () { adjust(1); });
    document.getElementById('addHalfBtn').addEventListener('click', function () { adjust(0.5); });
    document.getElementById('removeHalfBtn').addEventListener('click', function () { adjust(-0.5); });

    var btns = document.querySelectorAll('.func-btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        var fresh = freshState().state;
        renderAll(fresh);
        openDetail(b.getAttribute('data-module'));
      });
    });

    document.getElementById('backBtn').addEventListener('click', closeDetail);
    document.getElementById('primaryActionBtn').addEventListener('click', primaryAction);
    document.getElementById('secondaryActionBtn').addEventListener('click', function () {
      if (currentDetailId === 'wind') openDetail('calibrate'); // 仅浅层展示校准入口
    });
    document.getElementById('modalConfirmBtn').addEventListener('click', function () {
      var fn = pendingConfirm;
      hideConfirm();
      if (fn) fn();
    });
    document.getElementById('modalCancelBtn').addEventListener('click', hideConfirm);
    document.getElementById('confirmModal').addEventListener('click', function (e) {
      if (e.target === this) hideConfirm();
    });

    if (res.reset) toast('已过 0 点，能量回满 5⭐（浅层过滤层自动常驻 0.5⭐）');
    else if (migrated) toast('浅层过滤层已纳入常驻（每日自动开启）');
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 调试接口
  window.xinnian = {
    modules: MODULES,
    getAvailable: function () { return available(checkMidnightReset(loadState()).state); },
    resetDay: function () { var f = blankState(); saveState(f); renderAll(f); }
  };
})();
