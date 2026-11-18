'use strict';

const herbTopics = {
  features: ['Botanische Merkmale', 'Woran erkennst du diese Pflanze?'],
  habitat: ['Vorkommen', 'Wo wächst diese Pflanze typischerweise?'],
  parts: ['Verwendete Teile', 'Welche Pflanzenteile nennt das Skript als verwendet?'],
  contents: ['Inhaltsstoffe', 'Welche Inhaltsstoffe nennt das Skript?'],
  effects: ['Beschriebene Heilwirkung', 'Welche Wirkungen schreibt das Skript der Pflanze zu?'],
  applications: ['Volksmedizinische Anwendungen', 'Welche traditionellen Anwendungsgebiete nennt das Skript?']
};

function herbCaption(plant) {
  return `<h2>${esc(plant.de)} <small><i>${esc(plant.latin)}</i></small></h2>`;
}

function herbPicture(plant) {
  const pictures = plant.pictures || [];
  return pictures.length ? `<div class="herb-pictures">${pictures.map(picture => `<figure>
    <a href="${esc(picture.image)}" target="_blank" rel="noopener" aria-label="Bild vergrössern · ${esc(picture.de)}">
      <img loading="lazy" src="${esc(picture.image)}" alt="${esc(picture.de)}">
    </a><figcaption>${pictures.length > 1 ? esc(picture.de) : ''}${photoCredit(picture.photo)}</figcaption>
  </figure>`).join('')}</div>` : '';
}

async function herbKnowledge() {
  const token = round;
  const plants = await api('/api/herb-profiles');
  if (token !== round) return;
  view.innerHTML = `<div class="workspace"><h1>Pflanzenwissen</h1>
    <p class="sub">Wirkungen und volksmedizinische Anwendungen werden als Angaben aus den Kursunterlagen wiedergegeben. Die medizinische Evidenz wurde dafür nicht bewertet.</p>
    <div class="toolbar"><label>Thema <select id="herb-topic"><option value="all">Alle Themen</option>
    ${Object.entries(herbTopics).map(([id, [label]]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
    <button class="secondary" id="herb-start" ${plants.length ? '' : 'disabled'}>Fünf Schnellfragen</button>
    <button class="primary" id="herb-test" ${plants.length ? '' : 'disabled'}>Kurspflanzen-Test</button></div>
    <label>Pflanze suchen <input id="herb-search" type="search" placeholder="Deutscher oder wissenschaftlicher Name"></label>
    <p id="herb-count" role="status"></p><div id="herb-results"></div></div>`;
  const topic = document.querySelector('#herb-topic');
  const search = document.querySelector('#herb-search');
  const results = document.querySelector('#herb-results');
  function showProfiles() {
    const query = search.value.trim().toLocaleLowerCase('de');
    const selected = plants.filter(plant => `${plant.de} ${plant.latin}`.toLocaleLowerCase('de').includes(query));
    const topics = Object.entries(herbTopics).filter(([id]) => topic.value === 'all' || topic.value === id);
    const opened = new Set([...results.querySelectorAll('details[open]')].map(item => item.dataset.profile));
    document.querySelector('#herb-count').textContent = plants.length
      ? `${selected.length} ${selected.length === 1 ? 'Steckbrief' : 'Steckbriefe'}`
      : 'Die Wildkräuterskripte wurden noch nicht importiert.';
    results.innerHTML = selected.map(plant => `<details class="folder" data-profile="${esc(plant.number)}" ${opened.has(String(plant.number)) ? 'open' : ''}>
      <summary>${esc(plant.de)} · <i>${esc(plant.latin)}</i></summary>
      <div class="herb-layout ${plant.pictures?.length ? '' : 'herb-without-image'}">
        ${herbPicture(plant)}
        <div class="herb-fields">${topics.map(([id, [label]]) => `<h3>${label}</h3>
          <p>${esc(plant.fields[id] || 'Im Steckbrief des Skripts nicht separat ausgewiesen.')}</p>`).join('')}
          ${sources([...new Set(topics.filter(([id]) => plant.fields[id]).map(([id]) => herbSource(plant, id)).map(ref => ref.page))]
            .map(page => ({...plant.source, page})))}
          <button class="secondary" data-herb-test="${esc(plant.number)}">Zu dieser Pflanze testen</button>
        </div>
      </div></details>`).join('');
  }
  search.oninput = topic.onchange = showProfiles;
  document.querySelector('#herb-start').onclick = () => herbQuiz(plants, topic.value);
  document.querySelector('#herb-test').onclick = () => herbTest(plants, topic.value);
  results.onclick = event => {
    const button = event.target.closest('[data-herb-test]');
    if (button) herbTest(plants, topic.value, plants.find(plant => plant.number === Number(button.dataset.herbTest)));
  };
  showProfiles();
}

