'use strict';

let boot, mode = 'home', writeKind = 'latin', chatBusy = false, round = 0;
let progress = {cards: {}, seen: [], skills: {}};
try {
  progress = {...progress, ...JSON.parse(localStorage.getItem('herbarium-progress') || '{}')};
} catch {}
const view = document.querySelector('#view');
const notice = document.querySelector('#notice');
const esc = value => String(value).replace(/[&<>"']/g, char => (
  {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]
));

async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-CSRF-Token': boot.csrf},
    body: JSON.stringify(body)
  });
  const json = await response.json();
  if (!response.ok) throw Error(json.error || 'Verbindung fehlgeschlagen');
  return json;
}

function fail(error) {
  notice.textContent = error.message;
}

function save() {
  try {
    localStorage.setItem('herbarium-progress', JSON.stringify(progress));
  } catch {
    document.querySelector('#saved').textContent = 'Fortschritt konnte nicht gespeichert werden';
  }
}

const plantScopes = {
  all: 'Alle Pflanzen', script: '80 Skripteinträge', other: 'Weitere Pflanzen',
  school: 'Gesamte Pflanzenliste der Ausbildung'
};

function scopeOptions() {
  return Object.entries(plantScopes).map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
}

function inScope(plant, scope) {
  if (scope === 'script') return plant.script_course;
  if (scope === 'other') return !plant.script_course;
  if (scope === 'school') return plant.school;
  return true;
}

function rememberScope(scope) {
  plantScope = scope;
  try { localStorage.setItem('herbarium-plant-scope', scope); } catch {}
}

let plantScope = 'all';
try {
  const stored = localStorage.getItem('herbarium-plant-scope');
  if (Object.hasOwn(plantScopes, stored)) plantScope = stored;
} catch {}

const levels = ['Neu', 'In Übung', 'Sicher'];
const level = plant => Math.min(2, progress.cards[plant.id] ?? Number(progress.seen.includes(plant.id)));
const modes = {
  quick: ['Pflanzenwissen', 'Steckbriefe aus den Kursunterlagen nachschlagen und in fünf Fragen üben.'],
  choice: ['Pflanzen erkennen', 'Wähle den passenden lateinischen Namen.'],
  write: ['Namen schreiben', 'Übe den ganzen Namen, die Gattung oder das Art-Epitheton.']
};

function sources(items) {
  return items.filter(Boolean).map(source => (
    `<a class="source" target="_blank" rel="noopener" href="/documents/${esc(source.doc)}.pdf#page=${esc(source.page)}">${source.number ? `[${source.number}] ` : ''}${esc(source.title)} · PDF-Seite ${source.page}</a>`
  )).join('');
}

function home() {
  const specimen = boot.plants.find(plant => plant.id === 'schafgarbe')?.study_plate;
  const groups = [
    ['Schule · 80 Skripteinträge', boot.plants.filter(plant => plant.script_course), 'course-deck'],
    ['Weitere Pflanzen', boot.plants.filter(plant => !plant.script_course), 'other-deck']
  ];
  view.innerHTML = `<div class="hero"><div><h1>Wildkräuter<br>lernen</h1>
    <p class="sub">${boot.plants.length} Karten · ${boot.plants.filter(plant => plant.image).length} mit Bild</p>
    <button class="primary" data-go="quick">Pflanzenwissen öffnen</button></div>
    ${specimen?.image ? `<img src="${esc(specimen.image)}" alt="Botanische Tafel der Schafgarbe">` : ''}</div>
    <section aria-labelledby="progress-heading" class="learning-progress">
    <h2 id="progress-heading">Dein Lernfortschritt</h2>
    <div class="progress-groups">${groups.map(([title, plants, target]) => {
      const counts = levels.map((_, index) => plants.filter(plant => level(plant) === index).length);
      return `<article class="progress-group"><h3>${title}</h3>
        <p><strong>${counts[2]} von ${plants.length}</strong> Karten sicher</p>
        <progress max="${plants.length || 1}" value="${counts[2]}" aria-label="${title}: sichere Karten"></progress>
        <p class="sub">${counts[0]} neu · ${counts[1]} in Übung</p>
        <button class="secondary" data-go="${target}">Karten öffnen</button></article>`;
    }).join('')}</div></section>
    <div class="cards">${Object.entries(modes).map(([id, [title, description]]) => (
      `<button class="mode-card" data-go="${id}"><h3>${title}</h3><p>${description}</p></button>`
    )).join('')}</div>`;
}

