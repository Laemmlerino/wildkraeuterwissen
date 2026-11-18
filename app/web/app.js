'use strict';

let boot, mode = 'home', writeKind = 'latin', chatBusy = false, round = 0;
let progress = {cards: {}, seen: []};
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

const levels = ['Neu', 'In Übung', 'Sicher'];
const level = plant => Math.min(2, progress.cards[plant.id] ?? Number(progress.seen.includes(plant.id)));
const modes = {
  quick: ['Schnelllernen', 'Lateinisch aufdecken und die Karte selbst einstufen.'],
  choice: ['Pflanzen erkennen', 'Wähle den passenden lateinischen Namen.'],
  write: ['Namen schreiben', 'Übe den ganzen Namen, die Gattung oder das Art-Epitheton.']
};

function sources(items) {
  return items.filter(Boolean).map(source => (
    `<a class="source" target="_blank" rel="noopener" href="/documents/${esc(source.doc)}.pdf#page=${source.page}">${source.number ? `[${source.number}] ` : ''}${esc(source.title)} · PDF-Seite ${source.page}</a>`
  )).join('');
}

function home() {
  const specimen = boot.plants.find(plant => plant.id === 'schafgarbe');
  view.innerHTML = `<div class="hero"><div><h1>Wildkräuter<br>lernen</h1>
    <p class="sub">${boot.plants.length} Karten · ${boot.plants.filter(plant => plant.image).length} mit botanischer Tafel</p>
    <button class="primary" data-go="quick">Schnelllernen starten</button></div>
    ${specimen?.image ? `<img src="${esc(specimen.image)}" alt="Botanische Tafel der Schafgarbe">` : ''}</div>
    <div class="stats">${levels.map((name, index) => `<div><strong>${boot.plants.filter(plant => level(plant) === index).length}</strong>${name}</div>`).join('')}</div>
    <div class="cards">${Object.entries(modes).map(([id, [title, description]]) => (
      `<button class="mode-card" data-go="${id}"><h3>${title}</h3><p>${description}</p></button>`
    )).join('')}</div>`;
}

async function go(next) {
  mode = next;
  round++;
  notice.textContent = '';
  document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === (mode === 'missing' ? 'deck' : mode)));
  if (mode === 'home') return home();
  if (mode === 'chat') return chat();
  if (mode === 'library') return library();
  if (mode === 'deck' || mode === 'missing') return deck(mode === 'missing');
  return exercise();
}

let previous;
function drawCard(textOnly) {
  const allowed = boot.plants.filter(plant =>
    !(mode === 'write' && writeKind !== 'genus' && plant.group) &&
    (textOnly ? !plant.image : plant.image));
  const other = allowed.filter(plant => plant.id !== previous);
  const pool = other.length ? other : allowed;
  const weights = [4, 7, 1];
  let draw = Math.random() * pool.reduce((sum, plant) => sum + weights[level(plant)], 0);
  return pool.find(plant => (draw -= weights[level(plant)]) < 0);
}

function exercise() {
  const [title, description] = modes[mode];
  view.innerHTML = `<div class="workspace"><h1>${title}</h1><p class="sub">${description}</p>
    <div class="toolbar">
    ${mode === 'write' ? '<label>Abfrage <select id="kind"><option value="latin">Vollständiger Name</option><option value="genus">Gattung</option><option value="species">Art-Epitheton</option></select></label>' : ''}
    ${mode !== 'choice' && boot.plants.some(plant => !plant.image) ? '<label>Stapel <select id="stack"><option value="image">Mit Tafel</option><option value="text">Ohne Tafel · Deutsch als Hinweis</option></select></label>' : ''}
    <button class="secondary" id="next">Nächste Karte →</button>
    </div><div class="plant-layout"><div class="plate" id="plate"></div><div class="panel" id="task"></div></div></div>`;
  const kind = document.querySelector('#kind');
  if (kind) {
    kind.value = writeKind;
    kind.onchange = () => { writeKind = kind.value; newTask().catch(fail); };
  }
  const stack = document.querySelector('#stack');
  if (stack) {
    if (!boot.plants.some(plant => plant.image)) stack.value = 'text';
    stack.onchange = () => newTask().catch(fail);
  }
  document.querySelector('#next').onclick = () => newTask().catch(fail);
  return newTask();
}

function plantInfo(plant) {
  return `<h2><i>${esc(plant.latin)}</i></h2>
    <details><summary>Deutschen Namen anzeigen</summary><p>${esc(plant.de)}</p></details>
    ${plant.image_note ? `<p class="sub">${esc(plant.image_note)}</p>` : ''}
    ${sources([plant.course, plant.source])}`;
}

