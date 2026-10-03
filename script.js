/**
 * 心念星辰 - 核心JavaScript逻辑
 * 所有功能在浏览器本地运行，不需要后端或网络
 * 数据存储在 localStorage，断网后保留
 */

(function() {
  'use strict';

  // 配置常量
  const STAR_KEY = 'xinnian_stars';
  const RESET_KEY = 'xinnian_lastResetDate';
  const MIDNIGHT_HOUR = 0;
  const MIDNIGHT_MINUTE = 0;

  // DOM 元素引用
  const starCountEl = document.getElementById('starCount');
  const starsDisplayEl = document.getElementById('starsDisplay');
  const addStarBtn = document.getElementById('addStarBtn');
  const lastResetEl = document.getElementById('lastReset');

  // 初始化：读取 localStorage 数据
  function init() {
    loadStars();
    checkMidnightReset();
    renderStars();
    updateUI();
  }

  // 从 localStorage 读取星星数量
  function loadStars() {
    const stored = localStorage.getItem(STAR_KEY);
    if (stored) {
      window.appStars = parseInt(stored, 10);
    } else {
      window.appStars = 0;
    }
  }

  // 保存星星数量到 localStorage
  function saveStars(count) {
    window.appStars = count;
    localStorage.setItem(STAR_KEY, count.toString());
    updateUI();
  }

  // 检查是否需要在午夜重置
  function checkMidnightReset() {
    const lastReset = localStorage.getItem(RESET_KEY);
    const now = new Date();
    const lastResetDate = lastReset ? new Date(lastReset) : null;

    // 如果从未重置过，或者最后重置的日期不等于今天，则重置
    if (!lastResetDate || !isSameDay(lastResetDate, now)) {
      // 保存当前日期为最后重置日期
      const today = new Date(now);
      today.setHours(MIDNIGHT_HOUR, MIDNIGHT_MINUTE, 0, 0);
      localStorage.setItem(RESET_KEY, today.toISOString());
      // 重置星星计数
      saveStars(0);
      // 可以在这里添加重置时的动画或提示
    }
  }

  // 检查两个日期是否是同一天
  function isSameDay(date1, date2) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  // 添加一颗星星
  function addStar() {
    const newCount = (window.appStars || 0) + 1;
    saveStars(newCount);
    createStarElement();
  }

  // 创建星星DOM元素
  function createStarElement() {
    const star = document.createElement('div');
    star.className = 'star';
    star.title = '第 ' + (window.appStars || 0) + ' 颗星星';
    starsDisplayEl.appendChild(star);
    
    // 移除旧的星星，保持数量不超过本地存储的数量
    const stars = starsDisplayEl.querySelectorAll('.star');
    if (stars.length > window.appStars) {
      stars[0].remove();
    }
  }

  // 渲染现有星星（用于离线恢复）
  function renderStars() {
    const currentCount = window.appStars || 0;
    starsDisplayEl.innerHTML = '';
    
    for (let i = 0; i < currentCount; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.title = '第 ' + (i + 1) + ' 颗星星';
      starsDisplayEl.appendChild(star);
    }
  }

  // 更新UI显示
  function updateUI() {
    const count = window.appStars || 0;
    if (starCountEl) {
      starCountEl.textContent = count;
    }
    if (lastResetEl) {
      const lastReset = localStorage.getItem(RESET_KEY);
      if (lastReset) {
        const resetDate = new Date(lastReset);
        lastResetEl.textContent = `最后更新：${formatDate(resetDate)}`;
      } else {
        lastResetEl.textContent = '今天的星星';
      }
    }
  }

  // 格式化日期显示
  function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('zh-CN', options);
  }

  // 事件绑定
  function initEvents() {
    if (addStarBtn) {
      addStarBtn.addEventListener('click', addStar);
    }
    
    // 支持键盘交互
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement === addStarBtn) {
          addStar();
        }
      }
    });
  }

// 在 DOMContentLoaded 后初始化
document.addEventListener('DOMContentLoaded', init);

// 导出测试接口（仅用于调试）
window.xinnian = {
  getStarCount: () => window.appStars,
  resetStars: () => { localStorage.removeItem(STAR_KEY); window.appStars = 0; init(); }
};