async function go(next) {
  if (next === 'course-deck' || next === 'other-deck') {
    rememberScope(next === 'course-deck' ? 'script' : 'other');
    next = 'deck';
  }
  mode = next === 'photo-test' ? 'choice' : next;
  round++;
  notice.textContent = '';
  document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === (mode === 'botany-test' ? 'botany' : ['missing', 'names', 'school', 'images'].includes(mode) ? 'deck' : mode)));
  if (mode === 'home') return home();
  if (mode === 'chat') return chat();
  if (mode === 'botany') return botany(false);
  if (mode === 'botany-test') return botany(true);
  if (mode === 'quick') return herbKnowledge();
  if (mode === 'library') return library();
  if (mode === 'deck' || mode === 'missing') return deck(mode === 'missing' ? 'missing' : plantScope);
  if (mode === 'school') return deck('school');
  if (mode === 'names') return reviewNames();
  if (mode === 'images') return reviewImages();
  return exercise(next === 'photo-test');
}

let previous;
const exerciseImage = plant => mode === 'choice' ? plant.recognition_image : plant.image;

function drawCard(textOnly) {
  const photosOnly = document.querySelector('#stack')?.value === 'photos';
  const scope = document.querySelector('#deck-scope').value;
  const allowed = boot.plants.filter(plant =>
    inScope(plant, scope) &&
    !(plant.group && (mode === 'choice' || (mode === 'write' && writeKind !== 'genus'))) &&
    (textOnly ? !exerciseImage(plant) : exerciseImage(plant)) &&
    (!photosOnly || plant.recognition_image?.startsWith('/images/foto-')));
  const other = allowed.filter(plant => plant.id !== previous);
  const pool = other.length ? other : allowed;
  const weights = [4, 7, 1];
  let draw = Math.random() * pool.reduce((sum, plant) => sum + weights[level(plant)], 0);
  return pool.find(plant => (draw -= weights[level(plant)]) < 0);
}

function exercise(photosOnly) {
  const [title, description] = modes[mode];
  view.innerHTML = `<div class="workspace"><h1>${title}</h1><p class="sub">${description}</p>
    <div class="toolbar">
    ${mode === 'write' ? '<label>Abfrage <select id="kind"><option value="latin">Vollständiger Name</option><option value="genus">Gattung</option><option value="species">Art-Epitheton</option></select></label>' : ''}
    ${mode === 'choice' && boot.plants.some(plant => plant.recognition_image?.startsWith('/images/foto-')) ? '<label>Bilder <select id="stack"><option value="image">Fotos und Tafeln</option><option value="photos">Nur echte Fotos</option></select></label>' : ''}
    ${mode !== 'choice' && boot.plants.some(plant => !plant.image) ? '<label>Stapel <select id="stack"><option value="image">Mit Bild</option><option value="text">Ohne Bild · Deutsch als Hinweis</option></select></label>' : ''}
    <label>Pflanzen <select id="deck-scope">${scopeOptions()}</select></label>
    <button class="secondary" id="next">Nächste Karte →</button>
    </div><div class="plant-layout"><div class="plate" id="plate"></div><div class="panel" id="task"></div></div></div>`;
  const kind = document.querySelector('#kind');
  if (kind) {
    kind.value = writeKind;
    kind.onchange = () => { writeKind = kind.value; newTask().catch(fail); };
  }
  const stack = document.querySelector('#stack');
  if (stack) {
    if ((photosOnly || mode === 'choice') && stack.querySelector('[value=photos]')) stack.value = 'photos';
    else if (!boot.plants.some(plant => plant.image)) stack.value = 'text';
    stack.onchange = () => newTask().catch(fail);
  }
  const scope = document.querySelector('#deck-scope');
  scope.value = plantScope;
  scope.onchange = () => { rememberScope(scope.value); newTask().catch(fail); };
  document.querySelector('#next').onclick = () => newTask().catch(fail);
  return newTask();
}

function photoCredit(photo) {
  if (!photo) return '';
  return `<p class="sub">Foto von ${esc(photo.credit)} · <a href="${esc(photo.url)}" target="_blank" rel="noopener">${esc(photo.platform || 'iNaturalist')}</a> · <a href="${esc(photo.license_url)}" target="_blank" rel="noopener">${esc(photo.license)}</a>${photo.taxon ? ` · <i>${esc(photo.taxon)}</i>` : ''}</p>`;
}

function courseSource([prefix, page]) {
  const document = boot.documents.find(doc => doc.title.startsWith(prefix));
  return document ? sources([{doc: document.id, title: document.title, page}]) : '';
}

