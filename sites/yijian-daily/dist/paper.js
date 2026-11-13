(async () => {
  const main = document.getElementById('content');
  const fetchNews = async query => {
    const response = await fetch('/api/news/editions?' + new URLSearchParams(query), { cache: 'no-store' });
    if (!response.ok) throw Object.assign(new Error('读取刊期失败'), { status: response.status });
    return response.json();
  };
  const dates = [];
  let before = null;
  do {
    const page = await fetchNews(before ? { before } : {});
    dates.push(...page.dates);
    before = page.next;
  } while (before);
  if (!dates.length) {
    main.innerHTML = '<div class="empty"><p>暂未刊出新闻。</p></div>';
    main.removeAttribute('aria-busy');
    return;
  }
  const params = new URLSearchParams(location.search);
  const requestedDate = params.get('date');
  const [initialView, initialId] = location.hash.slice(1).split('/');
  // Article links shared before the archive existed have no date.
  const linkedDate = !dates.includes(requestedDate) && initialView === 'article' && /^[a-z0-9-]{1,128}$/.test(initialId || '')
    ? await fetchNews({ locate: initialId }) : null;
  const editionDate = dates.includes(requestedDate) ? requestedDate : linkedDate || dates[0];
  if (location.pathname === '/news/index.html' && /^https?:$/.test(location.protocol)) {
    const appReturn = document.getElementById('app-return');
    const home = new URL('/', location.origin);
    home.searchParams.set('tab', 'guanshi');
    home.searchParams.set('date', editionDate);
    if (params.get('embed') === 'ios' || window.__THEONE_IOS_EMBED__) home.searchParams.set('embed', 'ios');
    appReturn.href = home.href;
    appReturn.hidden = false;
  }
  const archive = new Map();
  const storyDates = new Map();
  const requests = new Map();
  function loadEdition(date) {
    if (!requests.has(date)) requests.set(date, fetchNews({ date }).then(edition => {
      for (const story of edition.stories) {
        archive.set(date + '/' + story.id, story);
        storyDates.set(story, date);
      }
      return edition;
    }).catch(error => { requests.delete(date); throw error; }));
    return requests.get(date);
  }
  const edition = await loadEdition(editionDate);
  const stories = edition.stories;
  const weekday = date => '星期' + '日一二三四五六'[new Date(date + 'T00:00:00Z').getUTCDay()];
  const storyKey = story => storyDates.get(story) + '/' + story.id;
  const dateText = date => {
    const [year, month, day] = date.split('-').map(Number);
    return year + ' 年 ' + month + ' 月 ' + day + ' 日';
  };
  function editionUrl(date, hash, fromSaved = false) {
    const url = new URL(location.href);
    url.searchParams.set('date', date);
    if (fromSaved) url.searchParams.set('from', 'saved');
    else url.searchParams.delete('from');
    url.hash = hash;
    return url.href;
  }
  const byId = new Map(stories.map(story => [story.id, story]));
  const sections = { world: ['国际', 'WORLD'], science: ['科技', 'TECHNOLOGY'], finance: ['金融', 'FINANCE'], domestic: ['民生', 'SOCIETY'], culture: ['艺术', 'ARTS'] };
  const leads = stories.filter(story => story.placement === 'lead');
  const selections = stories.filter(story => story.placement === 'selected');
  const briefs = stories.filter(story => story.placement === 'brief');
  const dialog = document.getElementById('search-dialog');
  const input = document.getElementById('query');
  const editionLabel = dateText(editionDate).replace(/\s+/g,'');
  function issueDestination(date) {
    const [view, key] = location.hash.slice(1).split('/');
    const category = view === 'section' && sections[key]?.[0];
    return editionUrl(date, category ? location.hash : '#front');
  }

  function setupEditionPicker() {
    const trigger = document.getElementById('edition-trigger');
    trigger.disabled = false;
    const dateline = trigger.closest('.dateline');
    const panel = document.getElementById('edition-panel');
    const monthHeading = document.getElementById('edition-month');
    const controls = document.getElementById('edition-month-controls');
    const older = document.getElementById('edition-older');
    const newer = document.getElementById('edition-newer');
    const days = document.getElementById('edition-days');
    const byMonth = new Map();
    for (const date of dates) {
      const month = date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(date);
    }
    const months = [...byMonth.keys()];
    const selectedMonth = months.indexOf(editionDate.slice(0, 7));
    let monthIndex = selectedMonth;
    controls.hidden = months.length < 2;
    trigger.setAttribute('aria-label', '切换刊期，当前为' + editionLabel + '，' + weekday(editionDate));

    function showMonth(index) {
      monthIndex = index;
      const month = months[index];
      const [year, number] = month.split('-').map(Number);
      monthHeading.textContent = year + ' 年 ' + number + ' 月';
      older.disabled = index === months.length - 1;
      newer.disabled = index === 0;
      const items = byMonth.get(month).map(date => {
        const item = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.href = issueDestination(date);
        anchor.setAttribute('aria-label', dateText(date) + '，' + weekday(date));
        if (date === editionDate) anchor.setAttribute('aria-current', 'date');
        const day = document.createElement('span');
        day.className = 'edition-day';
        day.textContent = Number(date.slice(-2)) + ' 日';
        const weekLabel = document.createElement('span');
        weekLabel.className = 'edition-day-week';
        weekLabel.textContent = weekday(date);
        anchor.append(day, weekLabel);
        item.append(anchor);
        return item;
      });
      days.replaceChildren(...items);
      days.scrollTop = 0;
    }
    function close(restoreFocus = false) {
      if (panel.hidden) return;
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({preventScroll: true});
    }
    function open() {
      showMonth(selectedMonth);
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      days.querySelector('[aria-current="date"]').focus();
    }
    trigger.addEventListener('click', () => panel.hidden ? open() : close(true));
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        open();
      }
    });
    function moveMonth(offset) {
      showMonth(monthIndex + offset);
      days.querySelector('a').focus();
    }
    older.addEventListener('click', () => moveMonth(1));
    newer.addEventListener('click', () => moveMonth(-1));
    dateline.addEventListener('keydown', event => {
      if (panel.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      if (!days.contains(event.target)) return;
      const links = [...days.querySelectorAll('a')];
      const current = links.indexOf(event.target);
      const next = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: links.length - 1 };
      if (!Object.hasOwn(next, event.key)) return;
      event.preventDefault();
      links[Math.max(0, Math.min(next[event.key], links.length - 1))].focus();
    });
    days.addEventListener('click', event => {
      if (event.target.closest('[aria-current="date"]')) {
        event.preventDefault();
        close(true);
      } else if (event.target.closest('a')) {
        close();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!dateline.contains(event.target)) close();
    });
    document.addEventListener('focusin', event => {
      if (!dateline.contains(event.target)) close();
    });
    window.addEventListener('pageshow', () => close());
    window.addEventListener('hashchange', () => close());
  }
  setupEditionPicker();
  const mastDate = document.querySelector('.edition-picker time');
  mastDate.dateTime = editionDate;
  mastDate.textContent = dateText(editionDate);
  document.getElementById('edition-weekday').textContent = weekday(editionDate);
  document.getElementById('edition-lunar').textContent = edition.lunar;
  const footDate = document.querySelector('footer time');
  footDate.dateTime = editionDate;
  footDate.textContent = editionDate.replaceAll('-', '.');
  document.querySelector('meta[name="description"]').content = edition.description ||
    '见天地，' + dateText(editionDate) + '。' + ((leads[0] || stories[0])?.title || '');
  const initialCategory = initialView === 'section' && sections[initialId]?.[0];
  if (requestedDate !== editionDate || (initialCategory && !stories.some(story => story.category === initialCategory))) {
    history.replaceState(null, '', editionUrl(editionDate, initialCategory ? '#front' : location.hash || '#front', params.get('from') === 'saved'));
  }
  const savedKey = 'yijian-daily.saved.v1';
  let activeCover = 0;
  let returnTo = params.get('from') === 'saved' ? '#saved' : '#front';
  let saved = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(savedKey));
    if (Array.isArray(stored)) {
      // Bookmarks saved by the original single-issue edition contain only a story ID.
      for (const id of stored) {
        if (typeof id !== 'string') continue;
        const key = id.includes('/') ? id : '2026-11-11/' + id;
        if (/^\d{4}-\d{2}-\d{2}\/[a-z0-9-]+$/.test(key) && dates.includes(key.slice(0, 10))) saved.add(key);
      }
    }
  } catch { /* Reading remains available with browser storage disabled. */ }

  document.querySelectorAll('#sections [data-section]').forEach(anchor => {
    const section = sections[anchor.dataset.section];
    if (section && !stories.some(story => story.category === section[0])) anchor.remove();
  });

  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const articleHref = story => {
    const hash = '#article/' + story.id;
    const date = storyDates.get(story);
    return date === editionDate ? hash : escape(editionUrl(date, hash, returnTo === '#saved'));
  };
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const link = (url, label) => '<a href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + escape(label) + '</a>';
  const image = (story, className, eager = false) => `<img class="${className} photo-${story.id}" src="${escape(story.photo.src)}" alt="${escape(story.photo.alt)}" width="${story.photo.width}" height="${story.photo.height}" decoding="async" ${eager ? 'loading="eager"' : 'loading="lazy"'}>`;
  const categoryLabel = story => escape(story.category) + ' <span> / ' + escape(story.section) + '</span>';
  const sectionHeading = (title, latin) => '<div class="section-head"><h2>' + title + '</h2><span class="latin" lang="en">' + latin + '</span></div>';

  function photoCredit(story) {
    return link(story.photo.sourceUrl, story.photo.credit);
  }

  function frontTitle(story) {
    const parts = story.coverPhrases;
    return parts ? parts.map(part => '<span class="title-phrase">'+escape(part)+'</span>').join('') : escape(story.title);
  }

  function articleTitle(story) {
    const phrases = story.coverPhrases?.join('') === story.title
      ? story.coverPhrases
      : story.title.match(/[^，]+，?/g);
    if (!phrases || phrases.length < 2 || phrases.join('') !== story.title) return escape(story.title);
    return phrases.map(phrase => '<span class="headline-phrase">' + escape(phrase) + '</span>').join('');
  }

  function thumbnail(story, cssClass) {
    const photo = story.photo;
    return `<figure class="story-visual"><a href="${articleHref(story)}" aria-label="阅读：${escape(story.title)}">${image(story,cssClass,true)}</a>
      <figcaption><span>${escape(photo.label)} · ${photoCredit(story)}</span></figcaption></figure>`;
  }

  function coverStory(story) {
    const href = articleHref(story);
    const pager = leads.length > 1 ? `<div class="pager" aria-label="切换头版报道">
      <button type="button" data-dir="-1" class="round" aria-label="上一篇头版报道">${icon('prev')}</button>
      <output aria-live="polite">${activeCover + 1} / ${leads.length}</output>
      <button type="button" data-dir="1" class="round" aria-label="下一篇头版报道">${icon('next')}</button>
    </div>` : '';
    return `<section class="hero" aria-label="头版焦点">
      <div class="hero-grid">
        <div class="lead-copy">
          <div class="overline">头版焦点<span lang="en">COVER STORY</span></div>
          <h1 class="lead-title"><a href="${href}">${frontTitle(story)}</a></h1>
          <div class="lead-dateline"><span>${escape(story.section)}</span><i></i>${escape(story.city)}</div>
          <p class="lead-summary">${escape(story.deck)}</p>
          <div class="lead-actions"><a class="read" href="${href}">阅读全文 ${icon('next')}</a>${pager}</div>
        </div>
        <figure class="hero-figure"><a class="hero-image-link" href="${href}" aria-label="阅读：${escape(story.title)}">${image(story,'hero-image',true)}</a>
          <figcaption>${icon('image')}<span>${escape(story.photo.caption)} <span class="figure-credit">${photoCredit(story)}</span></span></figcaption>
        </figure>
      </div></section>`;
  }

  function front() {
    if (!stories.length) return '<div class="empty"><p>本期报道尚未刊出。</p></div>';
    const cover = leads.length ? coverStory(leads[activeCover]) : '';
    const selected = selections.length ? `<section class="selection">${sectionHeading('本期选读','IN THIS ISSUE')}<div class="cards">${selections.map(card).join('')}</div></section>` : '';
    const dispatches = briefs.length ? `<section class="dispatches">${sectionHeading('短讯','NEWS IN BRIEF')}<div class="brief-list">${briefs.map(briefCard).join('')}</div></section>` : '';
    return cover + selected + dispatches;
  }

  function card(story) {
    const href = articleHref(story);
    return `<article class="card">${thumbnail(story,'card-photo')}
      <div class="card-cat">${categoryLabel(story)}</div><h3><a href="${href}">${escape(story.title)}</a></h3><p>${escape(story.deck)}</p></article>`;
  }

  function briefCard(story) {
    const href = articleHref(story);
    return `<article class="brief-card">${thumbnail(story,'brief-photo')}
      <div><div class="card-cat">${escape(story.city)} <span> / ${escape(story.section)}</span></div><h3><a href="${href}">${escape(story.title)}</a></h3>
      <p>${escape(story.paragraphs[0])}</p><a class="brief-source" href="${escape(story.sources[0][1])}" target="_blank" rel="noopener noreferrer" aria-label="查看报道来源：${escape(story.sources[0][0])}">查看报道来源</a></div></article>`;
  }

  function listing(title, latin, items, emptyMessage = '本期没有这个版面的报道。') {
    const rows = items.map(story => `<article class="list-row"><div><div class="card-cat">${categoryLabel(story)}</div><h2 class="list-title"><a href="${articleHref(story)}">${escape(story.title)}</a></h2><p class="list-summary">${escape(story.deck)}</p></div>${story.photo ? '<a href="'+articleHref(story)+'" aria-label="阅读：'+escape(story.title)+'">'+image(story,'list-photo')+'</a>' : ''}</article>`).join('');
    const empty = '<div class="empty"><p>'+emptyMessage+'</p><a href="#front" class="read">阅读本期 '+icon('next')+'</a></div>';
    return `<div class="page-heading"><h1>${title}</h1><span class="latin" lang="en">${latin}</span><span class="count">${items.length} 篇</span></div>${items.length ? rows : empty}`;
  }
  function picture(story) {
    const photo = story.photo;
    const license = photo.license ? ' · ' + link(photo.licenseUrl, photo.license) : '';
    const format = photo.height > photo.width ? ' article-figure-portrait' : '';
    return `<figure class="article-figure${format}">${image(story,'article-photo',true)}
      <figcaption><span>${escape(photo.caption)}</span><span class="photo-credit">图 / ${photoCredit(story)}${license}</span></figcaption></figure>`;
  }
  function article(story) {
    const backLabel = returnTo === '#saved' ? '返回收藏' : returnTo.startsWith('#section/') ? '返回版面' : '返回头版';
    const isSaved = saved.has(storyKey(story));
    const previous = archive.get(story.previousStory);
    const priorKey = /^(\d{4}-\d{2}-\d{2})\/([a-z0-9-]+)$/.exec(story.previousStory || '');
    const related = priorKey && dates.includes(priorKey[1]) ? `<aside class="prior-story"><span>前情 · ${escape(dateText(priorKey[1]))}</span><a href="${escape(editionUrl(priorKey[1], '#article/' + priorKey[2]))}">${previous ? escape(previous.title) : '阅读此前报道'}</a></aside>` : '';
    return `<article class="article">
      <div class="article-topline"><div class="overline">${escape(story.category)} · ${escape(story.section)}</div>
      <a class="back" href="${returnTo}">${icon('prev')}${backLabel}</a></div>
      <div class="article-copy"><header class="article-head">
      <h1 class="article-title">${articleTitle(story)}</h1>${story.placement === 'brief' ? '' : '<p class="article-deck">'+escape(story.deck)+'</p>'}
      <div class="byline"><span>${escape(story.city)}　·　<time datetime="${escape(editionDate)}">${escape(editionLabel)}</time></span>
      <button type="button" id="toggle-save" class="saved-button" aria-pressed="${isSaved}">${icon('save')}<span>${isSaved ? '已收藏' : '收藏本文'}</span></button></div></header>
      <div class="article-body">${story.paragraphs.map(p => '<p>'+escape(p)+'</p>').join('')}
      ${related}</div></div>
      <div class="article-media">${picture(story)}
      <aside class="source-line" aria-label="报道来源"><span>报道来源</span><div class="source-link">${story.sources.map(([name,url]) => link(url,name)).join('')}</div></aside></div></article>`;
  }

  let viewVersion = 0;
  async function render(moveFocus = false) {
    const version = ++viewVersion;
    main.removeAttribute('aria-busy');
    if (dialog.open) dialog.close();
    const [kind,slug] = location.hash.slice(1).split('/');
    const current = kind === 'article' ? byId.get(slug) : null;
    const section = kind === 'section' && sections[slug];
    let navKey = 'front';
    let title = '见天地 · ' + editionLabel;
    if (current) {
      main.innerHTML = article(current);
      const priorDate = current.previousStory?.split('/')[0];
      if (priorDate && dates.includes(priorDate) && !archive.has(current.previousStory)) {
        loadEdition(priorDate).then(() => {
          const previous = archive.get(current.previousStory);
          const link = main.querySelector('.prior-story a');
          if (viewVersion === version && previous && link) link.textContent = previous.title;
        }).catch(() => {}); // The stable link remains usable even when the prior headline is unavailable.
      }
      title = current.title + ' · 见天地';
      navKey = Object.keys(sections).find(key => sections[key][0] === current.category);
    } else if (section) {
      returnTo = '#section/' + slug;
      main.innerHTML = listing(...section, stories.filter(s => s.category === section[0]));
      title = section[0] + ' · 见天地';
      navKey = slug;
    } else if (kind === 'saved') {
      returnTo = '#saved';
      const needed = [...new Set([...saved].filter(key => !archive.has(key)).map(key => key.slice(0, 10)))];
      if (needed.length) {
        main.setAttribute('aria-busy', 'true');
        main.innerHTML = '<div class="empty"><p>正在读取收藏…</p></div>';
      }
      let failed = false;
      while (needed.length && version === viewVersion) {
        const batch = await Promise.allSettled(needed.splice(0, 4).map(loadEdition));
        if (batch.some(result => result.status === 'rejected')) failed = true;
      }
      if (version !== viewVersion) return;
      main.removeAttribute('aria-busy');
      main.innerHTML = listing('我的收藏','READING LIST',[...saved].reverse().map(id => archive.get(id)).filter(Boolean), failed ? '暂时无法读取收藏的报道。' : '还没有收藏。打开一篇报道，点「收藏本文」即可保存到这里。') +
        (failed ? '<div class="empty"><p>部分刊期暂时无法读取。</p><button type="button" class="read" id="retry-saved">重新读取</button></div>' : '');
      title = '我的收藏 · 见天地';
      navKey = 'saved';
    } else {
      returnTo = '#front';
      main.innerHTML = front();
    }
    document.title = title;
    document.querySelectorAll('[data-section],#open-saved').forEach(a => {
      if ((a.dataset.section || 'saved') === navKey) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    if (moveFocus) { window.scrollTo(0,0); main.focus({preventScroll:true}); }
  }

  main.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'retry-saved') {
      render();
    } else if (button.dataset.dir) {
      activeCover = (activeCover + Number(button.dataset.dir) + leads.length) % leads.length;
      main.innerHTML = front();
      main.querySelector('[data-dir="'+button.dataset.dir+'"]').focus({preventScroll:true});
    } else if (button.id === 'toggle-save') {
      const id = editionDate + '/' + location.hash.split('/')[1];
      if (saved.has(id)) saved.delete(id); else saved.add(id);
      try { localStorage.setItem(savedKey,JSON.stringify([...saved])); } catch { /* In-memory bookmarks still work. */ }
      button.setAttribute('aria-pressed',String(saved.has(id)));
      button.querySelector('span').textContent = saved.has(id) ? '已收藏' : '收藏本文';
    }
  });

  function updateResults() {
    const term = input.value.trim().toLocaleLowerCase();
    const found = stories.filter(s => [s.title,s.city,s.deck,s.category,s.section,...s.sources.map(([label]) => label),...s.paragraphs].join(' ').toLocaleLowerCase().includes(term));
    document.getElementById('result-count').textContent = found.length ? (term ? '找到 '+found.length+' 篇报道' : '本期共 '+found.length+' 篇报道') : '没有找到报道，可以试试地点或更短的关键词。';
    document.getElementById('search-list').innerHTML = found.map(s => '<a href="'+articleHref(s)+'"><small>'+escape(s.category)+'</small><span>'+escape(s.title)+'</span></a>').join('');
  }
  document.getElementById('open-search').addEventListener('click',() => {
    input.value = ''; updateResults(); dialog.showModal(); input.focus();
  });
  input.addEventListener('input',updateResults);
  document.getElementById('close-search').addEventListener('click',() => dialog.close());
  document.getElementById('search-list').addEventListener('click',e => { if (e.target.closest('a')) dialog.close(); });
  dialog.addEventListener('click',e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  });
  document.querySelector('.skip').addEventListener('click',e => { e.preventDefault(); main.focus(); });
  window.addEventListener('hashchange',() => render(true));
  await render();
})().catch(error => {
  const main = document.getElementById('content');
  main.removeAttribute('aria-busy');
  main.innerHTML = error.status === 404
    ? '<div class="empty"><p>请使用管理员账号登录后阅读。</p><a class="read" id="paper-login" href="/login">前往登录</a></div>'
    : '<div class="empty"><p>暂时无法读取刊期。</p><button type="button" class="read">重新读取</button></div>';
  main.querySelector('button')?.addEventListener('click', () => location.reload());
  const login = document.getElementById('paper-login');
  if (login) login.href = '/login?next=' + encodeURIComponent('/news/index.html' + location.search + location.hash);
});
