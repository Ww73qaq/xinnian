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
      intro: '持续后台过滤碎片杂念、外来心念信号；遵循底层公理：恶意止步，善意无阻，对时停信号仅做身份核验，不拦截。',
      note: '常驻后台运行，开启锁定0.5⭐；关闭屏障，0.5⭐额度返还。仅应急场景使用，日常保持常开；关闭操作带有5秒缓冲，可中途取消。'
    },
    water: {
      name: '情绪心念隔离层', elem: '水', level: '中',
      tarot: '星币六（逆）', cost: 1.5, type: '按需占用',
      intro: '拉起情绪心念隔离屏障，允许心念信号抵达，切断情绪共振，保留心念连接；遵循底层公理：恶意止步，善意无阻。',
      note: '开启需要10秒锚定蓄力，防止用力过重误触发深层防御；收回为5秒平稳卸除，避免心念场剧烈震荡；开启后持续占用对应星星，收回后额度返还。'
    },
    earth: {
      name: '深层印记拦截层', elem: '土', level: '高',
      tarot: '女皇（正）', cost: 3.0, type: '短时占用',
      intro: '厚重深层心念屏障，阻断深层印记侵入，属于紧急防护手段。遵循底层公理：恶意止步，善意无阻。',
      note: '常规模式10秒蓄力，便于精准锚定；紧急模式5秒快速拉起，会损失部分感知精准度；收回统一5秒平稳卸除；开启后持续占用对应星星，收回后额度返还。'
    },
    thunder: {
      name: '一次性正雷净化', elem: '雷', level: '瞬时',
      tarot: '倒吊人（逆）', cost: 2.0, type: '瞬时一次性消耗',
      intro: '心念场净化清理工具，逐层扫过感知区域，清理残留心念印记与杂讯。',
      note: '启动后10秒执行净化流程，执行途中可随时取消终止；属于一次性操作，完成自动结束，不会持续占用星星资源。'
    },
    bow: {
      name: '疏导释放弓箭', elem: '晶', level: '瞬时',
      tarot: '圣杯九（正）', cost: 1.5, type: '蓄力锁定，射出消耗',
      intro: '心念蓄力，疏导多余感知能量向外释放；蓄力阶段能量可控，释放射出后能量不可回收。',
      note: '开启进入10秒蓄力倒计时，蓄力期间可随时取消，能量收回、资源返还；释放动作完成后，能量向外疏导。释放一旦射出，不可撤回，能量无法收回。'
    },
    calibrate: {
      name: '过滤器校准', elem: '风', level: '瞬时',
      tarot: '圣杯国王（正）', cost: 0.5, type: '瞬时一次性消耗',
      intro: '对常驻的浅层过滤屏障进行维护，修复判定漂移，稳定心念感知。',
      note: '一次性维护操作，简单确认弹窗，没有蓄力倒计时；执行消耗0.5⭐，消耗后动作结束，不常驻占用资源。'
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

  // 单文件多页面路由：首页 / 详情页 / 帮助页多选一展示
  var helpView = document.getElementById('helpView');
  function freshState() {
    var res = checkMidnightReset(loadState());
    var st = res.state;
    if (res.reset && st.pending) {
      st.pending = null; // 跨零点：未完成的操作直接取消
      res.pendingDropped = true;
    }
    ensureWind(st);
    if (!('pending' in st)) st.pending = null;
    saveState(st);
    return { state: st, reset: res.reset, pendingDropped: res.pendingDropped };
  }

  function hideAllPages() {
    homeView.hidden = true;
    detailView.hidden = true;
    if (helpView) helpView.hidden = true;
  }

  function showHomePage() {
    currentDetailId = null;
    hideAllPages();
    homeView.hidden = false;
  }

  function showHelpPage() {
    currentDetailId = null;
    hideAllPages();
    if (helpView) helpView.hidden = false;
    window.scrollTo(0, 0);
  }

  function showDetailPage(id) {
    if (!MODULES[id]) return;
    currentDetailId = id;
    hideAllPages();
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

  // 确认弹窗（所有开启 / 触发类动作统一走这里，同视觉风格；tone='danger' 仅关闭类用红色）
  var pendingConfirm = null;
  function showConfirm(text, confirmLabel, onConfirm, tone) {
    document.getElementById('modalText').textContent = text;
    var btn = document.getElementById('modalConfirmBtn');
    btn.textContent = confirmLabel || '确认';
    if (tone === 'danger') btn.classList.add('danger');
    else btn.classList.remove('danger');
    pendingConfirm = onConfirm;
    document.getElementById('confirmModal').hidden = false;
  }
  function hideConfirm() {
    pendingConfirm = null;
    document.getElementById('confirmModal').hidden = true;
    document.getElementById('modalConfirmBtn').classList.remove('danger');
  }

  function closeEditPanels() {
    var p1 = document.getElementById('editIntroPanel');
    var p2 = document.getElementById('editNotePanel');
    if (p1) p1.hidden = true;
    if (p2) p2.hidden = true;
  }

  // 介绍 / 注意事项编辑（消耗星级、对应牌、类型、状态保持只读）
  function wireEdit(kind) {
    var isIntro = kind === 'intro';
    var panelId = isIntro ? 'editIntroPanel' : 'editNotePanel';
    var textId = isIntro ? 'editIntroText' : 'editNoteText';
    var field = isIntro ? 'intro' : 'note';
    document.getElementById(isIntro ? 'editIntroBtn' : 'editNoteBtn').addEventListener('click', function () {
      if (!currentDetailId) return;
      document.getElementById(textId).value = isIntro ? getIntro(currentDetailId) : getNote(currentDetailId);
      document.getElementById(panelId).hidden = false;
    });
    document.getElementById(isIntro ? 'cancelIntroBtn' : 'cancelNoteBtn').addEventListener('click', function () {
      document.getElementById(panelId).hidden = true;
    });
    document.getElementById(isIntro ? 'saveIntroBtn' : 'saveNoteBtn').addEventListener('click', function () {
      if (!currentDetailId) return;
      var v = document.getElementById(textId).value.trim();
      if (!v) { toast('内容不能为空'); return; }
      var s = setCustom(currentDetailId, field, v);
      renderAll(s);
      toast('已保存');
    });
    document.getElementById(isIntro ? 'resetIntroBtn' : 'resetNoteBtn').addEventListener('click', function () {
      if (!currentDetailId) return;
      var s = resetCustom(currentDetailId, field);
      renderAll(s);
      toast('已恢复默认');
    });
  }

  // 倒计时引擎：开/关/蓄力统一走可取消倒计时
  // pending 形态：{id, amount, mode:'occupy'|'consume'|'release', endsAt, runText, doneToast, cancelToast}
  // occupy/consume 在倒计时期间锁定额度；release 期间保持原占用不变
  var countTimer = null;

  function pendingLock(s) {
    if (s.pending && (s.pending.mode === 'occupy' || s.pending.mode === 'consume')) {
      return Math.round(s.pending.amount * 10) / 10;
    }
    return 0;
  }

  function hasPending() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      var p = raw && JSON.parse(raw).pending;
      return !!(p && p.endsAt);
    } catch (e) {
      return false;
    }
  }

  function startCountdown(opts) {
    if (hasPending()) { toast('有操作进行中，请先完成或取消'); return false; }
    var s = freshState().state;
    s.pending = {
      id: opts.id, amount: opts.amount, mode: opts.mode,
      endsAt: Date.now() + opts.seconds * 1000,
      runText: opts.runText, doneToast: opts.doneToast, cancelToast: opts.cancelToast
    };
    saveState(s);
    renderAll(s);
    showCountModal();
    tickCountdown();
    return true;
  }

  function showCountModal() {
    document.getElementById('countModal').hidden = false;
  }
  function hideCountModal() {
    if (countTimer) { clearInterval(countTimer); countTimer = null; }
    document.getElementById('countModal').hidden = true;
  }

  function tickCountdown() {
    if (countTimer) clearInterval(countTimer);
    var update = function () {
      var s = loadState();
      var p = s.pending;
      if (!p || !p.endsAt) { hideCountModal(); return; }
      var remain = Math.ceil((p.endsAt - Date.now()) / 1000);
      if (remain <= 0) { completePending(); return; }
      document.getElementById('countText').textContent = p.runText;
      document.getElementById('countNum').textContent = remain;
    };
    update();
    countTimer = setInterval(update, 200);
  }

  function completePending() {
    var res = freshState();
    var s = res.state;
    var p = s.pending;
    hideCountModal();
    if (!p) { renderAll(s); return; }
    if (p.mode === 'occupy') {
      s.occupied[p.id] = p.amount;
    } else if (p.mode === 'consume') {
      s.spent = Math.round((s.spent + p.amount) * 10) / 10;
    } else if (p.mode === 'release') {
      if (s.occupied[p.id]) delete s.occupied[p.id];
    }
    s.pending = null;
    saveState(s);
    renderAll(s, { animateLast: p.mode !== 'consume' });
    toast(p.doneToast);
  }

  function cancelCountdown() {
    var s = freshState().state;
    var p = s.pending;
    hideCountModal();
    if (!p) return;
    var msg = p.cancelToast || '已取消，锁定资源已返还';
    s.pending = null;
    saveState(s);
    renderAll(s);
    toast(msg);
  }

  var OPEN_COPY = {
    water: '开启情绪隔离层将占用 1.5⭐，10 秒锚定蓄力，倒计时内可取消，确定继续吗？',
    earth: '常规开启深层拦截层将占用 3.0⭐，10 秒蓄力精准锚定，倒计时内可取消，确定继续吗？',
    earthFast: '紧急开启深层拦截层将占用 3.0⭐，5 秒快速拉起（损失部分感知精准度），倒计时内可取消，确定继续吗？',
    bow: '启动疏导蓄力将锁定 1.5⭐，10 秒后射出释放（射出后不可撤回），倒计时内取消全额返还，确定继续吗？',
    thunder: '启动正雷净化将锁定 2.0⭐，10 秒后执行净化（一次性不返还），倒计时内取消不扣星，确定继续吗？'
  };

  function closeDetail() {
    if (location.hash) {
      history.back();
    } else {
      showHomePage();
      window.scrollTo(0, 0);
    }
  }

  function route() {
    if (location.hash === '#help') {
      showHelpPage();
      return;
    }
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
    // 浅层过滤层每日自动常驻：初始即锁定 0.5，可手动关闭返还
    return { date: todayStr(), occupied: { wind: 0.5 }, spent: 0, custom: {} };
  }

  // 老存档迁移：同日的旧状态补上常驻风占用
  function ensureWind(s) {
    if (!s.occupied || typeof s.occupied !== 'object') s.occupied = {};
    if (!s.custom || typeof s.custom !== 'object') s.custom = {};
    if (!s.occupied.wind) {
      s.occupied.wind = 0.5;
      return true;
    }
    return false;
  }

  // 介绍 / 注意事项：用户自定义覆盖（localStorage），只读项不受影响
  function getIntro(id) {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      var c = raw && JSON.parse(raw).custom;
      if (c && c[id] && typeof c[id].intro === 'string' && c[id].intro) return c[id].intro;
    } catch (e) {}
    return MODULES[id].intro;
  }
  function getNote(id) {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      var c = raw && JSON.parse(raw).custom;
      if (c && c[id] && typeof c[id].note === 'string' && c[id].note) return c[id].note;
    } catch (e) {}
    return MODULES[id].note;
  }
  function setCustom(id, field, text) {
    var s = freshState().state;
    if (!s.custom) s.custom = {};
    if (!s.custom[id]) s.custom[id] = {};
    s.custom[id][field] = text;
    saveState(s);
    return s;
  }
  function resetCustom(id, field) {
    var s = freshState().state;
    if (s.custom && s.custom[id]) {
      delete s.custom[id][field];
      if (!s.custom[id].intro && !s.custom[id].note) delete s.custom[id];
    }
    saveState(s);
    return s;
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
    if (!s.spent) s.spent = 0;
    var v = Math.round((TOTAL - occupiedSum(s) - s.spent - pendingLock(s)) * 10) / 10;
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
    energyHintEl.textContent = '可用 ' + fmt(avail) + '★ ＝ 5 − 常驻 ' + fmt(s.occupied.wind || 0) + ' − 占用 ' + fmt(Math.round((occupiedSum(s) - (s.occupied.wind || 0)) * 10) / 10) + ' − 已消耗 ' + fmt(s.spent) + (pendingLock(s) > 0 ? ' − 锁定 ' + fmt(pendingLock(s)) : '');

    // 加星上限：可用已顶满（无可补充的消耗）时禁用加星按钮
    var addOneBtn = document.getElementById('addOneBtn');
    var addHalfBtn = document.getElementById('addHalfBtn');
    var removeHalfBtn = document.getElementById('removeHalfBtn');
    if (addOneBtn) addOneBtn.disabled = s.spent < 1 - 1e-9;
    if (addHalfBtn) addHalfBtn.disabled = s.spent < 0.5 - 1e-9;
    if (removeHalfBtn) removeHalfBtn.disabled = avail < 0.5 - 1e-9;

    // 六按钮状态（风层每日自动开启，可手动关闭返还；倒计时中显示锁定态）
    Object.keys(MODULES).forEach(function (id) {
      var m = MODULES[id];
      var slot = document.querySelector('[data-state-for="' + id + '"]');
      if (!slot) return;
      if (s.pending && s.pending.id === id) {
        slot.textContent = s.pending.mode === 'release' ? '◌ 卸除中…' : '◌ 蓄力中…';
        slot.classList.remove('locked');
      } else if (id === 'wind') {
        if (s.occupied.wind) {
          slot.textContent = '● 常驻运行中';
          slot.classList.remove('locked');
        } else {
          slot.textContent = '○ 可开启';
          slot.classList.remove('locked');
        }
      } else if (id === 'thunder' || id === 'bow' || id === 'calibrate') {
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
    document.getElementById('detailIntro').textContent = '介绍：' + getIntro(id);
    document.getElementById('detailTarot').textContent = m.tarot;
    document.getElementById('detailCost').textContent = fmt(m.cost) + '⭐';
    document.getElementById('detailType').textContent = m.type;
    document.getElementById('detailNote').textContent = getNote(id);
    closeEditPanels();
    var statusEl = document.getElementById('detailStatus');
    var primaryBtn = document.getElementById('primaryActionBtn');
    var altBtn = document.getElementById('altActionBtn');
    var secondaryBtn = document.getElementById('secondaryActionBtn');
    document.getElementById('windToggleBtn').hidden = true; // 仅风层展示右上角弱按钮
    altBtn.hidden = true;
    var pendingHere = s.pending && s.pending.id === id;

    if (id === 'wind') {
      // 底部只保留日常主操作；开/关屏障弱化到右上角小按钮
      primaryBtn.hidden = false;
      primaryBtn.textContent = '前往过滤器校准';
      primaryBtn.disabled = false;
      secondaryBtn.hidden = true;
      var toggleBtn = document.getElementById('windToggleBtn');
      toggleBtn.hidden = false;
      toggleBtn.textContent = s.occupied.wind ? '⏻ 关闭屏障' : '开启屏障';
      if (s.occupied.wind) {
        statusEl.textContent = '常驻运行中 · 锁定 0.5⭐（恶意止步，善意无阻）';
      } else {
        statusEl.textContent = '屏障已下线，0.5⭐已返还';
      }
    } else if (id === 'thunder') {
      statusEl.textContent = pendingHere ? '净化蓄力中…倒计时内可取消' : '今日已消耗 ' + fmt(s.spent) + '⭐（一次性不返还）';
      primaryBtn.hidden = false;
      primaryBtn.textContent = '启动净化（10秒蓄力）';
      primaryBtn.disabled = available(s) < m.cost - 1e-9;
      secondaryBtn.hidden = true;
    } else if (id === 'bow') {
      statusEl.textContent = pendingHere ? '疏导蓄力中…倒计时内取消可全额返还' : '未蓄力 · 射出后能量不可回收';
      primaryBtn.hidden = false;
      primaryBtn.textContent = '启动蓄力（10秒）';
      primaryBtn.disabled = available(s) < m.cost - 1e-9;
      secondaryBtn.hidden = true;
    } else if (id === 'calibrate') {
      statusEl.textContent = '浅层专属维护 · 屏障保持开启 · 今日已消耗 ' + fmt(s.spent) + '⭐';
      primaryBtn.hidden = false;
      primaryBtn.textContent = '触发校准 −' + fmt(m.cost) + '⭐';
      primaryBtn.disabled = available(s) < m.cost - 1e-9;
      secondaryBtn.hidden = true;
    } else if (id === 'earth') {
      primaryBtn.hidden = false;
      if (s.occupied.earth) {
        statusEl.textContent = pendingHere ? '屏障卸除中…倒计时内可取消' : '开启中，占用 ' + fmt(m.cost) + '⭐（收回接地可归还）';
        primaryBtn.textContent = '收回接地（5秒卸除）';
        primaryBtn.disabled = false;
      } else {
        statusEl.textContent = pendingHere ? '屏障拉起中…倒计时内可取消' : (available(s) >= m.cost - 1e-9 ? '未开启，可手动开启' : '星不足，无法开启（需 ' + fmt(m.cost) + '⭐）');
        primaryBtn.textContent = '常规开启（10秒）';
        primaryBtn.disabled = available(s) < m.cost - 1e-9;
        altBtn.hidden = false;
        altBtn.textContent = '紧急开启（5秒）';
        altBtn.disabled = available(s) < m.cost - 1e-9;
      }
      secondaryBtn.hidden = true;
    } else {
      primaryBtn.hidden = false;
      if (s.occupied[id]) {
        statusEl.textContent = pendingHere ? '屏障卸除中…倒计时内可取消' : '开启中，占用 ' + fmt(m.cost) + '⭐（收回接地可归还）';
        primaryBtn.textContent = '收回接地（5秒卸除）';
        primaryBtn.disabled = false;
        secondaryBtn.hidden = true;
      } else {
        statusEl.textContent = pendingHere ? '屏障拉起中…倒计时内可取消' : (available(s) >= m.cost ? '未开启，可手动开启' : '星不足，无法开启（需 ' + fmt(m.cost) + '⭐）');
        primaryBtn.textContent = '开启（10秒蓄力）';
        primaryBtn.disabled = available(s) < m.cost;
        secondaryBtn.hidden = true;
      }
    }
    if (pendingHere && id !== 'wind') {
      // 倒计时进行中：本题内不再接受新的开/关动作，去倒计时弹窗取消
      primaryBtn.disabled = true;
      altBtn.disabled = true;
    }
  }

  function primaryAction() {
    var s = freshState().state;
    var id = currentDetailId;
    if (!id || !MODULES[id]) return;
    var m = MODULES[id];
    if (hasPending()) { toast('有操作进行中，请先完成或取消'); return; }

    if (id === 'wind') {
      openDetail('calibrate'); // 底部唯一主按钮：前往过滤器校准
      return;
    }
    if (id === 'thunder') {
      if (available(s) < m.cost - 1e-9) { toast('星不足：净化需要 ' + fmt(m.cost) + '⭐'); return; }
      showConfirm(OPEN_COPY.thunder, '确认启动', function () {
        startCountdown({
          id: 'thunder', amount: m.cost, mode: 'consume', seconds: 10,
          runText: '正雷净化执行中…倒计时内可取消',
          doneToast: '正雷净化完成 −' + fmt(m.cost) + '⭐（不返还）',
          cancelToast: '净化已终止，未消耗星星'
        });
      });
      return;
    }
    if (id === 'bow') {
      if (available(s) < m.cost - 1e-9) { toast('星不足：蓄力需要 ' + fmt(m.cost) + '⭐'); return; }
      showConfirm(OPEN_COPY.bow, '确认蓄力', function () {
        startCountdown({
          id: 'bow', amount: m.cost, mode: 'consume', seconds: 10,
          runText: '疏导蓄力中…倒计时内取消可全额返还',
          doneToast: '弓箭已射出释放 −' + fmt(m.cost) + '⭐（不可撤回）',
          cancelToast: '蓄力已取消，能量收回、资源返还'
        });
      });
      return;
    }
    if (id === 'calibrate') {
      // 前置资源校验：可用不足 0.5⭐ 直接拦截；通过则弹窗确认后再扣
      if (available(s) < m.cost - 1e-9) { toast('星不足：校准需要 0.5⭐，动作未运行'); return; }
      showConfirm(CALIBRATE_COPY, '确认校准', function () {
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
      // 收回接地：统一 5 秒平稳卸除，倒计时内可取消
      startCountdown({
        id: id, amount: m.cost, mode: 'release', seconds: 5,
        runText: '正在收回' + m.name + '…倒计时内可取消',
        doneToast: m.name + '已收回接地，归还 ' + fmt(m.cost) + '⭐',
        cancelToast: '已取消收回，屏障保持开启'
      });
    } else {
      if (available(s) < m.cost - 1e-9) { toast('星不足：需要 ' + fmt(m.cost) + '⭐'); return; }
      showConfirm(OPEN_COPY[id] || ('开启' + m.name + '将占用 ' + fmt(m.cost) + '⭐，确定继续吗？'), '确认开启', function () {
        startCountdown({
          id: id, amount: m.cost, mode: 'occupy', seconds: 10,
          runText: '正在开启' + m.name + '…倒计时内可取消',
          doneToast: m.name + '已开启，占用 ' + fmt(m.cost) + '⭐',
          cancelToast: '开启已取消，资源未锁定'
        });
      });
    }
  }

  // 土层紧急开启：5 秒快速拉起（损失部分感知精准度）
  function earthFastAction() {
    if (currentDetailId !== 'earth') return;
    var s = freshState().state;
    var m = MODULES.earth;
    if (hasPending()) { toast('有操作进行中，请先完成或取消'); return; }
    if (s.occupied.earth) return;
    if (available(s) < m.cost - 1e-9) { toast('星不足：需要 ' + fmt(m.cost) + '⭐'); return; }
    showConfirm(OPEN_COPY.earthFast, '紧急开启', function () {
      startCountdown({
        id: 'earth', amount: m.cost, mode: 'occupy', seconds: 5,
        runText: '紧急拉起深层屏障…倒计时内可取消',
        doneToast: '深层屏障已紧急拉起，占用 ' + fmt(m.cost) + '⭐',
        cancelToast: '紧急开启已取消，资源未锁定'
      });
    });
  }

  // 右上角弱按钮：风层屏障开（确认后直接开启，无倒计时）/ 关（二次确认 + 5 秒可取消倒计时）
  function windToggle() {
    var s = freshState().state;
    if (hasPending()) { toast('有操作进行中，请先完成或取消'); return; }
    if (s.occupied.wind) {
      showConfirm('关闭后将返还 0.5⭐，屏障下线，确定继续吗？', '确认关闭', function () {
        startCountdown({
          id: 'wind', amount: 0.5, mode: 'release', seconds: 5,
          runText: '浅层屏障正在下线…倒计时内可取消',
          doneToast: '浅层屏障已下线，返还 0.5⭐',
          cancelToast: '已取消关闭，屏障保持开启'
        });
      }, 'danger');
    } else {
      if (available(s) < 0.5 - 1e-9) { toast('星不足：开启需要 0.5⭐'); return; }
      showConfirm('开启浅层屏障将占用 0.5⭐，确定继续吗？', '确认开启', function () {
        var st = freshState().state;
        if (st.occupied.wind) { renderAll(st); return; }
        if (available(st) < 0.5 - 1e-9) { toast('星不足：开启需要 0.5⭐'); return; }
        st.occupied.wind = 0.5;
        saveState(st);
        renderAll(st, { animateLast: false });
        toast('浅层屏障已开启，占用 0.5⭐');
      });
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
      var maxSpent = Math.round((TOTAL - occupiedSum(s) - pendingLock(s)) * 10) / 10;
      if (want > maxSpent + 1e-9) { toast('取消过多：占用中资源不可透支'); return; }
      s.spent = want;
    }
    saveState(s);
    renderAll(s, { animateLast: manualDelta > 0 });
    toast(manualDelta > 0 ? '已补充 ' + fmt(manualDelta) + '⭐' : '已取消 ' + fmt(-manualDelta) + '⭐');
  }

  function init() {
    var f0 = freshState();
    var s = f0.state;
    var migrated = !!(s.occupied && s.occupied.wind);
    saveState(s);
    renderAll(s);
    route(); // 支持带 #m-xxx / #help 直连进入
    window.addEventListener('hashchange', route);
    // 跨重载恢复未完成的倒计时（已过期的直接落账）
    if (s.pending && s.pending.endsAt) {
      showCountModal();
      tickCountdown();
      toast('上次的操作继续倒计时');
    }

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
    document.getElementById('altActionBtn').addEventListener('click', earthFastAction);
    document.getElementById('windToggleBtn').addEventListener('click', windToggle);
    document.getElementById('countCancelBtn').addEventListener('click', cancelCountdown);
    document.getElementById('helpLink').addEventListener('click', function () {
      if (location.hash === '#help') route();
      else location.hash = '#help';
    });
    document.getElementById('helpBackBtn').addEventListener('click', closeDetail);
    wireEdit('intro');
    wireEdit('note');
    document.getElementById('modalConfirmBtn').addEventListener('click', function () {
      var fn = pendingConfirm;
      hideConfirm();
      if (fn) fn();
    });
    document.getElementById('modalCancelBtn').addEventListener('click', hideConfirm);
    document.getElementById('confirmModal').addEventListener('click', function (e) {
      if (e.target === this) hideConfirm();
    });

    if (f0.pendingDropped) toast('已过 0 点，能量回满，未完成的操作已取消');
    else if (f0.reset) toast('已过 0 点，能量回满 5⭐（浅层过滤层自动常驻 0.5⭐）');
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
