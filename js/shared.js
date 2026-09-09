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

  // Theme: fixed light — no toggle
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.removeItem('fc-theme');

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

  window.escapeHtml = function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      const isOpen = headerNav.classList.toggle('nav-open');
      if (isOpen) {
        const searchInput = headerNav.querySelector('#header-search-input');
        if (searchInput) {
          setTimeout(() => searchInput.focus(), 250);
        }
      }
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

  // ============================================
  // Header Search — Independent Dropdown
  // ============================================
  const TOOLS = [
    { icon: '🌐', name: 'WebP to JPG',        url: '/tools/image-converter/?mode=webp-jpg', tags: 'webp jpg jpeg convert image' },
    { icon: '🌐', name: 'WebP to PNG',        url: '/tools/image-converter/?mode=webp-png', tags: 'webp png convert image transparent' },
    { icon: '📱', name: 'HEIC to JPG',        url: '/tools/image-converter/?mode=heic-jpg', tags: 'heic heif jpg jpeg iphone apple convert' },
    { icon: '📷', name: 'JPG to PNG',         url: '/tools/image-converter/?mode=jpg-png',  tags: 'jpg jpeg png convert lossless' },
    { icon: '🎨', name: 'PNG to JPG',         url: '/tools/image-converter/?mode=png-jpg',  tags: 'png jpg jpeg convert compress' },
    { icon: '📷', name: 'JPG / PNG to WebP',  url: '/tools/image-converter/?mode=to-webp',  tags: 'jpg png webp convert optimize web' },
    { icon: '🔄', name: 'Image Converter',    url: '/tools/image-converter/',               tags: 'image convert format png jpg webp heic' },
    { icon: '📐', name: 'Image Compressor',   url: '/tools/image-compressor/',              tags: 'compress image size kb 20kb 50kb 100kb reduce' },
    { icon: '✂️', name: 'Crop Image',         url: '/tools/crop-image/',                    tags: 'crop trim cut aspect ratio image photo' },
    { icon: '📏', name: 'Resize Image',       url: '/tools/resize-image/',                  tags: 'resize scale dimensions width height pixels' },
    { icon: '🔗', name: 'Merge PDF',          url: '/tools/pdf-merge/',                     tags: 'merge pdf combine join append documents' },
    { icon: '✂️', name: 'Split PDF',          url: '/tools/pdf-split/',                     tags: 'split pdf extract pages separate divide' },
    { icon: '📉', name: 'Compress PDF',       url: '/tools/pdf-compress/',                  tags: 'compress pdf reduce size shrink' },
    { icon: '🖼️', name: 'Image to PDF',      url: '/tools/image-to-pdf/',                  tags: 'image to pdf jpg png convert' },
    { icon: '🔃', name: 'Rotate PDF',         url: '/tools/rotate-pdf/',                    tags: 'rotate pdf pages turn orientation fix' },
    { icon: '✨', name: 'Remove Background',   url: '/tools/remove-bg/',                     tags: 'remove background transparent png bg remover cutout erase image photo product' },
  ];

  const headerSearchWrapper = document.getElementById('header-search');
  const headerSearchBtn     = document.getElementById('header-search-btn');
  const headerSearchClose   = document.getElementById('header-search-close');
  const headerSearchInput   = document.getElementById('header-search-input');

  // Create dropdown container
  const dropdown = document.createElement('div');
  dropdown.className = 'hs-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'Tool search results');
  headerSearchWrapper && headerSearchWrapper.appendChild(dropdown);

  function renderDropdown(query) {
    dropdown.innerHTML = '';
    if (!query) { dropdown.classList.remove('open'); return; }

    const q = query.toLowerCase();
    const matches = TOOLS.filter(t =>
      t.name.toLowerCase().includes(q) || t.tags.includes(q)
    );

    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="hs-no-result">No tools found</div>';
    } else {
      matches.forEach(t => {
        const item = document.createElement('a');
        item.href = t.url;
        item.className = 'hs-item';
        item.setAttribute('role', 'option');
        item.innerHTML = `<span class="hs-icon">${t.icon}</span><span class="hs-name">${t.name}</span><span class="hs-arrow">→</span>`;
        item.addEventListener('click', () => {
          if (headerNav) headerNav.classList.remove('nav-open');
        });
        dropdown.appendChild(item);
      });
    }
    dropdown.classList.add('open');
  }

  function closeHeaderSearch() {
    if (headerSearchInput) headerSearchInput.value = '';
    if (headerSearchWrapper) headerSearchWrapper.classList.remove('has-text');
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
  }

  if (headerSearchClose) {
    headerSearchClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeHeaderSearch();
      headerSearchInput && headerSearchInput.focus();
    });
  }

  if (headerSearchInput) {
    headerSearchInput.addEventListener('input', () => {
      const q = headerSearchInput.value.trim();
      if (headerSearchWrapper) {
        headerSearchWrapper.classList.toggle('has-text', q.length > 0);
      }
      renderDropdown(q);
    });
    headerSearchInput.addEventListener('focus', () => {
      const q = headerSearchInput.value.trim();
      if (q) renderDropdown(q);
    });
    headerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeHeaderSearch();
        headerSearchInput.blur();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (headerSearchWrapper && !headerSearchWrapper.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Responsive Placement: Inside Mobile Menu Drawer on <= 768px
  const headerActions = document.querySelector('.header-actions');
  const mql = window.matchMedia('(max-width: 768px)');

  function updateSearchPlacement(e) {
    if (!headerSearchWrapper) return;
    if (e.matches) {
      if (headerNav && headerSearchWrapper.parentElement !== headerNav) {
        headerNav.prepend(headerSearchWrapper);
      }
    } else {
      if (headerActions && headerSearchWrapper.parentElement !== headerActions) {
        if (mobileMenuToggle) {
          headerActions.insertBefore(headerSearchWrapper, mobileMenuToggle);
        } else {
          headerActions.appendChild(headerSearchWrapper);
        }
      }
    }
  }

  if (mql.addEventListener) {
    mql.addEventListener('change', updateSearchPlacement);
  } else if (mql.addListener) {
    mql.addListener(updateSearchPlacement);
  }
  updateSearchPlacement(mql);

})();