function profileInfo(id) {
  const profile = profiles[id];
  return profile ? `<details class="specimen"><summary>Erkennungsmerkmale</summary>
    <p><strong>Blatt</strong> ${esc(profile.leaf)}</p>
    <p><strong>Wuchs, Blüte oder Frucht</strong> ${esc(profile.features)}</p>
    ${profile.contents ? `<p><strong>Inhaltsstoffe</strong> ${esc(profile.contents)}</p>` : ''}
    ${profile.comparison ? `<p><strong>Verwechslung</strong> ${esc(profile.comparison)}</p>` : ''}
    ${courseSource(profile.source)}</details>` : '';
}

function plantInfo(plant, showImageInfo = true) {
  return `<h2><i>${esc(plant.latin)}</i></h2>
    <details><summary>Deutschen Namen anzeigen</summary><p>${esc(plant.de)}</p></details>
    ${showImageInfo && plant.image_note ? `<p class="sub">${esc(plant.image_note)}</p>` : ''}
    <p>Gattung <i>${esc(plant.latin.split(' ')[0])}</i>${plant.family ? ` · Familie <i>${esc(plant.family)}</i>` : ''}</p>
    ${plant.group ? '<p class="sub">Gattung oder Artengruppe aus der Kursliste</p>' : ''}
    ${profileInfo(plant.id)}${sources([plant.school, plant.course, showImageInfo && plant.source])}${showImageInfo ? photoCredit(plant.photo) : ''}`;
}

function recordSkill(id, skill, correct) {
  const values = progress.skills[id] ??= {};
  values[skill] = correct ? Math.min((values[skill] || 0) + 1, 2) : 1;
}

function rate(plant, correct) {
  const skill = mode === 'choice' ? (plant.photo ? 'photo' : 'plate') : 'name';
  recordSkill(plant.id, skill, correct);
  progress.cards[plant.id] = correct ? Math.min(level(plant) + 1, 2) : 1;
  save();
}

async function newTask() {
  const token = ++round;
  const active = mode;
  const textOnly = document.querySelector('#stack')?.value === 'text';
  const task = document.querySelector('#task');
  const plate = document.querySelector('#plate');
  notice.textContent = '';
  task.replaceChildren();
  plate.replaceChildren();
  const plant = drawCard(textOnly);
  if (!plant) {
    task.textContent = 'Für diesen Stapel gibt es noch keine Karten.';
    return;
  }
  previous = plant.id;
  const image = exerciseImage(plant);
  if (image) {
    plate.innerHTML = `<a href="${esc(image)}" target="_blank" rel="noopener"><img src="${esc(image)}" alt="Bild der gesuchten Pflanze"><span>Bild vergrössern ↗</span></a>`;
  }
  const kind = active === 'choice' ? 'choice' : writeKind;
  const scope = document.querySelector('#deck-scope').value;
  const challenge = await api('/api/challenge?' + new URLSearchParams({id: plant.id, scope, text: textOnly ? '1' : '0'}));
  if (token !== round) return;
  if (!image && challenge.prompt) plate.textContent = challenge.prompt;
  const labels = {latin: 'Gattung und Art-Epitheton', genus: 'Gattung', species: 'Art-Epitheton'};
  task.innerHTML = active === 'choice'
    ? `<h2>Welche Pflanze siehst du?</h2><div class="choices">${challenge.options.map(option => `<button data-answer="${esc(option.id)}"><i>${esc(option.label)}</i></button>`).join('')}</div>`
    : `<form id="answer-form"><label for="answer">${labels[kind]}</label><input id="answer" autocomplete="off" spellcheck="false" required><button class="primary">Antwort prüfen</button></form>`;
  task.insertAdjacentHTML('beforeend', '<div id="feedback" aria-live="polite"></div>');
  async function answer(value) {
    const inputs = task.querySelectorAll('button,input');
    inputs.forEach(input => { input.disabled = true; });
    try {
      const result = await api('/api/answer', {challenge: challenge.challenge, mode: kind, answer: value});
      if (token !== round) return;
      rate(result.plant, result.correct);
      document.querySelector('#feedback').innerHTML = `<div class="result ${result.correct ? '' : 'wrong'}"><strong>${result.correct ? 'Richtig' : 'Noch üben'}</strong>${plantInfo(result.plant)}</div>`;
    } catch (error) {
      if (token === round) fail(error);
    }
  }
  task.querySelectorAll('[data-answer]').forEach(button => { button.onclick = () => answer(button.dataset.answer); });
  const form = task.querySelector('form');
  if (form) form.onsubmit = event => { event.preventDefault(); answer(form.querySelector('input').value); };
}

