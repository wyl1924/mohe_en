(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const normalize = (value = '') => String(value).trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
  const icons = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    scenes: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    bookmark: '<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    audio: '<path d="M11 4 6 8H3v8h3l5 4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    collapse: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18m8-12-3 3 3 3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    book: '<path d="M12 5C8 2 4 3 2 4v15c3-2 7-2 10 1 3-3 7-3 10-1V4c-2-1-6-2-10 1Zm0 0v15"/>',
    dialogue: '<path d="M21 12a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l.8-5A10 10 0 0 1 3 12a9 9 0 0 1 18 0Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18M10 5a12 12 0 0 1 2 0c7 0 10 7 10 7a19 19 0 0 1-4 5M6 6a20 20 0 0 0-4 6s3 7 10 7a14 14 0 0 0 5-1"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
  const storageKey = 'mohe-english-preview-v1';
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) { stored = {}; }
  const state = {
    favorites: Array.isArray(stored.favorites) ? stored.favorites : [],
    favoriteContexts: stored.favoriteContexts && typeof stored.favoriteContexts === 'object' ? stored.favoriteContexts : {},
    heard: Array.isArray(stored.heard) ? stored.heard : [],
    recent: Array.isArray(stored.recent) ? stored.recent : [],
    speed: stored.speed === 0.8 ? 0.8 : 1,
    collapsed: Boolean(stored.collapsed),
    theme: 'all', query: '', lessonTab: 'words', favoriteType: 'all', playing: '', boardIndex: 0, hotspotsVisible: true, boardZoom: 1, boardFit: 'width', focusedLabel: '', readerPanel: 'picture', lessonPage: 0, lessonQuery: '',
  };
  let catalog = { themes: [], scenes: [] };
  let audioMap = {};
  let boardData = [];
  let hotspotObserver = null;
  let lastSceneId = ''; 
  let allItems = [];
  let activeAudio = null;
  let playSequence = 0;
  let toastTimer = null;
  let currentScene = null;

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ favorites: state.favorites, favoriteContexts: state.favoriteContexts, heard: state.heard, recent: state.recent, speed: state.speed, collapsed: state.collapsed }));
    } catch (_) { notify('此浏览器无法保存学习记录，当前仍可继续学习。'); }
  }

  function notify(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function illustration(scene, { eager = false, className = '' } = {}) {
    return `<img class="${className}" src="../assets/boards/${escape(scene.id)}-b01.jpg" alt="${escape(scene.title)}生活场景插画" loading="${eager ? 'eager' : 'lazy'}" data-scene-image="${escape(scene.title)}">`;
  }

  function watchImages() {
    document.querySelectorAll('[data-scene-image]').forEach((img) => {
      img.addEventListener('error', () => {
        if (img.hasAttribute('data-board-artwork')) {
          const stage = img.closest('.scene-image-stage');
          const layer = stage.querySelector('.hotspot-layer');
          if (layer) layer.hidden = true;
          if (!stage.querySelector('.board-image-error')) {
            const error = document.createElement('div');
            error.className = 'board-image-error';
            error.innerHTML = '<span>图版暂未加载成功</span><button class="chip" data-action="retry-board-image">重新加载</button>';
            stage.append(error);
          }
          return;
        }
        const fallback = document.createElement('div');
        fallback.className = 'illustration-fallback';
        fallback.setAttribute('role', 'img');
        fallback.setAttribute('aria-label', `${img.dataset.sceneImage}场景插画尚未加载`);
        fallback.innerHTML = `<span>${escape(img.dataset.sceneImage)}</span>`;
        const layer = img.parentElement?.querySelector('.hotspot-layer');
        if (layer) layer.hidden = true;
        img.replaceWith(fallback);
      }, { once: true });
    });
  }

  function navigation() {
    const route = location.hash.slice(1) || 'home';
    const selected = route.startsWith('scene/') ? 'scenes' : route;
    const links = [{ id: 'home', label: '学习', icon: 'home' }, { id: 'scenes', label: '场景', icon: 'scenes' }, { id: 'favorites', label: '生词本', icon: 'bookmark' }];
    const html = links.map((link) => `<a class="nav-link ${selected === link.id ? 'active' : ''}" href="#${link.id}" ${selected === link.id ? 'aria-current="page"' : ''}>${icon(link.icon)}<span>${link.label}</span>${link.id === 'favorites' && favoriteItems().length ? `<span class="nav-count">${favoriteItems().length}</span>` : ''}</a>`).join('');
    $('#desktop-nav').innerHTML = html;
    $('#mobile-nav').innerHTML = html;
    $('#shell').classList.toggle('nav-collapsed', state.collapsed);
    $('#nav-toggle').innerHTML = icon('collapse');
    $('#nav-toggle').setAttribute('aria-expanded', String(!state.collapsed));
    $('#nav-toggle').setAttribute('aria-label', state.collapsed ? '展开侧栏' : '收起侧栏');
    $('.local-tag').textContent = '本地记录';
    updateSpeed();
  }

  function heardWords(scene) { return scene.words.filter((word) => state.heard.includes(word.id)).length; }
  function favoriteItems() {
    return allItems.filter((item) => state.favorites.includes(item.id)).map((item) => {
      const context = state.favoriteContexts[item.id];
      return context && context.zh ? { ...item, zh: context.zh } : item;
    });
  }
  function sceneCard(scene) {
    const heard = heardWords(scene);
    const count = scene.words.length;
    return `<a class="scene-card" href="#scene/${escape(scene.id)}" aria-label="学习${escape(scene.title)}，${count}个词汇">
      <div class="scene-card-image">${illustration(scene)}<span class="scene-number">SCENE ${String(catalog.scenes.indexOf(scene) + 1).padStart(2, '0')}</span></div>
      <div class="scene-card-body"><p class="en-title">${escape(scene.en)}</p><h3>${escape(scene.title)}</h3><div class="scene-card-meta"><span>${count} 词汇 · ${scene.sentences.length} 表达</span>${icon('arrow')}</div>${heard ? `<div class="scene-card-progress" aria-label="已点读 ${heard} / ${count} 个词汇"><span style="width:${count ? Math.min(100, (heard / count) * 100) : 0}%"></span></div>` : ''}</div>
    </a>`;
  }

  function homePage() {
    const first = catalog.scenes[0];
    const recent = state.recent.map((id) => catalog.scenes.find((scene) => scene.id === id)).filter(Boolean);
    const continueScene = recent[0] || first;
    const totalWords = catalog.scenes.reduce((total, scene) => total + scene.words.length, 0);
    const heardCount = allItems.filter((item) => item.type === 'word' && state.heard.includes(item.id)).length;
    return `<div class="page-heading"><div><p class="eyebrow">ENGLISH IN EVERYDAY LIFE</p><h1>让英语，走进每一天</h1><p>从熟悉的场景开始，听见生活里的英语。</p></div><img class="home-brand-avatar" src="../assets/brand/mohe-logo-128.png" width="56" height="56" alt="墨盒小熊"></div>
      <section class="hero" aria-label="开始场景学习"><div class="hero-copy"><p class="eyebrow">A LITTLE ENGLISH, EVERY DAY.</p><h2>看见生活，<br>说出英语。</h2><p>一幅场景，一组词汇。<br>听一听，生活里的英语。</p><a class="primary-button" href="#scene/${escape(continueScene.id)}">${recent.length ? '继续学习' : '开始第一课'}${icon('arrow')}</a></div><div class="hero-art">${illustration(first, { eager: true })}</div></section>
      <div class="stats-strip" aria-label="内容与学习记录"><div class="stat"><strong>${catalog.scenes.length}</strong><span>生活场景<span class="stat-unit">EVERYDAY SCENES</span></span></div><div class="stat"><strong>${totalWords}</strong><span>实用词汇<span class="stat-unit">WORDS TO LEARN</span></span></div><div class="stat"><strong>${heardCount}</strong><span>已点读词汇<span class="stat-unit">YOUR EXPLORATION</span></span></div></div>
      ${recent.length ? `<a class="recent-card" href="#scene/${escape(continueScene.id)}">${illustration(continueScene)}<div><strong>继续 · ${escape(continueScene.title)}</strong><small>已点读 ${heardWords(continueScene)} / ${continueScene.words.length} 个词汇</small></div>${icon('arrow')}</a>` : ''}
      <div class="section-heading"><div><h2>从一个生活场景开始</h2><small>醒来、出门、工作，一天里的英语都在这里。</small></div><a href="#scenes" class="text-link">全部场景 ${icon('chevron')}</a></div>
      <div class="scene-grid">${catalog.scenes.slice(0, 6).map(sceneCard).join('')}</div>
      <p class="local-note">${icon('audio').replace('<svg ', '<svg style="display:inline-block;width:13px;height:13px;vertical-align:-2px;margin-right:5px" ')}每个单词和句子都可以点读，点击星标即可加入生词本。</p>`;
  }

  function searchBox() {
    return `<label class="sr-only" for="search">搜索中文、英文或生活场景</label><div class="search-box">${icon('search')}<input id="search" type="search" placeholder="搜索中文、英文或生活场景" autocomplete="off" value="${escape(state.query)}"><button class="search-clear" data-action="clear-search" aria-label="清空搜索" ${state.query ? '' : 'hidden'}>${icon('close')}</button></div>`;
  }

  function sceneDirectory() {
    return `<div class="page-heading"><div><p class="eyebrow">YOUR EVERYDAY DICTIONARY</p><h1>一天的生活，一天的英语</h1><p>${catalog.themes.length} 个主题 · ${catalog.scenes.length} 个场景，挑一个熟悉的开始。</p></div></div>${searchBox()}<div class="theme-chips" aria-label="筛选主题"><button class="chip ${state.theme === 'all' ? 'active' : ''}" data-theme="all" aria-pressed="${state.theme === 'all'}">全部</button>${catalog.themes.map((theme) => `<button class="chip ${state.theme === theme.id ? 'active' : ''}" data-theme="${escape(theme.id)}" aria-pressed="${state.theme === theme.id}">${escape(theme.name)}</button>`).join('')}</div><div id="directory-results">${directoryResults()}</div>`;
  }

  function emptyState(title, description, linkLabel = '浏览生活场景', href = '#scenes', emptyIcon = 'search') {
    return `<div class="empty-state">${icon(emptyIcon)}<h2>${escape(title)}</h2><p>${escape(description)}</p><a class="primary-button" href="${href}">${escape(linkLabel)}${icon('arrow')}</a></div>`;
  }

  function directoryResults() {
    const query = normalize(state.query);
    const scenes = catalog.scenes.filter((scene) => (state.theme === 'all' || scene.themeId === state.theme));
    if (!query) return `<div class="scene-grid">${scenes.map(sceneCard).join('')}</div>`;
    const matchedScenes = scenes.filter((scene) => normalize(`${scene.title} ${scene.en} ${scene.description}`).includes(query));
    const sceneIds = scenes.map((scene) => scene.id);
    const items = allItems.filter((item) => sceneIds.includes(item.sceneId) && normalize(`${item.en} ${item.zh}`).includes(query));
    if (!matchedScenes.length && !items.length) return emptyState('暂时没有找到', '换一个词试试，或清空搜索后浏览生活场景。', '清空搜索', '#scenes', 'search');
    return `<p class="search-caption">找到 ${matchedScenes.length} 个场景、${items.length} 条学习内容</p>${matchedScenes.length ? `<div class="scene-grid">${matchedScenes.map(sceneCard).join('')}</div>` : ''}${items.length ? `<h2 class="search-group-title">相关词汇与表达</h2><div class="search-result-list">${items.slice(0, 80).map(searchResult).join('')}</div>${items.length > 80 ? '<p class="local-note">先展示前 80 条结果，输入更完整的词语可以缩小范围。</p>' : ''}` : ''}`;
  }

  function searchResult(item) {
    const scene = catalog.scenes.find((candidate) => candidate.id === item.sceneId);
    return `<article class="search-result">${illustration(scene)}<div class="search-result-copy"><span class="en">${escape(item.en)}</span><span class="zh">${escape(item.zh)}</span><p class="result-scene"><a href="#scene/${escape(scene.id)}?entry=${encodeURIComponent(item.id)}">${escape(scene.title)} ${item.type === 'word' ? '· 词汇' : '· 表达'}</a></p></div><button class="icon-button" data-en="${escape(item.en)}" data-item="${escape(item.id)}" aria-label="朗读 ${escape(item.en)}">${icon('audio')}</button>${favoriteButton(item)}</article>`;
  }

  function sceneBoards(scene) {
    return boardData.filter((board) => board.sceneId === scene.id);
  }

  function matchedHotspots(scene, board) {
    const seen = new Set();
    return (board.hotspots || []).map((spot) => {
      const word = scene.words.find((item) => item.id === spot.entryId) || scene.words.find((item) => normalize(item.en) === normalize(spot.en || spot.word));
      if (!word || seen.has(word.id)) return null;
      seen.add(word.id);
      const percent = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback;
      return { ...spot, ...word, zh: spot.zh || word.zh, x: percent(spot.x, 50), y: percent(spot.y, 50), width: percent(spot.width, 20), height: percent(spot.height, 3) };
    }).filter(Boolean);
  }

  function boardArt(scene) {
    const boards = sceneBoards(scene);
    state.boardIndex = Math.max(0, Math.min(boards.length - 1, state.boardIndex));
    const board = boards[state.boardIndex];
    const spots = matchedHotspots(scene, board);
    const path = `../${String(board.image).replace(/^\.?\.?\//, '').replace(/^\/+/, '')}`;
    const pieces = window.MoheBoardLayout(board, Number(board.width) || 800, Number(board.height) || 600);
    const artwork = pieces.length ? `<div class="board-pieces">${pieces.map((piece) => `<div class="board-piece" data-board-piece="${piece.index}" style="left:${piece.x}px;top:${piece.y}px;width:${piece.width}px;height:${piece.height}px"><div class="board-piece-crop" style="left:${piece.cropLeft}px;top:${piece.cropTop}px;width:${piece.cropWidth}px;height:${piece.cropHeight}px"><img class="board-piece-image" src="${escape(path)}" style="width:${piece.imageWidth}px;height:${piece.imageHeight}px;left:${piece.imageLeft - piece.cropLeft}px;top:${piece.imageTop - piece.cropTop}px" alt="${escape(board.title)}生活插画" loading="eager" draggable="false" data-board-artwork data-scene-image="${escape(board.title)}"></div></div>`).join('')}</div>` : `<img src="${escape(path)}" alt="${escape(board.title)}生活点读图" loading="eager" draggable="false" data-board-artwork data-scene-image="${escape(board.title)}">`;
    return `<div class="board-nav" aria-label="切换学习小节">${boards.map((item, index) => `<button class="board-tab ${index === state.boardIndex ? 'active' : ''}" data-board="${index}" aria-pressed="${index === state.boardIndex}"><span>${String(index + 1).padStart(2, '0')}</span>${escape(item.title)}</button>`).join('')}</div>
      <div class="detail-illustration">
        <div class="board-view-tools"><div class="board-zoom-buttons" aria-label="图片显示方式"><button data-action="board-width" aria-label="图片铺满宽度">适宽</button><button data-action="board-fit" aria-label="查看完整图解">全图</button><button data-action="zoom-out" aria-label="缩小图片">−</button><span id="board-zoom-status" aria-live="polite">适宽</span><button data-action="zoom-in" aria-label="放大图片点读">+</button></div><button class="hotspot-toggle" data-action="toggle-hotspots" aria-pressed="${state.hotspotsVisible}" aria-label="${state.hotspotsVisible ? '隐藏' : '显示'}图中单词" aria-controls="scene-hotspots">${icon(state.hotspotsVisible ? 'eyeOff' : 'eye')}</button></div>
        <div class="board-viewport" id="board-viewport" tabindex="0" role="region" aria-label="${escape(board.title)}点读图，可滚动查看"><div class="scene-image-stage" id="hotspot-stage" style="aspect-ratio:${Number(board.width) || 800}/${Number(board.height) || 600}" data-width="${Number(board.width) || 800}" data-height="${Number(board.height) || 600}">${artwork}<div class="hotspot-layer" id="scene-hotspots" ${state.hotspotsVisible ? '' : 'hidden'}>${spots.map((spot) => `<button class="picture-label ${spot.glossInline ? 'picture-label-inline' : ''} ${state.focusedLabel === spot.id ? 'is-focused' : ''}" style="left:${spot.x}%;top:${spot.y}%;width:${spot.width}%" data-en="${escape(spot.en)}" data-item="${escape(spot.id)}" aria-label="朗读 ${escape(spot.en)}，${escape(spot.zh)}" title="${escape(spot.en)} · ${escape(spot.zh)}"><span class="picture-label-en">${escape(spot.en)}</span><span class="picture-label-zh">${escape(spot.zh)}</span></button>`).join('')}</div></div></div>
        ${boardSelection(spots)}
      </div><div class="reader-pager board-pager"><button data-board-step="-1" ${state.boardIndex === 0 ? 'disabled' : ''}>${icon('back')}上一张</button><span><strong>${escape(board.title)}</strong><small>${state.boardIndex + 1} / ${boards.length}</small></span><button data-board-step="1" ${state.boardIndex === boards.length - 1 ? 'disabled' : ''}>下一张${icon('arrow')}</button></div>`;
  }

  function boardSelection(spots) {
    const selected = spots.find((spot) => spot.id === state.focusedLabel);
    return `<div id="board-selected">${selected ? `<div class="board-selection"><button class="board-selection-word" data-en="${escape(selected.en)}" data-item="${escape(selected.id)}" aria-label="朗读选中的 ${escape(selected.en)}"><strong>${escape(selected.en)}</strong><span class="board-selected-zh">${escape(selected.zh)}</span></button>${favoriteButton(selected)}</div>` : '<div class="board-selection-placeholder">点击图中的英文，听读音、看释义</div>'}</div>`;
  }

  function centerBoardLabel(spot) {
    const viewport = $('#board-viewport');
    const stage = $('#hotspot-stage');
    if (!viewport || !stage || !spot) return;
    viewport.scrollLeft = (spot.x + spot.width / 2) / 100 * stage.clientWidth - viewport.clientWidth / 2;
    viewport.scrollTop = spot.y / 100 * stage.clientHeight - viewport.clientHeight / 2;
  }

  function selectBoardLabel(id, { locate = false } = {}) {
    if (!currentScene) return;
    const boards = sceneBoards(currentScene);
    const onBoard = (board) => matchedHotspots(currentScene, board).some((spot) => spot.id === id);
    const index = boards[state.boardIndex] && onBoard(boards[state.boardIndex]) ? state.boardIndex : boards.findIndex(onBoard);
    if (index < 0 || (!locate && index !== state.boardIndex)) return;
    state.focusedLabel = id;
    const changed = index !== state.boardIndex;
    if (changed) { state.boardIndex = index; state.boardZoom = 1; state.hotspotsVisible = true; refreshBoardArt(); layoutHotspots(); }
    const spots = matchedHotspots(currentScene, boards[index]);
    const spot = spots.find((item) => item.id === id);
    const selected = $('#board-selected');
    if (selected) selected.outerHTML = boardSelection(spots);
    document.querySelectorAll('.picture-label').forEach((label) => label.classList.toggle('is-focused', label.dataset.item === id));
    if (locate) {
      state.hotspotsVisible = true;
      $('#scene-hotspots').hidden = false;
      if (state.boardZoom === 1) zoomBoard('zoom-in');
      centerBoardLabel(spot);
      $('#scene-art').scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }

  function layoutHotspots() {
    const stage = $('#hotspot-stage');
    const viewport = $('#board-viewport');
    if (!stage || !viewport) return;
    if (viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return;
    const sourceWidth = Number(stage.dataset.width) || 800;
    const sourceHeight = Number(stage.dataset.height) || 600;
    const maximumHeight = Math.max(180, viewport.clientHeight);
    const fitWidth = state.boardFit === 'full' ? Math.min(viewport.clientWidth, maximumHeight * sourceWidth / sourceHeight) : viewport.clientWidth;
    const width = Math.ceil(fitWidth * state.boardZoom);
    const height = width * sourceHeight / sourceWidth;
    stage.style.width = `${width}px`;
    stage.style.setProperty('--label-scale', String(width / sourceWidth));
    stage.style.setProperty('--label-size', `${14 * width / sourceWidth}px`);
    stage.style.setProperty('--gloss-size', `${10.5 * width / sourceWidth}px`);
    if (currentScene) {
      const board = sceneBoards(currentScene)[state.boardIndex];
      const pieces = window.MoheBoardLayout(board, width, height);
      stage.querySelectorAll('[data-board-piece]').forEach((element) => {
        const piece = pieces[Number(element.dataset.boardPiece)];
        Object.assign(element.style, { left: `${piece.x}px`, top: `${piece.y}px`, width: `${piece.width}px`, height: `${piece.height}px` });
        Object.assign(element.querySelector('.board-piece-crop').style, { left: `${piece.cropLeft}px`, top: `${piece.cropTop}px`, width: `${piece.cropWidth}px`, height: `${piece.cropHeight}px` });
        Object.assign(element.querySelector('img').style, { width: `${piece.imageWidth}px`, height: `${piece.imageHeight}px`, left: `${piece.imageLeft - piece.cropLeft}px`, top: `${piece.imageTop - piece.cropTop}px` });
      });
    }
    viewport.classList.toggle('is-zoomed', state.boardZoom > 1);
    $('#board-zoom-status').textContent = state.boardZoom === 1 ? (state.boardFit === 'full' ? '全图' : '适宽') : `${state.boardZoom.toFixed(1)}×`;
    $('[data-action="board-width"]').setAttribute('aria-pressed', String(state.boardZoom === 1 && state.boardFit === 'width'));
    $('[data-action="board-fit"]').setAttribute('aria-pressed', String(state.boardZoom === 1 && state.boardFit === 'full'));
    $('[data-action="zoom-out"]').disabled = state.boardZoom === 1;
    $('[data-action="zoom-in"]').disabled = state.boardZoom >= 4;
  }

  function observeHotspots() {
    if (hotspotObserver) hotspotObserver.disconnect();
    if ($('#board-viewport') && typeof ResizeObserver === 'function') {
      hotspotObserver = new ResizeObserver(layoutHotspots);
      hotspotObserver.observe($('#board-viewport'));
    }
    requestAnimationFrame(layoutHotspots);
  }

  function refreshBoardArt() {
    if (!currentScene) return;
    $('#scene-art').innerHTML = boardArt(currentScene);
    watchImages();
    observeHotspots();
  }

  function zoomBoard(action) {
    const viewport = $('#board-viewport');
    const stage = $('#hotspot-stage');
    if (!viewport || !stage) return;
    const oldWidth = stage.clientWidth;
    const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
    const centerY = viewport.scrollTop + viewport.clientHeight / 2;
    if (action === 'board-fit' || action === 'board-width') { state.boardZoom = 1; state.boardFit = action === 'board-fit' ? 'full' : 'width'; }
    else if (action === 'zoom-out') state.boardZoom = Math.max(1, state.boardZoom - .5);
    else {
      // The first zoom reaches readable native label sizes, including on phones.
      const sourceWidth = Number(stage.dataset.width) || 800;
      state.boardZoom = Math.min(4, state.boardZoom === 1 ? Math.max(1.5, sourceWidth / oldWidth) : state.boardZoom + .5);
    }
    layoutHotspots();
    const ratio = stage.clientWidth / oldWidth;
    viewport.scrollLeft = ['board-fit', 'board-width'].includes(action) ? 0 : centerX * ratio - viewport.clientWidth / 2;
    viewport.scrollTop = ['board-fit', 'board-width'].includes(action) ? 0 : centerY * ratio - viewport.clientHeight / 2;
  }

  function lessonPage(scene) {
    return `<div class="reader-heading"><a class="reader-back" href="#scenes" aria-label="返回生活场景">${icon('back')}</a><div><h1>${escape(scene.title)}</h1><p>${escape(scene.en)}</p></div><button class="reader-stop" data-action="stop-reading" aria-label="停止朗读">${icon('stop')}</button></div>
      <div class="reader-modes" role="tablist" aria-label="切换学习方式"><button id="picture-mode" data-reader-panel="picture" role="tab" aria-selected="${state.readerPanel === 'picture'}" aria-controls="scene-art" class="${state.readerPanel === 'picture' ? 'active' : ''}">${icon('scenes')}看图点读</button><button id="practice-mode" data-reader-panel="practice" role="tab" aria-selected="${state.readerPanel === 'practice'}" aria-controls="practice-panel" class="${state.readerPanel === 'practice' ? 'active' : ''}">${icon('book')}词句练习</button></div>
      <div class="reader-workspace"><section id="scene-art" class="reader-panel" role="tabpanel" aria-labelledby="picture-mode" ${state.readerPanel === 'picture' ? '' : 'hidden'}>${boardArt(scene)}</section><section id="practice-panel" class="reader-panel" role="tabpanel" aria-labelledby="practice-mode" ${state.readerPanel === 'practice' ? '' : 'hidden'}>${practicePanel(scene)}</section></div>`;
  }

  function setReaderPanel(panel) {
    if (!currentScene || !['picture', 'practice'].includes(panel)) return;
    state.readerPanel = panel;
    document.querySelectorAll('[data-reader-panel]').forEach((button) => { const active = button.dataset.readerPanel === panel; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
    $('#scene-art').hidden = panel !== 'picture';
    $('#practice-panel').hidden = panel !== 'practice';
    if (panel === 'picture') requestAnimationFrame(layoutHotspots);
  }

  function lessonSlice(scene) {
    const query = normalize(state.lessonQuery);
    const source = state.lessonTab === 'words' ? scene.words : scene.sentences;
    const items = query ? source.filter((item) => normalize(`${item.en} ${item.zh}`).includes(query)) : source;
    const pageSize = state.lessonTab === 'words' ? 6 : 3;
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    state.lessonPage = Math.max(0, Math.min(pages - 1, state.lessonPage));
    const start = state.lessonPage * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, pages, start, pageSize };
  }

  function practicePanel(scene) {
    return `<div class="lesson-toolbar"><div class="lesson-tabs" role="tablist" aria-label="学习内容"><button class="lesson-tab ${state.lessonTab === 'words' ? 'active' : ''}" id="words-tab" data-lesson-tab="words" role="tab" aria-selected="${state.lessonTab === 'words'}" aria-controls="lesson-content">词汇 ${scene.words.length}</button><button class="lesson-tab ${state.lessonTab === 'sentences' ? 'active' : ''}" id="sentences-tab" data-lesson-tab="sentences" role="tab" aria-selected="${state.lessonTab === 'sentences'}" aria-controls="lesson-content">表达 ${scene.sentences.length}</button></div></div><label class="sr-only" for="lesson-search">搜索本场景词句</label><div class="reader-search">${icon('search')}<input id="lesson-search" type="search" placeholder="搜索本场景词句" value="${escape(state.lessonQuery)}" autocomplete="off"></div><div id="lesson-content" role="tabpanel" aria-labelledby="${state.lessonTab}-tab">${lessonContent(scene)}</div>`;
  }

  function refreshPractice() {
    if (!currentScene) return;
    $('#practice-panel').innerHTML = practicePanel(currentScene);
  }

  function favoriteButton(item) {
    const saved = state.favorites.includes(item.id);
    return `<button class="favorite-button ${saved ? 'saved' : ''}" data-favorite="${escape(item.id)}" aria-pressed="${saved}" aria-label="${saved ? '取消收藏' : '收藏'} ${escape(item.en)}">${icon('star')}</button>`;
  }

  function wordRow(word, sceneName = '') {
    const hasBoard = currentScene && sceneBoards(currentScene).some((board) => matchedHotspots(currentScene, board).some((spot) => spot.id === word.id));
    return `<article id="entry-${escape(word.id)}" class="word-row" data-card-item="${escape(word.id)}"><button class="word-read" data-en="${escape(word.en)}" data-item="${escape(word.id)}" aria-label="朗读 ${escape(word.en)}，${escape(word.zh)}">${icon('audio')}<span class="word-copy"><span class="word-en">${escape(word.en)}</span>${word.ipa ? `<span class="word-ipa">${escape(word.ipa)}</span>` : ''}<span class="word-zh">${escape(word.zh)}</span>${sceneName ? `<span class="save-scene-name">${escape(sceneName)}</span>` : ''}</span></button>${hasBoard ? `<button class="locate-word" data-locate="${escape(word.id)}" aria-label="查看 ${escape(word.en)} 在图中的位置">${icon('scenes')}</button>` : ''}${favoriteButton(word)}</article>`;
  }

  function sentenceTokens(en) {
    let position = 0;
    let html = '';
    const regex = /[A-Za-z]+(?:['’-][A-Za-z]+)*|\d+/g;
    for (const match of en.matchAll(regex)) {
      html += escape(en.slice(position, match.index));
      html += `<button class="sentence-token" data-en="${escape(match[0])}" aria-label="朗读单词 ${escape(match[0])}">${escape(match[0])}</button>`;
      position = match.index + match[0].length;
    }
    return html + escape(en.slice(position));
  }

  function sentenceCard(sentence, sceneName = '') {
    const dialogue = sentence.kind === 'dialogue';
    return `<article id="entry-${escape(sentence.id)}" class="sentence-card" data-card-item="${escape(sentence.id)}"><div class="sentence-top"><span class="sentence-label">${dialogue ? `<span class="speaker">${escape(sentence.speaker || '对话')}</span>生活对话` : `${icon('book')}实用表达`}${sceneName ? ` · ${escape(sceneName)}` : ''}</span><div class="sentence-actions"><button class="icon-button" data-en="${escape(sentence.en)}" data-item="${escape(sentence.id)}" aria-label="朗读整句 ${escape(sentence.en)}">${icon('audio')}</button>${favoriteButton(sentence)}</div></div>${sentence.stageDirection ? `<p class="stage-direction">（${escape(sentence.stageDirection)}）</p>` : ''}<p class="sentence-en" lang="en">${sentenceTokens(sentence.en)}</p><p class="sentence-zh">${escape(sentence.zh)}</p></article>`;
  }

  function lessonContent(scene) {
    const page = lessonSlice(scene);
    const rows = page.items.map((item) => state.lessonTab === 'words' ? wordRow(item) : sentenceCard(item)).join('');
    return `<div class="practice-page-scroll">${page.total ? `<div class="${state.lessonTab === 'words' ? 'word-list' : 'sentences-list'}">${rows}</div>` : '<div class="practice-empty"><strong>没有找到相关词句</strong><p>试试其他中文或英文。</p></div>'}</div><div class="reader-pager practice-pager"><button data-lesson-step="-1" ${state.lessonPage === 0 ? 'disabled' : ''}>${icon('back')}上一页</button><span aria-live="polite"><strong>${state.lessonPage + 1} / ${page.pages}</strong><small>${page.total ? `${page.start + 1}–${Math.min(page.start + page.pageSize, page.total)} · 共 ${page.total} 条` : '0 条结果'}</small></span><button data-lesson-step="1" ${state.lessonPage >= page.pages - 1 ? 'disabled' : ''}>下一页${icon('arrow')}</button></div>`;
  }

  function favoritesPage() {
    const favorites = favoriteItems();
    const filtered = favorites.filter((item) => state.favoriteType === 'all' || item.type === state.favoriteType);
    return `<div class="page-heading"><div><p class="eyebrow">KEEP THE WORDS YOU LOVE</p><h1>我的生词本</h1><p>把想记住的英语收藏起来，随时回来听一听。</p></div></div><div class="bookmark-head">${icon('bookmark')}<div><strong>${favorites.length} 条收藏，慢慢变熟悉</strong><p>来自你亲手收藏的词汇和表达</p></div></div>${favorites.length ? `<div class="favorite-filters" aria-label="筛选收藏"><button class="chip ${state.favoriteType === 'all' ? 'active' : ''}" data-favorite-type="all" aria-pressed="${state.favoriteType === 'all'}">全部</button><button class="chip ${state.favoriteType === 'word' ? 'active' : ''}" data-favorite-type="word" aria-pressed="${state.favoriteType === 'word'}">词汇</button><button class="chip ${state.favoriteType === 'sentence' ? 'active' : ''}" data-favorite-type="sentence" aria-pressed="${state.favoriteType === 'sentence'}">表达</button></div>${filtered.length ? `<p class="favorites-count">${filtered.length} 条${state.favoriteType === 'word' ? '词汇' : state.favoriteType === 'sentence' ? '表达' : '学习内容'}</p><div class="${state.favoriteType === 'word' ? 'word-list' : 'sentences-list'}">${filtered.map((item) => { const scene = catalog.scenes.find((candidate) => candidate.id === item.sceneId); return item.type === 'word' ? wordRow(item, scene?.title || '') : sentenceCard(item, scene?.title || ''); }).join('')}</div>` : emptyState('这里还没有收藏', '在场景学习页点击星标，把想记住的词汇或表达放进来。', '去选一个生活场景', '#scenes', 'bookmark')}` : emptyState('让第一个单词住进来', '在场景学习页点击星标，把想记住的词汇或表达放进来。', '去选一个生活场景', '#scenes', 'bookmark')}<p class="local-note">收藏保存在当前浏览器中，无需登录。清除浏览器数据后，本地记录也会被清除。</p>`;
  }

  function routePage({ focus = false } = {}) {
    stopAudio();
    const route = location.hash.slice(1) || 'home';
    currentScene = null;
    let html;
    let focusId = '';
    if (route.startsWith('scene/')) {
      const [sceneId, query = ''] = route.slice(6).split('?');
      const scene = catalog.scenes.find((item) => item.id === sceneId);
      focusId = new URLSearchParams(query).get('entry') || '';
      if (!scene) { location.hash = '#scenes'; return; }
      currentScene = scene;
      if (lastSceneId !== scene.id) { state.boardIndex = 0; state.hotspotsVisible = true; state.boardZoom = 1; state.boardFit = 'width'; state.focusedLabel = ''; state.readerPanel = 'picture'; state.lessonTab = 'words'; state.lessonPage = 0; state.lessonQuery = ''; }
      lastSceneId = scene.id;
      if (focusId) {
        const targetWord = scene.words.find((item) => item.id === focusId);
        if (targetWord) { const index = sceneBoards(scene).findIndex((board) => matchedHotspots(scene, board).some((item) => item.id === targetWord.id)); if (index >= 0) state.boardIndex = index; }
      }
      if (focusId) {
        state.lessonTab = scene.sentences.some((item) => item.id === focusId) ? 'sentences' : 'words';
        state.lessonQuery = '';
        const entries = state.lessonTab === 'words' ? scene.words : scene.sentences;
        const index = entries.findIndex((item) => item.id === focusId);
        state.lessonPage = index >= 0 ? Math.floor(index / (state.lessonTab === 'words' ? 6 : 3)) : 0;
        const hasPicture = sceneBoards(scene).some((board) => matchedHotspots(scene, board).some((item) => item.id === focusId));
        state.readerPanel = state.lessonTab === 'sentences' || !hasPicture ? 'practice' : 'picture';
        state.focusedLabel = state.lessonTab === 'words' ? focusId : '';
      }
      state.recent = [scene.id, ...state.recent.filter((id) => id !== scene.id)].slice(0, 18);
      persist();
      html = lessonPage(scene);
      $('#topbar-title').textContent = `${scene.title} · ${scene.en}`;
      document.title = `${scene.title} · 墨盒英语`;
    } else if (route === 'scenes') {
      html = sceneDirectory();
      $('#topbar-title').textContent = '从熟悉的场景开始';
      document.title = '生活场景 · 墨盒英语';
    } else if (route === 'favorites') {
      html = favoritesPage();
      $('#topbar-title').textContent = '想记住的，留在这里';
      document.title = '我的生词本 · 墨盒英语';
    } else {
      html = homePage();
      $('#topbar-title').textContent = '把英语，装进生活';
      document.title = '墨盒英语 · 把英语装进生活';
    }
    document.body.classList.toggle('reader-active', Boolean(currentScene));
    $('#main').classList.toggle('reader-page', Boolean(currentScene));
    $('#main').innerHTML = html;
    navigation();
    watchImages();
    observeHotspots();
    if (focus) { $('#main').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
    if (focusId && state.readerPanel === 'practice') requestAnimationFrame(() => {
      const target = document.getElementById(`entry-${focusId}`);
      if (target) { target.classList.add('search-target'); target.scrollIntoView({ block: 'center', behavior: 'instant' }); }
    });
    if (focusId && state.readerPanel === 'picture') requestAnimationFrame(() => {
      const board = sceneBoards(currentScene)[state.boardIndex];
      centerBoardLabel(matchedHotspots(currentScene, board).find((item) => item.id === focusId));
    });
  }

  function updateSpeed() {
    $('#speed').innerHTML = `${state.speed.toFixed(1)}× <span>${state.speed === 1 ? '正常语速' : '慢速跟读'}</span>`;
    $('#speed').setAttribute('aria-pressed', String(state.speed === 0.8));
    $('#speed').setAttribute('aria-label', state.speed === 1 ? '切换到零点八倍慢速' : '切换到正常语速');
  }

  function stopAudio() {
    playSequence += 1;
    if (activeAudio) { activeAudio.pause(); activeAudio.removeAttribute('src'); activeAudio.load(); activeAudio.remove(); }
    activeAudio = null;
    state.playing = '';
    $('#player').hidden = true;
    document.querySelectorAll('.is-playing').forEach((element) => element.classList.remove('is-playing'));
  }

  async function playText(text, itemId) {
    stopAudio();
    const key = normalize(text);
    const path = audioMap[key] || audioMap[key.replace(/[.!?,;:]+$/, '')] || audioMap[key.replace(/[^a-z0-9'\s-]/g, '')];
    if (!path) { notify(`“${text}”的音频尚未就绪，请稍后再试。`); return; }
    const sequence = playSequence;
    const audio = new Audio(`../miniprogram/${path.replace(/^\/+/, '')}`);
    audio.id = 'pronunciation-audio'; audio.hidden = true; audio.dataset.en = text; document.body.append(audio);
    activeAudio = audio;
    audio.playbackRate = state.speed;
    $('#player-state').textContent = '正在加载音频…';
    $('#player-text').textContent = text;
    $('#player').hidden = false;
    state.playing = key;
    document.querySelectorAll('[data-en]').forEach((element) => { if (normalize(element.dataset.en) === key) element.classList.add('is-playing'); });
    document.querySelectorAll('[data-card-item]').forEach((element) => { if (element.dataset.cardItem === itemId) element.classList.add('is-playing'); });
    audio.addEventListener('playing', () => {
      if (sequence !== playSequence) return;
      $('#player-state').textContent = state.speed === 0.8 ? '慢速播放 · 0.8×' : '正在播放 · 1.0×';
      if (itemId && !state.heard.includes(itemId)) { state.heard.push(itemId); persist(); }
    });
    audio.addEventListener('ended', () => { if (sequence === playSequence) stopAudio(); }, { once: true });
    audio.addEventListener('error', () => { if (sequence === playSequence) { stopAudio(); notify('音频未能加载，请检查网络后再点击重试。'); } }, { once: true });
    try { await audio.play(); } catch (_) { if (sequence === playSequence) { stopAudio(); notify('暂时无法播放音频，请再次点击重试。'); } }
  }

  function updateFavorite(id) {
    const saved = state.favorites.includes(id);
    state.favorites = saved ? state.favorites.filter((candidate) => candidate !== id) : [...state.favorites, id];
    const board = currentScene && sceneBoards(currentScene)[state.boardIndex];
    const spot = board && matchedHotspots(currentScene, board).find((item) => item.id === id);
    if (!saved && spot) state.favoriteContexts[id] = { zh: spot.zh, boardId: board.id };
    else delete state.favoriteContexts[id];
    persist();
    document.querySelectorAll('[data-favorite]').forEach((button) => {
      if (button.dataset.favorite !== id) return;
      const item = allItems.find((candidate) => candidate.id === id);
      button.classList.toggle('saved', !saved);
      button.setAttribute('aria-pressed', String(!saved));
      button.setAttribute('aria-label', `${saved ? '收藏' : '取消收藏'} ${item?.en || ''}`);
    });
    navigation();
    if (location.hash === '#favorites') { $('#main').innerHTML = favoritesPage(); watchImages(); }
    notify(saved ? '已从生词本移除' : '已加入生词本');
  }

  document.addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) { updateFavorite(favorite.dataset.favorite); return; }
    const locate = event.target.closest('[data-locate]');
    if (locate) { setReaderPanel('picture'); layoutHotspots(); selectBoardLabel(locate.dataset.locate, { locate: true }); return; }
    const pictureLabel = event.target.closest('.picture-label');
    if (pictureLabel) { selectBoardLabel(pictureLabel.dataset.item); playText(pictureLabel.dataset.en, pictureLabel.dataset.item); return; }
    const audioButton = event.target.closest('[data-en]');
    if (audioButton) { playText(audioButton.dataset.en, audioButton.dataset.item); return; }
    const theme = event.target.closest('[data-theme]');
    if (theme) { state.theme = theme.dataset.theme; document.querySelectorAll('[data-theme]').forEach((button) => { const selected = button.dataset.theme === state.theme; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); }); $('#directory-results').innerHTML = directoryResults(); watchImages(); return; }
    const readerMode = event.target.closest('[data-reader-panel]');
    if (readerMode) { stopAudio(); setReaderPanel(readerMode.dataset.readerPanel); return; }
    const tab = event.target.closest('[data-lesson-tab]');
    if (tab && currentScene) { state.lessonTab = tab.dataset.lessonTab; state.lessonPage = 0; stopAudio(); refreshPractice(); return; }
    const lessonStep = event.target.closest('[data-lesson-step]');
    if (lessonStep && currentScene && !lessonStep.disabled) { state.lessonPage += Number(lessonStep.dataset.lessonStep); stopAudio(); $('#lesson-content').innerHTML = lessonContent(currentScene); return; }
    const favoriteType = event.target.closest('[data-favorite-type]');
    if (favoriteType) { state.favoriteType = favoriteType.dataset.favoriteType; $('#main').innerHTML = favoritesPage(); return; }
    const boardButton = event.target.closest('[data-board]');
    const boardStep = event.target.closest('[data-board-step]');
    if ((boardButton || boardStep) && currentScene) {
      if (boardStep && boardStep.disabled) return;
      const count = sceneBoards(currentScene).length;
      state.boardIndex = Math.max(0, Math.min(count - 1, boardButton ? Number(boardButton.dataset.board) || 0 : state.boardIndex + Number(boardStep.dataset.boardStep)));
      state.boardZoom = 1; state.boardFit = 'width'; state.focusedLabel = ''; stopAudio(); refreshBoardArt();
      requestAnimationFrame(() => { const active = $('.board-tab.active'); if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); });
      return;
    }
    const zoomButton = event.target.closest('[data-action="zoom-in"], [data-action="zoom-out"], [data-action="board-fit"], [data-action="board-width"]');
    if (zoomButton) { zoomBoard(zoomButton.dataset.action); return; }
    const hotspotToggle = event.target.closest('[data-action="toggle-hotspots"]');
    if (hotspotToggle && currentScene) {
      state.hotspotsVisible = !state.hotspotsVisible; $('#scene-hotspots').hidden = !state.hotspotsVisible;
      hotspotToggle.innerHTML = icon(state.hotspotsVisible ? 'eyeOff' : 'eye'); hotspotToggle.setAttribute('aria-pressed', String(state.hotspotsVisible)); hotspotToggle.setAttribute('aria-label', `${state.hotspotsVisible ? '隐藏' : '显示'}图中单词`); return;
    }
    if (event.target.closest('[data-action="retry-board-image"]') && currentScene) {
      const viewport = $('#board-viewport');
      const left = viewport.scrollLeft, top = viewport.scrollTop;
      refreshBoardArt();
      requestAnimationFrame(() => { layoutHotspots(); $('#board-viewport').scrollLeft = left; $('#board-viewport').scrollTop = top; });
      return;
    }
    const clear = event.target.closest('[data-action="clear-search"]');
    if (clear) { state.query = ''; $('#search').value = ''; clear.hidden = true; $('#directory-results').innerHTML = directoryResults(); watchImages(); $('#search').focus(); return; }
    if (event.target.closest('#stop-audio, [data-action="stop-reading"]')) { stopAudio(); return; }
    if (event.target.closest('#speed')) { state.speed = state.speed === 1 ? 0.8 : 1; if (activeAudio) activeAudio.playbackRate = state.speed; persist(); updateSpeed(); if (activeAudio && !activeAudio.paused) $('#player-state').textContent = state.speed === 0.8 ? '慢速播放 · 0.8×' : '正在播放 · 1.0×'; notify(state.speed === 0.8 ? '已切换慢速跟读 · 0.8×' : '已切换正常语速 · 1.0×'); return; }
    if (event.target.closest('#nav-toggle')) { state.collapsed = !state.collapsed; persist(); navigation(); return; }
    const emptyLink = event.target.closest('.empty-state a[href="#scenes"]');
    if (emptyLink && location.hash === '#scenes') { state.query = ''; state.theme = 'all'; routePage(); }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'lesson-search' && currentScene) {
      state.lessonQuery = event.target.value; state.lessonPage = 0;
      $('#lesson-content').innerHTML = lessonContent(currentScene); return;
    }
    if (event.target.id !== 'search') return;
    state.query = event.target.value;
    $('.search-clear').hidden = !state.query;
    $('#directory-results').innerHTML = directoryResults();
    watchImages();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') stopAudio();
    if (['ArrowLeft', 'ArrowRight'].includes(event.key) && event.target.matches('[data-reader-panel]')) {
      event.preventDefault();
      const next = event.target.dataset.readerPanel === 'picture' ? $('#practice-mode') : $('#picture-mode');
      next.focus(); next.click(); return;
    }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !event.target.matches('[data-lesson-tab]')) return;
    event.preventDefault();
    const next = event.target.dataset.lessonTab === 'words' ? $('#sentences-tab') : $('#words-tab');
    next.focus(); next.click();
  });
  let boardDrag = null;
  document.addEventListener('pointerdown', (event) => {
    const viewport = event.target.closest('#board-viewport.is-zoomed');
    if (!viewport || event.pointerType !== 'mouse' || event.target.closest('button')) return;
    boardDrag = { viewport, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  document.addEventListener('pointermove', (event) => {
    if (!boardDrag) return;
    boardDrag.viewport.scrollLeft = boardDrag.left + boardDrag.x - event.clientX;
    boardDrag.viewport.scrollTop = boardDrag.top + boardDrag.y - event.clientY;
  });
  const endBoardDrag = () => { if (boardDrag) boardDrag.viewport.classList.remove('is-dragging'); boardDrag = null; };
  document.addEventListener('pointerup', endBoardDrag);
  document.addEventListener('pointercancel', endBoardDrag);
  window.addEventListener('hashchange', () => routePage({ focus: true }));
  window.addEventListener('pagehide', stopAudio);

  async function init() {
    $('#stop-audio').innerHTML = icon('stop');
    try {
      const responses = await Promise.allSettled([fetch('../content/catalog.json'), fetch('../build/audio-manifest.json'), fetch('../content/boards.json')]);
      if (responses[0].status !== 'fulfilled' || !responses[0].value.ok) throw new Error('catalog unavailable');
      const parsed = await responses[0].value.json();
      if (!Array.isArray(parsed.scenes) || !parsed.scenes.length || !Array.isArray(parsed.themes)) throw new Error('catalog invalid');
      catalog = { ...parsed, scenes: parsed.scenes.map((scene) => ({ ...scene, words: Array.isArray(scene.words) ? scene.words : [], sentences: Array.isArray(scene.sentences) ? scene.sentences : [] })) };
      if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
        try { const manifest = await responses[1].value.json(); audioMap = manifest.audio || {}; } catch (_) { audioMap = {}; }
      }
      if (responses[2].status !== 'fulfilled' || !responses[2].value.ok) throw new Error('pictures unavailable');
      const pictures = await responses[2].value.json();
      boardData = Array.isArray(pictures.boards) ? pictures.boards : [];
      if (catalog.scenes.some((scene) => !sceneBoards(scene).length)) throw new Error('pictures incomplete');
      allItems = catalog.scenes.flatMap((scene) => [...scene.words.map((word) => ({ ...word, type: 'word', sceneId: scene.id })), ...scene.sentences.map((sentence) => ({ ...sentence, type: 'sentence', sceneId: scene.id }))]);
      routePage();
    } catch (_) {
      navigation();
      $('#main').innerHTML = `<div class="error-state">${emptyState('学习内容暂时没有打开', '请检查网络连接，然后刷新重试。', '重新加载', location.href, 'book')}</div>`;
    }
  }
  init();
})();