function rate(plant, correct) {
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
  if (plant.image) {
    plate.innerHTML = `<a href="${esc(plant.image)}" target="_blank" rel="noopener"><img src="${esc(plant.image)}" alt="Botanische Tafel der gesuchten Pflanze"><span>Tafel vergrössern ↗</span></a>`;
  }
  if (active === 'quick') {
    const full = await api('/api/card?id=' + encodeURIComponent(plant.id));
    if (token !== round) return;
    if (!plant.image) plate.textContent = full.de;
    task.innerHTML = '<h2>Wie heisst diese Pflanze auf Latein?</h2><button class="primary" id="reveal">Lateinischen Namen aufdecken</button>';
    document.querySelector('#reveal').onclick = () => {
      task.innerHTML = plantInfo(full) + '<div class="row"><button class="secondary" id="again">Noch üben</button><button class="primary" id="known">Gewusst</button></div>';
      document.querySelector('#again').onclick = () => { rate(full, false); newTask().catch(fail); };
      document.querySelector('#known').onclick = () => { rate(full, true); newTask().catch(fail); };
    };
    return;
  }
  const kind = active === 'choice' ? 'choice' : writeKind;
  const challenge = await api('/api/challenge?id=' + encodeURIComponent(plant.id) + (textOnly ? '&text=1' : ''));
  if (token !== round) return;
  if (challenge.prompt) plate.textContent = challenge.prompt;
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
      rate(result.plant, result.correct);
      if (token !== round) return;
      document.querySelector('#feedback').innerHTML = `<div class="result ${result.correct ? '' : 'wrong'}"><strong>${result.correct ? 'Richtig' : 'Noch üben'}</strong>${plantInfo(result.plant)}</div>`;
    } catch (error) {
      if (token === round) fail(error);
    }
  }
  task.querySelectorAll('[data-answer]').forEach(button => { button.onclick = () => answer(button.dataset.answer); });
  const form = task.querySelector('form');
  if (form) form.onsubmit = event => { event.preventDefault(); answer(form.querySelector('input').value); };
}

async function deck(missing) {
  const token = round;
  const plants = await api('/api/deck');
  if (token !== round) return;
  view.innerHTML = `<div class="workspace"><h1>Karteikasten</h1>
    <div class="toolbar"><label>Ansicht <select id="deck-filter"><option value="all">Alle Pflanzen</option><option value="missing">Ohne zugeordnete Tafel</option>
    ${levels.map((name, index) => `<option value="${index}">${name}</option>`).join('')}</select></label></div>
    <p id="deck-count" role="status"></p><div id="deck-list"></div></div>`;
  const filter = document.querySelector('#deck-filter');
  if (missing) filter.value = 'missing';
  function render() {
    const selected = plants.filter(plant => filter.value === 'all' || (filter.value === 'missing' ? !plant.image : level(plant) === Number(filter.value)));
    document.querySelector('#deck-count').textContent = `${selected.length} Karten`;
    document.querySelector('#deck-list').innerHTML = selected.map(plant => `<details class="folder"><summary><i>${esc(plant.latin)}</i> <span>${plant.image ? 'Tafel vorhanden' : 'Tafel fehlt'} · ${levels[level(plant)]}</span></summary>
      <p>${esc(plant.de)}</p>${plant.image_note ? `<p class="sub">${esc(plant.image_note)}</p>` : ''}${sources([plant.course, plant.source])}
      ${plant.image ? `<a class="source" href="${esc(plant.image)}" target="_blank" rel="noopener">Tafel öffnen ↗</a>` : ''}</details>`).join('');
  }
  filter.onchange = render;
  render();
}

function library() {
  const sections = {
    'Wildkräuterausbildung': [],
    'Fachliteratur': [],
    'Ergänzungen und Rezepte': []
  };
  for (const doc of boot.documents) {
    const group = /Köhler|Artikel Uni/.test(doc.title) ? 'Fachliteratur'
      : /Rezept|Ergänzung|Anhang|geschichte|Öhrchen/u.test(doc.title) ? 'Ergänzungen und Rezepte'
      : 'Wildkräuterausbildung';
    sections[group].push(doc);
  }
  const priority = title => /Modulskript|_Skript| Skript/u.test(title) ? 0 : 1;
  view.innerHTML = `<div class="workspace"><h1>Bibliothek</h1><p class="sub">${boot.documents.length} Originaldokumente</p>
    ${Object.entries(sections).map(([group, docs]) => `<details class="folder"><summary>${group} <span>${docs.length} PDFs</span></summary>
    ${docs.sort((a,b) => priority(a.title)-priority(b.title) || a.title.localeCompare(b.title, 'de')).map(doc => (
      `<a class="doc" target="_blank" rel="noopener" href="/documents/${esc(doc.id)}.pdf"><span>${esc(doc.title.replace(/\.pdf$/, '').replaceAll('_', ' '))}</span><span class="pill">${doc.pages} S. ↗</span></a>`
    )).join('')}</details>`).join('')}</div>`;
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
  go(location.hash === '#fehlende-tafeln' ? 'missing' : 'home').catch(fail);
}
api('/api/bootstrap').then(data => {
  boot = data;
  window.addEventListener('hashchange', openLocation);
  openLocation();
}).catch(fail);