async function deck(filterMode) {
  const token = round;
  const plants = await api('/api/deck');
  if (token !== round) return;
  view.innerHTML = `<div class="workspace"><h1>Steckbriefe</h1>
    <div class="toolbar"><button class="secondary" data-go="names">Namen prüfen</button><button class="secondary" data-go="images">Bilder prüfen</button><label>Pflanzen <select id="card-scope">${scopeOptions()}</select></label><label>Ansicht <select id="deck-filter"><option value="all">Alle Karten</option><option value="missing">Ohne botanische Tafel</option>
    ${levels.map((name, index) => `<option value="${index}">${name}</option>`).join('')}</select></label><label>Pflanze suchen <input id="deck-search" type="search" placeholder="Name, Familie …"></label></div>
    <p id="deck-count" role="status"></p><div id="deck-list"></div></div>`;
  const filter = document.querySelector('#deck-filter');
  const scope = document.querySelector('#card-scope');
  scope.value = filterMode === 'missing' ? plantScope : filterMode;
  filter.value = filterMode === 'missing' ? 'missing' : 'all';
  function render() {
    const query = document.querySelector('#deck-search').value.trim().toLocaleLowerCase('de');
    const selected = plants.filter(plant =>
      inScope(plant, scope.value) && (filter.value === 'all'
        || (filter.value === 'missing' ? !plant.study_plate : level(plant) === Number(filter.value)))
      && [plant.latin, plant.de, plant.family, ...(plant.sections || [])].join(' ').toLocaleLowerCase('de').includes(query));
    document.querySelector('#deck-count').textContent = `${selected.length} ${selected.length === 1 ? 'Karte' : 'Karten'}`;
    document.querySelector('#deck-list').innerHTML = selected.map(plant => `<details class="folder"><summary><i>${esc(plant.latin)}</i> <span>${plant.study_plate ? 'Botanische Tafel' : 'Ohne Tafel'} · ${levels[level(plant)]}</span></summary>
      ${plantInfo(plant, false)}
      <p class="sub">Name: ${levels[progress.skills[plant.id]?.name ?? 0]} · Foto: ${levels[progress.skills[plant.id]?.photo ?? 0]} · Merkmale: ${levels[progress.skills[plant.id]?.features ?? 0]}</p>
      ${plant.sections?.length ? `<p>${esc(plant.sections.join(' · '))}</p>` : ''}
      ${plant.study_plate ? `<a class="source" href="${esc(plant.study_plate.image)}" target="_blank" rel="noopener">
        <img class="deck-image" src="${esc(plant.study_plate.image)}" loading="lazy" alt="Botanische Illustration · ${esc(plant.de)}">
        <span>Tafel vergrössern ↗</span></a>${sources([plant.study_plate.source])}` : ''}
      ${plant.image ? `<a class="source" href="#bilder-pruefen=${encodeURIComponent(plant.id)}">Zur Bildprüfung</a>` : ''}</details>`).join('');
  }
  scope.onchange = () => { rememberScope(scope.value); render(); };
  filter.onchange = render;
  document.querySelector('#deck-search').oninput = render;
  render();
}

const imageReviewLabels = {open: 'Offen', accept: 'Bestätigt', replace: 'Ersatz gewünscht'};
const imageStatus = plant => plant.image_review?.choice || 'open';

