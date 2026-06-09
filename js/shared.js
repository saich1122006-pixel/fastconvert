/* ============================================
   FastConvert — Shared Client-Side Logic
   ============================================ */

(function () {
  'use strict';

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  window.$ = $;
  window.$$ = $$;

  const themeToggleBtn = $('#theme-toggle');
  const toastEl = $('#toast');

  // ============================================
  // Theme Toggle
  // ============================================
  function getPreferredTheme() {
    const saved = localStorage.getItem('fc-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fc-theme', theme);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
      themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  applyTheme(getPreferredTheme());

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // ============================================
  // Toast Notifications
  // ============================================
  let toastTimeout = null;

  window.showToast = function(message, type = 'success') {
    if (!toastEl) return;
    clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.className = 'toast';
    toastEl.classList.add(type, 'visible');
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 3500);
  };

  // ============================================
  // Formatting Helpers
  // ============================================
  window.formatBytes = function(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  };

  // ============================================
  // FAQ Accordion Toggle
  // ============================================
  // Handle FAQ toggles
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (btn) {
      btn.addEventListener('click', () => {
        item.classList.toggle('open');
      });
    }
  });

  // Handle Mobile Menu Toggle
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const headerNav = document.querySelector('.header-nav');
  if (mobileMenuToggle && headerNav) {
    mobileMenuToggle.addEventListener('click', () => {
      headerNav.classList.toggle('nav-open');
    });

    // Close menu when clicking a link
    headerNav.querySelectorAll('.header-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.classList.contains('dropdown-toggle')) {
          e.preventDefault();
          const dropdown = link.closest('.nav-dropdown');
          if (dropdown) {
            dropdown.classList.toggle('active');
          }
          return;
        }
        headerNav.classList.remove('nav-open');
      });
    });
  }
})();
