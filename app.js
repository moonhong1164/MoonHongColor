/* MoonHongCOLOR — 색채 타로 */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* 받침에 따라 조사 고르기: j('금(金)', '을', '를') — 괄호 앞 한글 글자를 본다 */
  function j(word, withFinal, without) {
    const hangul = [...String(word)].filter(ch => ch >= '가' && ch <= '힣');
    const last = hangul[hangul.length - 1];
    const has = last ? (last.charCodeAt(0) - 0xAC00) % 28 !== 0 : false;
    return word + (has ? withFinal : without);
  }

  const RAINBOW = 'linear-gradient(160deg,#d8322f 0%,#f07c22 17%,#f2c81f 33%,#2f9e5b 50%,#2357b8 67%,#273479 83%,#7b3fd0 100%)';
  const bg = c => (c.hex === 'rainbow' ? RAINBOW : c.grad || c.hex);
  const dot = c => `<i class="dot" style="background:${bg(c)}"></i>`;

  function shuffle(arr) {
    const a = arr.slice();
    const buf = new Uint32Array(a.length);
    crypto.getRandomValues(buf);
    for (let i = a.length - 1; i > 0; i--) {
      const j = buf[i] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- 카드 앞면: 그림 없이 색만 ---------- */
  function cardFace(c, cls = '') {
    return `<div class="face ${cls}" style="--card:${bg(c)};--ink:${c.ink}">
      <span class="corner tl">${esc(c.en)}</span>
      <strong class="cname">${esc(c.name)}</strong>
      <span class="corner br">${c.yy === 'yang' ? '陽' : c.yy === 'yin' ? '陰' : '中'} · ${c.el.join('')}</span>
    </div>`;
  }

  const BACK = `<div class="back"><svg viewBox="0 0 100 160" aria-hidden="true">
    <rect x="6" y="6" width="88" height="148" rx="6" class="frame"/>
    <circle cx="40" cy="70" r="20" style="fill:#d8322f"/><circle cx="60" cy="70" r="20" style="fill:#2357b8"/><circle cx="50" cy="88" r="20" style="fill:#f2c81f"/>
    <circle cx="50" cy="76" r="34" class="ring"/>
    <path d="M50 18l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM50 126l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" class="spark"/>
  </svg></div>`;

  /* ---------- 배열 고르기 ---------- */
  let spread = SPREADS[0];
  let topic = TOPICS[0];

  const spreadOptions = $('#spreadOptions');
  spreadOptions.innerHTML = SPREADS.map((s, i) => `
    <label class="opt">
      <input type="radio" name="spread" value="${s.id}" ${i === 0 ? 'checked' : ''}>
      <span><b>${esc(s.name)}</b><em>${s.count}장</em><small>${esc(s.desc)}</small></span>
    </label>`).join('');

  const topicOptions = $('#topicOptions');
  topicOptions.innerHTML = TOPICS.map((t, i) => `
    <label class="chip"><input type="radio" name="topic" value="${t.id}" ${i === 0 ? 'checked' : ''}><span>${esc(t.name)}</span></label>`).join('');

  /* ---------- 뽑기 ---------- */
  const table = $('#table');
  const fan = $('#fan');
  const layout = $('#layout');
  const statusEl = $('#status');
  const hint = $('#hint');
  const reading = $('#reading');
  let deck = [];
  let picked = [];
  let question = '';

  $('#setup').addEventListener('submit', e => {
    e.preventDefault();
    const sid = $('input[name=spread]:checked').value;
    const tid = $('input[name=topic]:checked').value;
    spread = SPREADS.find(s => s.id === sid);
    topic = TOPICS.find(t => t.id === tid);
    question = $('#question').value.trim();
    startTable();
  });

  $('#again').addEventListener('click', startTable);
  $('#back').addEventListener('click', () => {
    table.hidden = true;
    $('#draw').scrollIntoView({ behavior: 'smooth' });
  });

  function startTable() {
    deck = shuffle(COLORS);
    picked = [];
    table.hidden = false;
    reading.hidden = true;
    if (journal) journal.hide();
    $('#spreadTitle').textContent = `${spread.name} · ${topic.name}`;
    const asked = $('#asked');
    asked.hidden = !question;
    asked.textContent = question ? `“${question}”` : '';
    $('#deckZone').hidden = false;

    fan.innerHTML = deck.map((c, i) =>
      `<button type="button" class="fcard" data-i="${i}" style="--i:${i};--n:${deck.length}" aria-label="${i + 1}번째 카드 고르기">${BACK}</button>`).join('');
    $$('.fcard', fan).forEach(b => b.addEventListener('click', () => pick(b)));
    fitFan();

    layout.className = `layout shape-${spread.shape} n${spread.count}`;
    layout.innerHTML = spread.positions.map((p, i) => `
      <div class="slot" data-pos="${i}">
        <div class="slot-card"><div class="placeholder">${i + 1}</div></div>
        <p class="pos">${esc(p)}</p>
      </div>`).join('');

    updateStatus();
    table.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* 부채꼴이 화면 너비 안에 들어오도록 카드 사이 각도와 높이를 맞춘다.
   * 카드는 자기 높이의 3배 아래(transform-origin 50% 300%)를 중심으로 돈다. */
  function fitFan() {
    const first = $('.fcard', fan);
    if (!first || table.hidden) return;
    const w = first.offsetWidth, h = first.offsetHeight, R = 3 * h;
    const half = fan.clientWidth / 2 - w * 0.75;
    const max = Math.min(48, Math.asin(Math.max(0, Math.min(1, half / R))) * 180 / Math.PI);
    const n = deck.length;
    const step = n > 1 ? Math.min(5.2, (2 * max) / (n - 1)) : 0;
    fan.style.setProperty('--step', `${step.toFixed(2)}deg`);
    const theta = (step * (n - 1) / 2) * Math.PI / 180;
    fan.style.height = `${Math.round(h + R * (1 - Math.cos(theta)) + 26)}px`;
  }
  window.addEventListener('resize', fitFan);

  function updateStatus() {
    const left = spread.count - picked.length;
    if (left > 0) {
      statusEl.textContent = `마음을 가라앉히고 카드 ${left}장을 더 고르세요.`;
      hint.textContent = picked.length === 0 ? '부채꼴에서 끌리는 카드를 누르세요.' : `다음 자리: ${spread.positions[picked.length]}`;
    } else {
      statusEl.textContent = '모두 골랐습니다. 카드를 눌러 한 장씩 뒤집으세요.';
      hint.textContent = '';
    }
  }

  function pick(btn) {
    if (picked.length >= spread.count || btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('taken');
    const c = deck[+btn.dataset.i];
    const pos = picked.length;
    picked.push({ c, open: false });
    const slot = $(`.slot[data-pos="${pos}"] .slot-card`, layout);
    slot.innerHTML = `<button type="button" class="flip" aria-label="${esc(spread.positions[pos])} 카드 뒤집기">
      <span class="inner">${BACK}${cardFace(c)}</span></button>`;
    $('.flip', slot).addEventListener('click', () => flip(pos));
    updateStatus();
    if (picked.length === spread.count) {
      $('#deckZone').hidden = true;
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'ghost flip-all';
      all.textContent = '모두 뒤집기';
      all.addEventListener('click', () => picked.forEach((_, i) => flip(i)));
      statusEl.after(all);
    }
  }

  function flip(i) {
    if (picked.length < spread.count) return;
    const p = picked[i];
    if (p.open) { openColor(p.c); return; }
    p.open = true;
    $(`.slot[data-pos="${i}"] .flip`, layout).classList.add('open');
    if (picked.every(x => x.open)) {
      const fa = $('.flip-all', table);
      if (fa) fa.remove();
      statusEl.textContent = '모든 색이 드러났습니다. 아래 풀이를 읽어 보세요. 카드를 다시 누르면 도감 풀이가 열립니다.';
      setTimeout(showReading, 650);
    }
  }

  /* ---------- 풀이 ---------- */
  function relation(a, b) {
    const shared = a.el.filter(e => b.el.includes(e));
    if (a.mix.includes(b.id) || b.mix.includes(a.id)) {
      const [whole, part] = a.mix.includes(b.id) ? [a, b] : [b, a];
      return { kind: 'mix', text: `${j(whole.name, '은', '는')} ${j(part.name, '을', '를')} 품은 색입니다. 같은 뿌리를 가진 두 색이 이어져, ${part.name}의 뜻이 ${whole.name} 속에서 한 번 더 강조됩니다.` };
    }
    const act = (p, x, q, y, verb) => `${p.name}의 ${j(EL_INFO[x].name, '이', '가')} ${q.name}의 ${j(EL_INFO[y].name, '을', '를')} ${verb}`;
    for (const x of a.el) for (const y of b.el) {
      if (x !== y && SHENG[x] === y) return { kind: 'sheng', text: `${act(a, x, b, y, '살립니다')}(상생). 앞의 흐름이 뒤를 밀어 줍니다.` };
      if (x !== y && SHENG[y] === x) return { kind: 'sheng', text: `${act(b, y, a, x, '살립니다')}(상생). 뒤에 올 것이 앞을 거들어 줍니다.` };
    }
    if (shared.length) return { kind: 'same', text: `${j(a.name, '과', '와')} ${j(b.name, '은', '는')} 같은 ${shared.map(e => EL_INFO[e].name).join('·')} 기운을 나눕니다. 결이 닮아 이어지기 쉽습니다.` };
    for (const x of a.el) for (const y of b.el) {
      if (KE[x] === y) return { kind: 'ke', text: `${act(a, x, b, y, '누릅니다')}(상극). 둘 사이에 부딪힘이 있으니 조율이 필요합니다.` };
      if (KE[y] === x) return { kind: 'ke', text: `${act(b, y, a, x, '누릅니다')}(상극). 둘 사이에 부딪힘이 있으니 조율이 필요합니다.` };
    }
    return null;
  }

  function balanceText(cards) {
    const n = { yang: 0, yin: 0, mid: 0 };
    cards.forEach(c => n[c.yy]++);
    if (cards.length === 1) {
      const c = cards[0];
      return c.yy === 'yang' ? '밝은 양의 색이 나왔습니다. 밖으로 드러내고 움직일수록 좋아지는 때입니다.'
        : c.yy === 'yin' ? '어두운 음의 색이 나왔습니다. 안으로 다지고 살피며 때를 기다리는 편이 이롭습니다.'
        : '가운데의 색이 나왔습니다. 한쪽으로 치우치지 않고 균형을 잡는 것이 열쇠입니다.';
    }
    const parts = `양 ${n.yang} · 음 ${n.yin}${n.mid ? ` · 가운데 ${n.mid}` : ''}`;
    if (n.yang && n.yin && Math.abs(n.yang - n.yin) <= 1) return `${parts}. 밝음과 어둠이 고르게 섞였습니다. 음양이 어울린 배열은 편안하고 오래 가는 흐름으로 읽습니다.`;
    if (n.yang > n.yin) return `${parts}. 밝은 색이 많습니다. 기운이 위로, 밖으로 뻗는 때입니다. 다만 쉼 없이 달리면 지치니 숨 고를 자리를 만드세요.`;
    if (n.yin > n.yang) return `${parts}. 어두운 색이 많습니다. 지금은 드러내기보다 다지고 정리할 때입니다. 음이 깊으면 양이 돌아오는 법이니 조급해하지 마세요.`;
    return `${parts}. 가운데 색이 흐름을 잇고 있습니다. 서두르지 않고 중심을 지키는 것이 이롭습니다.`;
  }

  function elementText(cards) {
    const cnt = {};
    cards.forEach(c => c.el.forEach(e => { cnt[e] = (cnt[e] || 0) + (c.el.length === 5 ? 0.4 : 1 / c.el.length); }));
    const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return '';
    const [top] = sorted[0];
    const missing = Object.keys(EL_INFO).filter(e => !cnt[e]);
    let t = `가장 강한 기운은 <b>${EL_INFO[top].name}</b> — ${EL_INFO[top].word}입니다.`;
    if (cards.length >= 3 && missing.length && missing.length < 5) {
      t += ` 빠진 기운은 ${missing.map(e => EL_INFO[e].name).join(', ')}이니, ${missing.map(e => COLOR_BY_ID[EL_INFO[e].color].name).join('·')} 색을 가까이 두면 균형을 잡는 데 도움이 됩니다.`;
    }
    return t;
  }

  function matchText(me, mid, you) {
    const lines = [];
    const shared = me.el.filter(e => you.el.includes(e));
    if (me.yy !== you.yy && me.yy !== 'mid' && you.yy !== 'mid') {
      lines.push(`${me.name}(${me.yy === 'yang' ? '양' : '음'})과 ${you.name}(${you.yy === 'yang' ? '양' : '음'})은 밝고 어두움이 서로 다릅니다. 색채 타로의 궁합에서는 이렇게 대비되는 색이 서로의 빈자리를 채워 주는 관계로 읽습니다.`);
    } else if (shared.length || me.yy === you.yy) {
      lines.push(`${j(me.name, '과', '와')} ${j(you.name, '은', '는')} 결이 닮은 색입니다. 말이 잘 통하고 편하지만, 같은 곳이 비어 있어 서로를 채워 주기는 어렵습니다. 다른 점을 일부러 찾아 존중해 보세요.`);
    }
    const r = relation(me, you);
    if (r && r.kind !== 'same') {
      const tail = r.kind === 'sheng' ? ' 한쪽이 다른 쪽을 북돋워 주는 사이입니다.'
        : r.kind === 'ke' ? ' 부딪힘이 있지만, 대비가 뚜렷한 만큼 서로를 깨워 주기도 합니다.' : '';
      lines.push(r.kind === 'mix' ? r.text : r.text.replace(/\)\. .*$/, ').') + tail);
    }
    lines.push(`둘 사이에는 <b>${mid.name}</b>의 색이 흐릅니다. ${mid.love}`);
    return lines.join(' ');
  }

  function showReading() {
    const cards = picked.map(p => p.c);
    $('#palette').innerHTML = cards.map(c => `<span style="background:${bg(c)}"></span>`).join('');

    let summary = `<h3>색의 흐름</h3>`;
    if (question) summary += `<p class="q">“${esc(question)}”</p>`;
    summary += `<p>${balanceText(cards)}</p>`;
    const et = elementText(cards);
    if (et && cards.length > 1) summary += `<p>${et}</p>`;

    if (spread.id === 'match') {
      summary += `<p>${matchText(cards[0], cards[1], cards[2])}</p>`;
    } else if (cards.length > 1) {
      const rels = [];
      for (let i = 0; i < cards.length - 1; i++) {
        const r = relation(cards[i], cards[i + 1]);
        if (r) rels.push(`<li><span class="pair">${dot(cards[i])}${esc(spread.positions[i])} → ${dot(cards[i + 1])}${esc(spread.positions[i + 1])}</span> ${r.text}</li>`);
      }
      if (rels.length) summary += `<ul class="rels">${rels.join('')}</ul>`;
    }

    const last = cards[cards.length - 1];
    const key = spread.id === 'cross' ? cards[4] : spread.id === 'match' ? cards[1] : last;
    summary += `<p class="msg">${dot(key)} ${esc(key.message)}</p>`;
    $('#summary').innerHTML = summary;

    $('#details').innerHTML = cards.map((c, i) => `
      <article class="detail">
        <button type="button" class="mini" data-id="${c.id}" aria-label="${esc(c.name)} 도감 열기">${cardFace(c, 'small')}</button>
        <div>
          <p class="pos-name">${i + 1}. ${esc(spread.positions[i])}</p>
          <h4>${esc(c.name)} <small>${esc(c.en)} · ${YY_NAME[c.yy]}</small></h4>
          <p class="kw"><span class="light">${c.light.map(esc).join(' · ')}</span><span class="shadow">${c.shadow.map(esc).join(' · ')}</span></p>
          <p>${esc(c[topic.id])}</p>
          ${topic.id !== 'general' ? `<p class="soft">${esc(c.general)}</p>` : ''}
        </div>
      </article>`).join('');
    $$('#details .mini').forEach(b => b.addEventListener('click', () => openColor(COLOR_BY_ID[b.dataset.id])));

    reading.hidden = false;
    if (journal) journal.show();
    reading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 도감 ---------- */
  const FILTERS = [
    { id: 'all', name: '전체', f: () => true },
    { id: 'five', name: '오행색', f: c => c.group === '오행색' },
    { id: 'single', name: '단일색', f: c => c.group === '단일색' },
    { id: 'mixed', name: '혼합색', f: c => c.group === '혼합색' },
    { id: 'tint', name: '연한 색', f: c => c.group === '연한 색' },
    { id: 'shade', name: '짙은 색', f: c => c.group === '짙은 색' },
    { id: 'metal', name: '금속색', f: c => c.group === '금속색' },
    { id: 'yang', name: '양의 색', f: c => c.yy === 'yang' },
    { id: 'yin', name: '음의 색', f: c => c.yy === 'yin' }
  ];
  const grid = $('#grid');
  $('#filters').innerHTML = FILTERS.map((f, i) => `<button type="button" role="tab" data-f="${f.id}" aria-selected="${i === 0}">${f.name}</button>`).join('');
  $$('#filters button').forEach(b => b.addEventListener('click', () => {
    $$('#filters button').forEach(x => x.setAttribute('aria-selected', x === b));
    renderGrid(FILTERS.find(f => f.id === b.dataset.f).f);
  }));

  /* 도감 순서: 기본색 바로 뒤에 그 색의 연한·짙은 톤, 금속색은 맨 끝 */
  const ORDERED = [];
  COLORS.filter(c => !c.base && c.group !== '금속색').forEach(c => {
    ORDERED.push(...COLORS.filter(x => x.base === c.id && x.group === '연한 색'), c, ...COLORS.filter(x => x.base === c.id && x.group === '짙은 색'));
  });
  ORDERED.push(...COLORS.filter(c => c.group === '금속색'));

  function renderGrid(f) {
    grid.innerHTML = ORDERED.filter(f).map(c => `
      <button type="button" class="tile" data-id="${c.id}">
        ${cardFace(c)}
        <span class="tile-kw">${c.light.slice(0, 3).map(esc).join(' · ')}</span>
      </button>`).join('');
    $$('.tile', grid).forEach(b => b.addEventListener('click', () => openColor(COLOR_BY_ID[b.dataset.id])));
  }
  renderGrid(() => true);

  const modal = $('#modal');
  let lastFocus = null;
  function openColor(c) {
    lastFocus = document.activeElement;
    const mixLine = c.mix.length
      ? `<p class="mixline">${c.mix.map(id => `${dot(COLOR_BY_ID[id])}${esc(COLOR_BY_ID[id].name)}`).join(' + ')} → ${dot(c)}${esc(c.name)}</p>` : '';
    $('#mBody').innerHTML = `
      <div class="m-top">
        <div class="m-card">${cardFace(c)}</div>
        <div>
          <p class="eyebrow">${esc(c.en)} · ${esc(c.group)}</p>
          <h3 id="mTitle">${esc(c.name)}</h3>
          <p class="m-msg">${esc(c.message)}</p>
          ${mixLine}
          <dl class="facts">
            <dt>음양</dt><dd>${YY_NAME[c.yy]}</dd>
            <dt>오행</dt><dd>${c.el.map(e => EL_INFO[e].name).join(' · ')}</dd>
            <dt>떠오르는 것</dt><dd>${esc(c.image)}</dd>
            <dt>계절 · 때</dt><dd>${esc(c.season)} · ${esc(c.time)}</dd>
            <dt>인생</dt><dd>${esc(c.life)}</dd>
            <dt>몸</dt><dd>${esc(c.body)}</dd>
          </dl>
        </div>
      </div>
      <p class="kw"><span class="light">${c.light.map(esc).join(' · ')}</span><span class="shadow">${c.shadow.map(esc).join(' · ')}</span></p>
      <h4>전체 흐름</h4><p>${esc(c.general)}</p>
      <h4>애정</h4><p>${esc(c.love)}</p>
      <h4>금전</h4><p>${esc(c.money)}</p>
      <h4>직업 · 일</h4><p>${esc(c.work)}</p>
      <h4>건강</h4><p>${esc(c.health)}</p>
      <h4>타로 그림 속에서</h4><p>${esc(c.tarot)}</p>`;
    modal.hidden = false;
    document.body.classList.add('locked');
    $('.close', modal).focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('locked');
    if (lastFocus) lastFocus.focus();
  }
  $$('[data-close]', modal).forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ---------- 오행 바퀴 ---------- */
  (function wheel() {
    const order = ['木', '火', '土', '金', '水'];
    const R = 74, cx = 110, cy = 104;
    const pt = i => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    };
    let s = `<svg viewBox="0 0 220 210" role="img" aria-label="오행 상생 상극 그림">`;
    s += `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="arrow"/></marker></defs>`;
    order.forEach((e, i) => {
      const [x1, y1] = pt(i), [x2, y2] = pt((i + 1) % 5);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const ox = (mx - cx) * 0.28, oy = (my - cy) * 0.28;
      s += `<path d="M${x1} ${y1}Q${mx + ox} ${my + oy} ${x2} ${y2}" class="sheng" marker-end="url(#ah)" style="stroke-dasharray:0;"/>`;
    });
    order.forEach((e, i) => {
      const [x1, y1] = pt(i), [x2, y2] = pt((i + 2) % 5);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ke"/>`;
    });
    order.forEach((e, i) => {
      const [x, y] = pt(i);
      const c = COLOR_BY_ID[EL_INFO[e].color];
      s += `<circle cx="${x}" cy="${y}" r="19" style="fill:${c.hex}" class="node"/>`;
      s += `<text x="${x}" y="${y + 6}" text-anchor="middle" style="fill:${c.ink}">${e}</text>`;
    });
    s += `</svg>`;
    const legend = order.map(e => {
      const c = COLOR_BY_ID[EL_INFO[e].color];
      return `<li>${dot(c)}<b>${EL_INFO[e].name}</b> ${esc(c.name)} · ${esc(c.season)} · ${esc(c.body.split(',')[0])}</li>`;
    }).join('');
    $('#wheel').innerHTML = s + `<ul class="legend">${legend}</ul>`;
  })();

  $('#mixes').innerHTML = COLORS.filter(c => c.group === '혼합색' && c.id !== 'rainbow').map(c =>
    `<li>${c.mix.map(id => dot(COLOR_BY_ID[id])).join('<span>+</span>')}<span>=</span>${dot(c)}<b>${esc(c.name)}</b> <small>${c.light.slice(0, 2).map(esc).join(', ')}</small></li>`).join('')
    + `<li>${dot(COLOR_BY_ID.rainbow)}<b>무지개</b> <small>모든 색이 함께 — 조화와 연결</small></li>`;

  /* ---------- 익히기 ---------- */
  let qMode = 'mixed';
  let score = 0, total = 0, answered = false;
  const qText = $('#qText'), qChoices = $('#qChoices'), qResult = $('#qResult');

  const MAKERS = {
    keyword: c => ({ prompt: `밝은 뜻 “${c.light.slice(0, 3).join(', ')}”, 그림자 “${c.shadow[0]}”. 어떤 색일까요?` }),
    love: c => ({ prompt: `애정운: “${c.love}”` }),
    money: c => ({ prompt: `금전운: “${c.money}”` }),
    work: c => ({ prompt: `어울리는 일: “${c.work}”` }),
    body: c => ({ prompt: `떠오르는 것은 ${c.image}, 계절은 ${c.season}, 인생으로는 ${c.life}. 어떤 색일까요?` })
  };

  function hideName(text, c) {
    return text.split(c.name).join('○○');
  }

  function nextQuestion() {
    answered = false;
    qResult.textContent = '';
    qResult.className = 'q-result';
    const answer = COLORS[Math.floor(Math.random() * COLORS.length)];
    const mode = qMode === 'mixed' ? Object.keys(MAKERS)[Math.floor(Math.random() * 5)] : qMode;
    qText.textContent = hideName(MAKERS[mode](answer).prompt, answer);
    const choices = shuffle([answer, ...shuffle(COLORS.filter(c => c !== answer)).slice(0, 3)]);
    qChoices.innerHTML = choices.map(c => `<button type="button" data-id="${c.id}" style="--card:${bg(c)};--ink:${c.ink}">${esc(c.name)}</button>`).join('');
    $$('button', qChoices).forEach(b => b.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      total++;
      const ok = b.dataset.id === answer.id;
      if (ok) score++;
      $$('button', qChoices).forEach(x => {
        x.disabled = true;
        if (x.dataset.id === answer.id) x.classList.add('right');
        else if (x === b) x.classList.add('wrong');
      });
      qResult.className = `q-result ${ok ? 'ok' : 'no'}`;
      qResult.textContent = ok ? `맞았습니다. ${answer.name} — ${answer.message}` : `${answer.name}입니다. ${answer.message}`;
      $('#qScore').textContent = `${score} / ${total}`;
    }));
  }
  $$('.quiz-mode button').forEach(b => b.addEventListener('click', () => {
    $$('.quiz-mode button').forEach(x => x.classList.toggle('on', x === b));
    qMode = b.dataset.mode;
    nextQuestion();
  }));
  $('#qNext').addEventListener('click', nextQuestion);
  nextQuestion();

  /* ---------- 리딩 일지에 저장 (허브의 journal-box.js를 못 불러오면 아무것도 하지 않는다) ---------- */
  /* 색 카드는 방향이 없다(null). 배열 이름에 고른 주제를 붙여 둔다 */
  var journal = window.MoonHongJournal && window.MoonHongJournal.box ? window.MoonHongJournal.box({
    deck: '색채 타로', deckId: 'color', into: reading,
    read: () => {
      if (!spread || picked.length < spread.count || !picked.every(p => p.open)) return null;
      return { spread: `${spread.name} · ${topic.name}`, question,
        cards: picked.map((p, i) => ({ name: p.c.name, position: spread.positions[i], orientation: null })) };
    }
  }) : null;
})();