async function reviewImages() {
  const token = round;
  const plants = (await api('/api/deck')).filter(plant => plant.image);
  if (token !== round) return;
  const selectedId = new URLSearchParams(location.hash.slice(1)).get('bilder-pruefen');
  view.innerHTML = `<div class="workspace"><button class="secondary" data-go="deck">← Steckbriefe</button>
    <h1>Bilder prüfen</h1>
    <div class="toolbar"><label>Ansicht <select id="image-review-filter"><option value="all">Alle Bilder</option>
    ${Object.entries(imageReviewLabels).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
    <label>Pflanze suchen <input id="image-review-search" type="search" placeholder="Deutsch oder Latein"></label></div>
    <p id="image-review-count" role="status"></p><div id="image-review-card"></div></div>`;
  const filter = document.querySelector('#image-review-filter');
  const search = document.querySelector('#image-review-search');
  const card = document.querySelector('#image-review-card');
  let index = Math.max(0, plants.findIndex(plant => plant.id === selectedId));
  function render() {
    const query = search.value.trim().toLocaleLowerCase('de');
    const visible = plants.filter(plant => (filter.value === 'all' || filter.value === imageStatus(plant))
      && `${plant.de} ${plant.latin}`.toLocaleLowerCase('de').includes(query));
    index = Math.max(0, Math.min(visible.length - 1, index));
    const plant = visible[index];
    const replacementCount = plants.filter(item => imageStatus(item) === 'replace').length;
    document.querySelector('#image-review-count').textContent = `${visible.length} in dieser Ansicht · ${replacementCount} mit Ersatzwunsch`;
    if (!plant) {
      card.innerHTML = '<p>In dieser Ansicht sind keine Bilder.</p>';
      return;
    }
    const caption = `${plant.de} · ${plant.latin}`;
    card.innerHTML = `<div class="toolbar review-nav"><button class="secondary" id="previous-image" ${index ? '' : 'disabled'}>← Zurück</button>
      <span>${index + 1} von ${visible.length}</span>
      <button class="secondary" id="next-image" ${index + 1 < visible.length ? '' : 'disabled'}>Weiter →</button></div>
      <div class="plant-layout"><div class="plate">
      <a href="${esc(plant.image)}" target="_blank" rel="noopener"><img src="${esc(plant.image)}" alt="${esc(caption)}"><span>Bild vergrössern ↗</span></a></div>
      <div class="panel"><h2>${esc(plant.de)}</h2><p><i>${esc(plant.latin)}</i></p>
      ${photoCredit(plant.photo)}${sources([plant.source])}
      <p><strong>${imageReviewLabels[imageStatus(plant)]}</strong></p>
      <label for="replacement-note">Was soll auf dem neuen Bild besser sichtbar sein?</label>
      <input id="replacement-note" maxlength="500" placeholder="Zum Beispiel die ganze Pflanze" value="${esc(plant.image_review?.note || '')}">
      <div class="toolbar review-nav"><button class="primary" data-image-choice="accept">Bild bestätigen</button>
      <button class="secondary" data-image-choice="replace">Ersatz markieren</button>
      ${plant.image_review ? '<button class="secondary" data-image-choice="reset">Entscheidung zurücksetzen</button>' : ''}</div></div></div>`;
    document.querySelector('#previous-image').onclick = () => { index--; render(); };
    document.querySelector('#next-image').onclick = () => { index++; render(); };
    const controls = [...card.querySelectorAll('[data-image-choice]')];
    for (const control of controls) {
      control.onclick = async () => {
        controls.forEach(button => { button.disabled = true; });
        try {
          const choice = control.dataset.imageChoice;
          const note = card.querySelector('#replacement-note').value;
          const result = await api('/api/image-review', {id: plant.id, image: plant.image, choice, note});
          if (token !== round) return;
          plant.image_review = result.review;
          if (filter.value === 'all' && choice !== 'reset' && visible[index]?.id === plant.id && index + 1 < visible.length) index++;
          render();
        } catch (error) {
          if (token !== round) return;
          fail(error);
          controls.forEach(button => { button.disabled = false; });
        }
      };
    }
  }
  filter.onchange = search.oninput = () => { index = 0; render(); };
  render();
}

async function reviewNames() {
  const token = round;
  const records = await api('/api/name-review');
  if (token !== round) return;
  const pending = record => record.decision !== 'keep'
    && JSON.stringify(record.decision) !== JSON.stringify(record.version);
  let index = Math.max(0, records.findIndex(pending));
  function render() {
    const record = records[index];
    view.innerHTML = `<div class="workspace"><button class="secondary" data-go="deck">← Steckbriefe</button>
      <h1>Namen prüfen</h1><p role="status">${records.filter(pending).length} offen · ${records.length} Vorschläge</p>
      ${record ? `<article class="result"><h2>Vorschlag ${index + 1} von ${records.length}</h2>
        <p><strong>Bisher</strong><br><i>${esc(record.latin)}</i> · ${esc(record.de)}${record.proposal.family && record.family ? ` · ${esc(record.family)}` : ''}</p>
        <p><strong>Vorschlag</strong><br><i>${esc(record.proposal.latin)}</i> · ${esc(record.proposal.de)}${record.proposal.family ? ` · ${esc(record.proposal.family)}` : ''}</p>
        <p>${esc(record.proposal.reason)}</p>
        <a class="source" href="${esc(record.proposal.url)}" target="_blank" rel="noopener">InfoFlora öffnen ↗</a>
        <p>${pending(record) ? 'Entscheidung offen' : record.decision === 'keep' ? 'Bisheriger Name behalten' : 'Vorschlag übernommen'}</p>
        <div class="row"><button class="primary" data-decision="accept">Vorschlag übernehmen</button>
        <button class="secondary" data-decision="keep">Bisherigen Namen behalten</button>
        ${pending(record) ? '' : '<button class="secondary" data-decision="reset">Entscheidung zurücksetzen</button>'}</div>
      </article><div class="toolbar review-nav"><button class="secondary" id="previous-name" ${index === 0 ? 'disabled' : ''}>← Zurück</button>
      <button class="secondary" id="next-name" ${index + 1 === records.length ? 'disabled' : ''}>Weiter →</button></div>`
      : '<p>Derzeit sind keine Namensvorschläge vorhanden.</p>'}</div>`;
    if (!record) return;
    document.querySelector('#previous-name').onclick = () => { index--; render(); };
    document.querySelector('#next-name').onclick = () => { index++; render(); };
    const buttons = [...view.querySelectorAll('[data-decision]')];
    for (const button of buttons) {
      button.onclick = async () => {
        buttons.forEach(control => { control.disabled = true; });
        try {
          const choice = button.dataset.decision;
          await api('/api/name-review', {id: record.id, choice});
          if (token !== round) return;
          record.decision = choice === 'accept' ? record.version
            : choice === 'keep' ? 'keep' : null;
          if (choice !== 'reset') {
            const next = records.findIndex((item, position) => position > index && pending(item));
            if (next >= 0) index = next;
          }
          render();
        } catch (error) {
          if (token === round) {
            fail(error);
            buttons.forEach(control => { control.disabled = false; });
          }
        }
      };
    }
  }
  render();
}

