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

  // 真像素星：9x9 方格图案（实心，无镂空）
  var STAR_PATTERN = [
    '....#....',
    '....#....',
    '....#....',
    '...###...',
    '#########',
    '.#######.',
    '..#####..',
    '..#####..',
    '.##...##.'
  ];

  function starSVG(fill) {
    var rects = '';
    for (var y = 0; y < STAR_PATTERN.length; y++) {
      for (var x = 0; x < STAR_PATTERN[y].length; x++) {
        if (STAR_PATTERN[y][x] === '#') {
          rects += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + fill + '"/>';
        }
      }
    }
    return '<svg viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
  }

  function starEmptySVG() {
    return starSVG('#c9dffa');
  }

  function starFullSVG() {
    return starSVG(KLEIN);
  }

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
    }
  };

  var OCCUPY_IDS = ['wind', 'water', 'earth', 'bow'];

  var starCountEl = document.getElementById('starCount');
  var starsDisplayEl = document.getElementById('starsDisplay');
  var lastResetEl = document.getElementById('lastReset');
  var energyHintEl = document.getElementById('energyHint');
  var detailView = document.getElementById('detailView');
  var currentDetailId = null;

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
        wrap.innerHTML = starFullSVG();
        fill = '满';
      } else if (i === full && half) {
        wrap.className = 'px-star half';
        wrap.innerHTML = starEmptySVG() + '<div class="cover">' + starFullSVG() + '</div>';
        fill = '半颗';
      } else {
        wrap.className = 'px-star empty';
        wrap.innerHTML = starEmptySVG();
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

    // 五按钮状态（风为常驻被动，无开启动作）
    Object.keys(MODULES).forEach(function (id) {
      var m = MODULES[id];
      var slot = document.querySelector('[data-state-for="' + id + '"]');
      if (!slot) return;
      if (id === 'wind') {
        slot.textContent = '● 常驻被动';
        slot.classList.remove('locked');
      } else if (id === 'thunder') {
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

    if (currentDetailId) renderDetail(s, currentDetailId);
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
      statusEl.textContent = '常驻被动运行中 · 锁定 0.5⭐（无需开启，不可关闭）';
      primaryBtn.hidden = true;
      secondaryBtn.hidden = true;
    } else if (id === 'thunder') {
      statusEl.textContent = '今日已消耗 ' + fmt(s.spent) + '⭐（一次性不返还）';
      primaryBtn.hidden = false;
      primaryBtn.textContent = '触发净化 −' + fmt(m.cost) + '⭐';
      primaryBtn.disabled = available(s) < m.cost;
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

  function openDetail(s, id) {
    currentDetailId = id;
    renderDetail(s, id);
    detailView.hidden = false;
    detailView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeDetail() {
    currentDetailId = null;
    detailView.hidden = true;
  }

  function primaryAction() {
    var s = checkMidnightReset(loadState()).state;
    ensureWind(s);
    var id = currentDetailId;
    if (!id || !MODULES[id]) return;
    var m = MODULES[id];

    if (id === 'wind') return; // 常驻被动，无动作
    if (id === 'thunder') {
      if (available(s) < m.cost) { toast('星不足：净化需要 ' + fmt(m.cost) + '⭐'); return; }
      s.spent = Math.round((s.spent + m.cost) * 10) / 10;
      saveState(s);
      renderAll(s, { animateLast: false });
      toast('正雷净化已触发 −' + fmt(m.cost) + '⭐（不返还）');
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

    document.getElementById('addOneBtn').addEventListener('click', function () { adjust(1); });
    document.getElementById('addHalfBtn').addEventListener('click', function () { adjust(0.5); });
    document.getElementById('removeHalfBtn').addEventListener('click', function () { adjust(-0.5); });

    var btns = document.querySelectorAll('.func-btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        var fresh = checkMidnightReset(loadState()).state;
        saveState(fresh);
        renderAll(fresh);
        openDetail(fresh, b.getAttribute('data-module'));
      });
    });

    document.getElementById('backBtn').addEventListener('click', closeDetail);
    document.getElementById('primaryActionBtn').addEventListener('click', primaryAction);
    document.getElementById('secondaryActionBtn').addEventListener('click', primaryAction);

    if (res.reset) toast('已过 0 点，能量回满 5⭐（浅层过滤层常驻 0.5⭐）');
    else if (migrated) toast('浅层过滤层已转为常驻被动（锁定 0.5⭐）');
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