function herbQuiz(plants, topic) {
  const options = plants.map(plant => ({
    plant,
    topics: Object.keys(herbTopics).filter(id => (topic === 'all' || topic === id) && plant.fields[id])
  })).filter(entry => entry.topics.length);
  const queue = [];
  while (queue.length < 5 && options.length) {
    const [entry] = options.splice(Math.floor(Math.random() * options.length), 1);
    queue.push({plant: entry.plant, topic: entry.topics[Math.floor(Math.random() * entry.topics.length)]});
  }
  const total = queue.length;
  let index = 0;
  function render() {
    const current = queue[index];
    view.innerHTML = `<div class="workspace"><h1>Schnellfragen</h1>
      <button class="secondary" data-go="quick">← Zu den Steckbriefen</button>
      <div id="herb-question" aria-live="polite"></div></div>`;
    const panel = document.querySelector('#herb-question');
    if (!current) {
      panel.innerHTML = total ? '<p>Runde abgeschlossen.</p>' : '<p>Für dieses Thema gibt es noch keine Fragen.</p>';
      return;
    }
    const {plant, topic: id} = current;
    panel.innerHTML = `<p>${index < total ? `Frage ${index + 1} von ${total}` : `Wiederholung ${index - total + 1} von ${queue.length - total}`} · ${herbTopics[id][0]}</p>
      <div class="herb-layout ${plant.pictures?.length ? '' : 'herb-without-image'}">${herbPicture(plant)}<div>
      ${herbCaption(plant)}<p>${herbTopics[id][1]}</p>
      <div id="herb-answer"><button class="primary" id="herb-reveal">Antwort aufdecken</button></div></div></div>`;
    document.querySelector('#herb-reveal').onclick = () => {
      document.querySelector('#herb-answer').innerHTML = `<p>${esc(plant.fields[id])}</p>${sources([herbSource(plant, id)])}
        <div class="row">${index < total ? '<button class="secondary" id="herb-again">Unsicher</button>' : ''}
        <button class="primary" id="herb-next">${index < total ? 'Gewusst' : 'Weiter'}</button></div>`;
      const again = document.querySelector('#herb-again');
      if (again) again.onclick = () => { queue.push(current); index++; render(); };
      document.querySelector('#herb-next').onclick = () => { index++; render(); };
    };
  }
  render();
}

function herbSource(plant, topic) {
  return topic === 'applications' ? plant.application_source || plant.source : plant.source;
}

function herbTest(plants, selectedTopic, singlePlant) {
  const availableTopics = plant => Object.keys(herbTopics).filter(id =>
    (selectedTopic === 'all' || id === selectedTopic) && plant.fields[id]);
  const questions = singlePlant
    ? availableTopics(singlePlant).map(topic => ({plant: singlePlant, topic}))
    : plants.flatMap(plant => {
      const topics = availableTopics(plant);
      return topics.length ? [{plant, topic: topics[Math.floor(Math.random() * topics.length)]}] : [];
    });
  if (!singlePlant) shuffleHerbItems(questions);
  let index = 0;
  let correct = 0;
  const mistakes = [];
  view.innerHTML = `<div class="workspace"><h1>${singlePlant ? 'Pflanzentest' : 'Kurspflanzen-Test'}</h1>
    <button class="secondary" data-go="quick">← Zu den Steckbriefen</button><div id="herb-test-task"></div></div>`;
  const panel = document.querySelector('#herb-test-task');
  function showQuestion() {
    const entry = questions[index];
    if (!entry) {
      panel.innerHTML = questions.length ? `<h2>${correct} von ${questions.length} richtig</h2>
        ${mistakes.length ? `<details class="folder"><summary>Fehler ansehen</summary>
        ${mistakes.map(({plant, topic}) => `<p><strong>${esc(plant.de)} · ${herbTopics[topic][0]}</strong><br>
        ${esc(plant.fields[topic])}</p>${sources([herbSource(plant, topic)])}`).join('')}</details>` : ''}`
        : '<p>Für diese Pflanze ist zu diesem Thema keine Testfrage verfügbar.</p>';
      return;
    }
    const {plant, topic} = entry;
    const answer = plant.fields[topic];
    const alternatives = [...new Set(plants.filter(other => !other.plant_ids.some(id => plant.plant_ids.includes(id)))
      .map(other => other.fields[topic]).filter(value => value && value !== answer))];
    shuffleHerbItems(alternatives);
    const options = shuffleHerbItems([answer, ...alternatives.slice(0, 2)]);
    panel.innerHTML = `<p>Frage ${index + 1} von ${questions.length} · ${herbTopics[topic][0]}</p>
      <div class="herb-layout ${plant.pictures?.length ? '' : 'herb-without-image'}">${herbPicture(plant)}<div>
      ${herbCaption(plant)}<p>Welche Angabe steht zu dieser Pflanze im Skript?</p>
      <div class="choices herb-test-options">${options.map((option, i) => `<button data-herb-option="${i}">${esc(option)}</button>`).join('')}</div>
      <div id="herb-test-feedback" aria-live="polite"></div></div></div>`;
    const buttons = [...panel.querySelectorAll('[data-herb-option]')];
    buttons.forEach((button, i) => {
      button.onclick = () => {
        const right = options[i] === answer;
        correct += Number(right);
        if (!right) mistakes.push(entry);
        buttons.forEach(control => { control.disabled = true; });
        document.querySelector('#herb-test-feedback').innerHTML = `<div class="result ${right ? '' : 'wrong'}">
          <strong>${right ? 'Richtig' : 'Richtige Antwort'}</strong><p>${esc(answer)}</p>
          ${sources([herbSource(plant, topic)])}</div>
          <button class="primary herb-next" id="herb-test-next">${index + 1 === questions.length ? 'Ergebnis anzeigen' : 'Weiter'}</button>`;
        const next = document.querySelector('#herb-test-next');
        next.onclick = () => { index++; showQuestion(); };
        next.focus();
      };
    });
  }
  showQuestion();
}

function shuffleHerbItems(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