function leafDiagram(term) {
  const diagram = leafDiagrams[term];
  return diagram ? `<canvas class="leaf-diagram" data-leaf-diagram="${esc(term)}" width="220" height="195"
    role="img" aria-label="${esc(diagram.description)}">${esc(diagram.description)}</canvas>` : '';
}

async function botany(test) {
  const token = round;
  const plants = test ? await api('/api/deck') : [];
  if (token !== round) return;
  let index = 0;
  let correct = 0;
  const cards = [...botanyCards];
  if (test) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }
  function render() {
    const card = cards[index];
    view.innerHTML = `<div class="workspace"><h1>${test ? 'Botaniktest' : 'Botanik & Pflanzenstoffe'}</h1>
      <div class="row"><button class="secondary" data-go="${test ? 'botany' : 'botany-test'}">${test ? 'Zu den Begriffen' : 'Botaniktest starten'}</button>
      <button class="secondary" data-go="photo-test">Pflanzen anhand von Fotos üben</button></div>
      <div id="botany-card"></div></div>`;
    const panel = document.querySelector('#botany-card');
    if (!test) {
      panel.innerHTML = cards.map(([term, type, definition, , , , ref]) =>
        `<details class="folder"><summary>${esc(term)} <span>${esc(type)}</span></summary><p>${esc(definition)}</p>${leafDiagram(term)}${ref ? courseSource(ref) : ''}</details>`).join('');
      drawLeafDiagrams(panel);
      return;
    }
    if (!card) {
      panel.innerHTML = `<p role="status">${correct} von ${cards.length} Antworten richtig.</p><button class="primary" data-go="botany-test">Test wiederholen</button>`;
      return;
    }
    const [term, type, definition, question, options, answer, ref, plantId] = card;
    const photo = plants.find(plant => plant.id === plantId)?.photo;
    panel.innerHTML = `<p>Frage ${index + 1} von ${cards.length} · ${esc(type)}</p><h2>${esc(question)}</h2>
      ${leafDiagram(term)}${photo ? `<img class="test-plant-image" src="${esc(photo.image)}" alt="Pflanzenfoto zur Botanikfrage">` : ''}
      <div class="choices">${options.map((option, n) => `<button data-option="${n}">${esc(option)}</button>`).join('')}</div>
      <div id="botany-feedback" aria-live="polite"></div>`;
    drawLeafDiagrams(panel);
    const buttons = [...panel.querySelectorAll('[data-option]')];
    for (const button of buttons) {
      button.onclick = () => {
        const right = Number(button.dataset.option) === answer;
        correct += Number(right);
        if (plantId) {
          recordSkill(plantId, 'features', right);
          save();
        }
        buttons.forEach(control => { control.disabled = true; });
        document.querySelector('#botany-feedback').innerHTML = `<div class="result ${right ? '' : 'wrong'}">
          <strong>${right ? 'Richtig' : 'Richtige Antwort: ' + esc(options[answer])}</strong>
          <p>${esc(definition)}</p>${ref ? courseSource(ref) : ''}${photoCredit(photo)}</div><button class="secondary review-nav" id="next-botany">Weiter →</button>`;
        document.querySelector('#next-botany').onclick = () => { index++; render(); };
      };
    }
  }
  render();
}

function library() {
  const sections = {
    'Wildkräuterausbildung': [],
    'Fachliteratur': [],
    'Ergänzungen und Rezepte': []
  };
  for (const doc of boot.documents) {
    const group = (doc.title.startsWith('03_Die ') || doc.title === 'Pflanzenliste.pdf') ? 'Wildkräuterausbildung'
      : /Köhler|Artikel Uni/.test(doc.title) ? 'Fachliteratur'
      : /Rezept|Ergänzung|Anhang|geschichte|Öhrchen/u.test(doc.title) ? 'Ergänzungen und Rezepte'
      : 'Wildkräuterausbildung';
    sections[group].push(doc);
  }
  const priority = title => /^\d{2}-\d{2}_Wildkräuterskript|Modulskript|_Skript| Skript|^Pflanzenliste/u.test(title.normalize('NFC')) ? 0 : 1;
  view.innerHTML = `<div class="workspace"><h1>Bibliothek</h1><p class="sub">${boot.documents.length} Originaldokumente</p>
    <div class="row">
      ${boot.documents.length ? '<a class="secondary" href="/api/library-package" download>Bibliothek für Neo herunterladen</a>' : ''}
      ${boot.libraryUpload && !boot.documents.length ? '<button class="primary" id="library-upload">Bibliothek auf Neo hochladen</button><input type="file" id="library-file" accept=".zip,application/zip" hidden>' : ''}
    </div>
    <p class="sub">${boot.libraryUpload && !boot.documents.length
      ? 'Wähle das ZIP-Paket aus deinem lokalen Herbarium. Es enthält Skripte, Fotos und botanische Tafeln.'
      : !boot.libraryUpload && boot.documents.length ? 'Das ZIP-Paket kannst du in der Bibliothek deiner Neo-Instanz hochladen.' : ''}</p>
    <p id="library-status" role="status"></p>
    <details class="folder" id="library-pictures"><summary>Pflanzenfotos und botanische Tafeln</summary><div id="library-picture-list"></div></details>
    ${Object.entries(sections).map(([group, docs]) => `<details class="folder"><summary>${group} <span>${docs.length} PDFs</span></summary>
    ${docs.sort((a,b) => priority(a.title)-priority(b.title) || a.title.localeCompare(b.title, 'de')).map(doc => (
      `<a class="doc" target="_blank" rel="noopener" href="/documents/${esc(doc.id)}.pdf"><span>${esc(doc.title.replace(/\.pdf$/, '').replaceAll('_', ' '))}</span><span class="pill">${esc(doc.pages)} S. ↗</span></a>`
    )).join('')}</details>`).join('')}</div>`;
  const pictures = document.querySelector('#library-pictures');
  pictures.ontoggle = async () => {
    const list = pictures.querySelector('#library-picture-list');
    if (!pictures.open || list.childElementCount) return;
    try {
      const plants = (await api('/api/deck')).filter(plant => plant.study_plate || plant.photo);
      list.innerHTML = `<label>Pflanze suchen <input type="search" placeholder="Deutsch oder Latein"></label><div class="library-gallery"></div>`;
      const search = list.querySelector('input');
      const gallery = list.querySelector('.library-gallery');
      function renderPictures() {
        const query = search.value.trim().toLocaleLowerCase('de');
        gallery.innerHTML = plants.filter(plant => `${plant.de} ${plant.latin}`.toLocaleLowerCase('de').includes(query))
          .map(plant => `<article><h3>${esc(plant.de)}</h3><p><i>${esc(plant.latin)}</i></p>
            <div class="library-thumbs">${[plant.photo, plant.study_plate].filter(Boolean).map(picture =>
              `<figure><a href="${esc(picture.image)}" target="_blank" rel="noopener">
              <img src="${esc(picture.image)}" loading="lazy" alt="${picture.source ? 'Botanische Tafel' : 'Foto'} · ${esc(plant.de)}"></a>
              <figcaption>${picture.source ? sources([picture.source]) : photoCredit(picture)}</figcaption></figure>`).join('')}</div></article>`).join('')
          || '<p>Keine passenden Bilder gefunden.</p>';
      }
      search.oninput = renderPictures;
      renderPictures();
    } catch (error) { fail(error); }
  };
  const upload = document.querySelector('#library-upload');
  if (upload) {
    const fileInput = document.querySelector('#library-file');
    const status = document.querySelector('#library-status');
    upload.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      upload.disabled = true;
      status.textContent = 'Bibliothek wird auf Neo übertragen und geprüft …';
      try {
        const response = await fetch('/api/library-upload', {
          method: 'POST',
          headers: {'Content-Type': 'application/zip', 'X-CSRF-Token': boot.csrf},
          body: file
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw Error(result.error || `Upload fehlgeschlagen (HTTP ${response.status}).`);
        boot = await api('/api/bootstrap');
        if (!status.isConnected) return;
        library();
        document.querySelector('#library-status').textContent = `${result.documents} PDFs und ${result.plants} Pflanzenkarten sind jetzt auf Neo verfügbar.`;
      } catch (error) {
        status.textContent = error.message;
        fileInput.value = '';
        upload.disabled = false;
      }
    };
  }
}
let messages=[];
function bubble(who,text,refs=[]){messages.push({who,text,refs});drawMessages()}
function drawMessages(){const el=document.querySelector('.messages');if(!el)return;el.innerHTML=messages.map(m=>`<div class="bubble ${m.who==='Du'?'user':''}"><small>${m.who}</small>${esc(m.text)}${sources(m.refs)}</div>`).join('');el.scrollTop=el.scrollHeight}
function chat(){view.innerHTML=`<div class="workspace"><span class="eyebrow">Verstehen statt auswendig lernen</span><h1>Frag dein Herbarium.</h1><p class="sub">Dein Tutor erklärt die Grundlagen aus den Skripten und fragt dich Schritt für Schritt ab. ${boot.localTutor ? 'Deine Fragen und PDF-Auszüge verarbeitet das lokale Modell auf dem Rechner, auf dem die App läuft.' : 'Der Hermes-Modus sendet passende Skriptauszüge an den in Neo eingestellten Anbieter.'}</p><div class="row"><button class="secondary" id="quiz">Frag mich zu den Grundlagen ab</button><button class="secondary" id="reset-chat">Neues Gespräch</button>${boot.neoUrl&&!boot.localTutor?`<a class="source" target="_blank" rel="noopener" href="${esc(boot.neoUrl)}">Codex in Neo verbinden ↗</a>`:''}</div><div class="chat-shell"><div class="messages" role="log" aria-live="polite"></div><form class="chat-form" id="chat-form"><input id="chat-input" aria-label="Nachricht an den Tutor" required maxlength="4000" placeholder="Zum Beispiel: Was bedeutet kreuzgegenständig?"><button class="primary" id="send">Senden ↗</button></form></div></div>`;drawMessages();if(!messages.length)document.querySelector('.messages').textContent=boot.chat?'Was möchtest du heute verstehen? Stelle eine Frage oder starte eine Abfrage.':'Der Tutor ist noch nicht mit Hermes verbunden. Die Lernmodi funktionieren unabhängig davon.';document.querySelector('#chat-form').onsubmit=e=>{e.preventDefault();sendChat(document.querySelector('#chat-input').value)};document.querySelector('#quiz').onclick=()=>sendChat('Frage mich zu den Grundlagen aus dem Einstiegsskript ab. Stelle eine Frage nach der anderen und warte auf meine Antwort.');document.querySelector('#reset-chat').onclick=async()=>{if(chatBusy)return;try{await api('/api/chat/reset',{});messages=[];chat()}catch(e){fail(e)}};setChatBusy()}
function setChatBusy(){for(const id of ['send','quiz','reset-chat']){const b=document.getElementById(id);if(b)b.disabled=chatBusy}const send=document.querySelector('#send');if(send)send.textContent=chatBusy?'Tutor denkt …':'Senden ↗'}
async function sendChat(text){if(chatBusy||!text.trim())return;chatBusy=true;setChatBusy();notice.textContent='';bubble('Du',text);const inp=document.querySelector('#chat-input');if(inp)inp.value='';try{const r=await api('/api/chat',{message:text});bubble('Tutor',r.reply,r.sources)}catch(e){fail(e)}finally{chatBusy=false;setChatBusy()}}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-mode],[data-go]');
  if (button && boot) go(button.dataset.mode || button.dataset.go).catch(fail);
});
function openLocation() {
  const links = {'#fehlende-tafeln': 'missing', '#namen-pruefen': 'names', '#pflanzenliste': 'school', '#botanik': 'botany', '#pflanzenwissen': 'quick'};
  const target = location.hash === '#bilder-pruefen' || location.hash.startsWith('#bilder-pruefen=')
    ? 'images' : links[location.hash] || 'home';
  go(target).catch(fail);
}
api('/api/bootstrap').then(data => {
  boot = data;
  window.addEventListener('hashchange', openLocation);
  openLocation();
}).catch(fail);
