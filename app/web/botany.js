'use strict';

const berryScript = '08_1_';
const botanyScript = '02_Botanik 1_Skript';
const flowerScript = '02_Botanik 2_Skript';
const fruitScript = '02_Botanik 3_Skript';
const substanceScript = '05_Sekunda';
const profiles = {
  'hippophae-rhamnoides': {
    leaf: 'Schmale, lanzettliche Blätter mit silbriger Unterseite.',
    features: 'Dorniger Strauch. Die orangen Früchte sitzen dicht entlang der Zweige.',
    contents: 'Die Früchte enthalten Vitamin C. In den Ölen kommen Tocopherole (Vitamin E) vor.',
    comparison: 'Beim Feuerdorn stehen die Früchte in Büscheln. Seine Blätter sind dicker und glänzen.',
    source: [berryScript, 4]
  },
  'berberis-vulgaris': {
    leaf: 'Kleine, elliptische Blätter in Büscheln an den Kurztrieben.',
    features: 'Häufig dreiteilige Dornen, hängende Trauben aus gelben Blüten und längliche rote Beeren.',
    contents: 'Die Früchte enthalten Vitamin C und Carotinoide.',
    comparison: 'Die Mahonie hat ledrige, gefiederte Blätter und dunkle Früchte.',
    source: [berryScript, 6]
  },
  holunder: {
    leaf: 'Gegenständig und unpaarig gefiedert, meist mit fünf bis sieben gesägten Fiederblättchen.',
    features: 'Verholzender Strauch mit flachen, weissen Blütenständen. Reife Fruchtstände hängen nach unten.',
    contents: 'Das Skript nennt unter anderem Vitamin C und Beta-Carotin.',
    comparison: 'Der Rote Holunder hat aufrechte rote Fruchtstände. Der Zwergholunder verholzt nicht.',
    source: [berryScript, 8]
  },
  'rosa-canina': {
    leaf: 'Unpaarig gefiedert, mit gesägten, elliptischen Fiederblättchen.',
    features: 'Bogig wachsende Zweige, gebogene Stacheln und eiförmige, rote Hagebutten.',
    contents: 'Die Fruchtschale enthält Vitamin C und verschiedene Carotinoide.',
    comparison: 'Weitere Wildrosen haben ähnliche Hagebutten. Fruchtmerkmale allein genügen häufig nicht zur exakten Artbestimmung.',
    source: [berryScript, 15]
  },
  'sorbus-aucuparia': {
    leaf: 'Unpaarig gefiedert mit neun bis siebzehn länglichen Fiederblättchen.',
    features: 'Kleiner Baum oder Strauch mit weissen Blütenständen und orangeroten Früchten.',
    contents: 'Die Früchte enthalten Vitamin C und Beta-Carotin.',
    source: [berryScript, 20]
  },
  'vaccinium-myrtillus': {
    leaf: 'Kleine, elliptische Blätter mit fein gesägtem Rand.',
    features: 'Niedriger Strauch mit grünen kantigen Stängeln und dunkelblauen Früchten.',
    contents: 'Das Skript nennt Vitamin C und Vitamin E.',
    comparison: 'Die Rauschbeere hat im Gegensatz zur Heidelbeere helles Fruchtfleisch.',
    source: [berryScript, 24]
  }
};

const leafDiagrams = {
  'Gegenständig': {
    leaves: [[110, 65, -1], [110, 65, 1], [110, 115, -1], [110, 115, 1]],
    description: 'Zwei Paare grüner Blätter sitzen an einem senkrechten Stängel. In jedem Paar stehen die Blätter auf gleicher Höhe.'
  },
  'Wechselständig': {
    leaves: [[110, 48, -1], [110, 82, 1], [110, 116, -1], [110, 150, 1]],
    description: 'Vier Blätter sitzen in unterschiedlicher Höhe am Stängel, von oben nach unten abwechselnd links und rechts.'
  },
  'Unpaarig gefiedert': {
    leaves: [[110, 66, -1], [110, 66, 1], [110, 112, -1], [110, 112, 1], [110, 66, 0]],
    description: 'Eine Blattachse trägt je zwei seitliche Blättchen links und rechts und ein einzelnes Blättchen an der Spitze.'
  },
  'Paarig gefiedert': {
    leaves: [[110, 66, -1], [110, 66, 1], [110, 112, -1], [110, 112, 1]],
    description: 'Eine Blattachse trägt vier seitliche Blättchen. Die Achse endet über dem letzten Paar ohne einzelnes Endblättchen.'
  }
};

function drawLeafDiagrams(root) {
  for (const canvas of root.querySelectorAll('canvas[data-leaf-diagram]')) {
    const {leaves} = leafDiagrams[canvas.dataset.leafDiagram];
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#45593a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(110, leaves.some(leaf => leaf[2] === 0) ? 66 : 34);
    ctx.lineTo(110, 178);
    ctx.stroke();
    ctx.fillStyle = '#37462d';
    ctx.font = '13px sans-serif';
    ctx.fillText(canvas.dataset.leafDiagram.includes('gefiedert') ? 'Blattstiel' : 'Stängel', 122, 177);

    for (const [x, y, side] of leaves) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(side === 0 ? -Math.PI / 2 : side < 0 ? Math.PI + .35 : -.35);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(24, -20, 62, 0);
      ctx.quadraticCurveTo(24, 20, 0, 0);
      ctx.fillStyle = '#719a5b';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(53, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}

const botanyCards = [
  ['Gegenständig', 'Blattstellung', 'Zwei Blätter sitzen auf gleicher Höhe einander gegenüber.',
    'Welche Blattstellung zeigt die Zeichnung?', ['Quirlig', 'Wechselständig', 'Gegenständig'], 2, [berryScript, 8]],
  ['Unpaarig gefiedert', 'Blatttyp', 'Seitliche Fiederblättchen stehen entlang einer Achse, an der Spitze sitzt ein einzelnes Endblättchen.',
    'Welchen Blatttyp zeigt die Zeichnung?', ['Unpaarig gefiedert', 'Paarig gefiedert', 'Einfach'], 0, [berryScript, 8]],
  ['Wechselständig', 'Blattstellung', 'An jedem Stängelknoten sitzt ein Blatt. Das nächste Blatt steht versetzt darüber.',
    'Welche Blattstellung zeigt die Zeichnung?', ['Gegenständig', 'Wechselständig', 'Quirlig'], 1, [botanyScript, 5]],
  ['Paarig gefiedert', 'Blatttyp', 'Das zusammengesetzte Blatt trägt seitliche Paare von Fiederblättchen. Die Blattachse trägt kein einzelnes Endblättchen.',
    'Welchen Blatttyp zeigt die Zeichnung?', ['Paarig gefiedert', 'Unpaarig gefiedert', 'Einfach'], 0, null],
  ['Lanzettlich', 'Blattform', 'Das Blatt ist länglich und schmal. Es verjüngt sich gegen beide Enden.',
    'Welche Form beschreiben die schmalen, spitz zulaufenden Blätter des Sanddorns?', ['Rundlich', 'Lanzettlich', 'Herzförmig'], 1, [berryScript, 4], 'hippophae-rhamnoides'],
  ['Gesägt', 'Blattrand', 'Der Rand trägt zugespitzte Zähne, ähnlich den Zähnen einer Säge.',
    'Welchen Blattrand hat die Heidelbeere laut Skript?', ['Fein gesägt', 'Tief gelappt', 'Glatt'], 0, [berryScript, 24], 'vaccinium-myrtillus'],
  ['Stacheln und Dornen', 'Spross', 'Stacheln entstehen an der Oberfläche. Dornen sind umgebildete Organe und am Ansatz fest verwachsen.',
    'Welche Struktur sitzt an den Zweigen der Hundsrose?', ['Dornen', 'Stacheln', 'Ranken'], 1, ['02_Botanik 2_Skript', 2], 'rosa-canina'],
  ['Lippenblütler', 'Pflanzenfamilie', 'Typisch sind Lippenblüten, gegenständige Blätter und häufig vierkantige Stängel.',
    'Welche Familie hat typischerweise Lippenblüten, gegenständige Blätter und häufig vierkantige Stängel?', ['Rosaceae', 'Fagaceae', 'Lamiaceae'], 2, [botanyScript, 4]],
  ['Schleimstoffe', 'Pflanzenstoffe', 'Schleimstoffe bestehen aus langen Zuckerketten (Polysacchariden). Mit Wasser quellen sie und bilden eine gelartige Schicht. In Pflanzen übernehmen sie Schutzfunktionen, etwa indem sie Wasser binden.',
    'Zu welcher Stoffgruppe gehören Schleimstoffe biochemisch?', ['Polysaccharide', 'Ätherische Öle', 'Proteine'], 0, [substanceScript, 10]],
  ['Primäre Pflanzenstoffe', 'Pflanzenstoffe', 'Primäre Pflanzenstoffe erfüllen Grundfunktionen im Stoffwechsel. Stärke speichert Energie, während Cellulose den Zellwänden Festigkeit gibt.',
    'Welcher Stoff zählt zu den primären Pflanzenstoffen?', ['Stärke', 'Ein ätherisches Öl', 'Ein Alkaloid'], 0, [substanceScript, 3]],
  ['Inulin', 'Pflanzenstoffe', 'Inulin besteht überwiegend aus verknüpften Fruktosebausteinen. Pflanzen wie die Wegwarte speichern damit Kohlenhydrate.',
    'Welche Funktion hat Inulin in der Pflanze?', ['Kohlenhydrate speichern', 'Licht aufnehmen', 'Wasser verdunsten'], 0, [substanceScript, 8]],
  ['Terpene und ätherische Öle', 'Pflanzenstoffe', 'Viele Terpene sind Bestandteile ätherischer Öle. Kleine Terpene sind oft flüchtig und tragen zum Duft bei. Ein ätherisches Öl ist ein Gemisch mehrerer Stoffe.',
    'Welche Stoffgruppe trägt häufig zum Duft ätherischer Öle bei?', ['Cellulose', 'Terpene', 'Stärke'], 1, [substanceScript, 18]],
  ['Flavonoide', 'Pflanzenstoffe', 'Flavonoide gehören zu den Polyphenolen. Einige färben Blüten oder Früchte, andere schützen Pflanzengewebe vor UV-Strahlung. Anthocyane sind eine Gruppe der Flavonoide.',
    'Zu welcher Stoffgruppe gehören Flavonoide?', ['Polyphenole', 'Mineralstoffe', 'Eiweisse'], 0, [substanceScript, 28]],
  ['Gerbstoffe', 'Pflanzenstoffe', 'Gerbstoffe, auch Tannine genannt, können sich an Proteine binden. Der trockene, zusammenziehende Eindruck von herbem Tee ist ein Beispiel für ihre Wirkung auf Speichelproteine.',
    'Wie heissen die Stoffe, die in herbem Tee dieses trockene Mundgefühl auslösen können?', ['Gerbstoffe', 'Schleimstoffe', 'Mineralsalze'], 0, [substanceScript, 30]],
  ['Senfölglykoside', 'Pflanzenstoffe', 'Diese schwefelhaltigen Stoffe kommen besonders bei Kreuzblütlern vor. Beim Zerreiben des Gewebes können Enzyme daraus scharf schmeckende Senföle bilden, etwa bei Ackersenf.',
    'Wann können aus Senfölglykosiden scharf schmeckende Senföle entstehen?', ['Beim Zerreiben des Gewebes', 'Beim Reifen zu Stärke', 'Beim Aufnehmen von Licht'], 0, [substanceScript, 33]],
  ['Blütenkörbchen', 'Pflanzenfamilie', 'Bei Korbblütlern sitzen viele kleine Einzelblüten dicht auf einem gemeinsamen Blütenboden. Beim Gänseblümchen bilden weisse Zungenblüten den Rand und gelbe Röhrenblüten die Mitte.',
    'Was sind die weissen Zungen am Rand eines Gänseblümchen-Körbchens?', ['Kelchblätter', 'Einzelne Zungenblüten', 'Samenanlagen'], 1, [botanyScript, 5]],
  ['Kreuzblütler', 'Pflanzenfamilie', 'Vier kreuzförmig angeordnete Kronblätter sind typisch für Kreuzblütler. Viele Arten tragen vier längere und zwei kürzere Staubblätter.',
    'Welche Familie passt zu vier kreuzförmigen Kronblättern und sechs Staubblättern, von denen zwei kürzer sind?', ['Apiaceae', 'Asteraceae', 'Brassicaceae'], 2, [botanyScript, 7]],
  ['Doppeldolde', 'Blütenstand', 'Bei einer Dolde entspringen die Blütenstiele etwa am selben Punkt. Bei einer Doppeldolde trägt jeder Hauptstrahl eine kleine Dolde.',
    'Die Hauptstrahlen eines Blütenstands enden jeweils in einer kleinen Dolde. Wie heisst dieser Blütenstand?', ['Doppeldolde', 'Traube', 'Ähre'], 0, [botanyScript, 9]],
  ['Bestäubung', 'Blüte', 'Bei der Bestäubung gelangt Pollen auf die Narbe. Für die Befruchtung muss anschliessend eine männliche Keimzelle über den Pollenschlauch zur Samenanlage gelangen und mit der Eizelle verschmelzen.',
    'Ein Insekt überträgt Pollen auf die Narbe einer Blüte. Welcher Vorgang hat damit stattgefunden?', ['Samenreife', 'Bestäubung', 'Befruchtung'], 1, [flowerScript, 3]],
  ['Perigon', 'Blüte', 'Als Perigon bezeichnet man eine Blütenhülle, deren Blätter sich nicht in Kelch- und Kronblätter unterscheiden lassen.',
    'Wie heisst eine Blütenhülle ohne Unterscheidung in Kelch und Krone?', ['Blütenboden', 'Nektarium', 'Perigon'], 2, [flowerScript, 4]],
  ['Fruchtknoten', 'Blüte', 'Der Fruchtknoten ist der Teil des Stempels, in dem die Samenanlagen sitzen. Bei der Fruchtentwicklung bildet seine Wand die Fruchtwand.',
    'In welchem Teil der Blüte liegen die Samenanlagen?', ['Fruchtknoten', 'Staubbeutel', 'Narbe'], 0, [fruitScript, 7]],
  ['Öffnungsfrucht', 'Frucht', 'Öffnungsfrüchte geben ihre Samen bei der Reife frei. Die reife Erbsenhülse öffnet sich beispielsweise entlang ihrer beiden Nähte.',
    'Warum zählt die Erbsenhülse zu den Öffnungsfrüchten?', ['Sie besitzt einen Steinkern', 'Sie springt bei der Reife auf und gibt die Samen frei', 'Die Samen bleiben dauerhaft in der Fruchtwand eingeschlossen'], 1, [fruitScript, 8]],
  ['Sammelnussfrucht', 'Frucht', 'Die kleinen Nüsschen auf der Erdbeere entstehen aus mehreren Fruchtknoten einer einzigen Blüte. Der rote, fleischige Teil entsteht aus dem Blütenboden.',
    'Was sind die kleinen Punkte auf der Oberfläche einer Erdbeere botanisch?', ['Kleine Nussfrüchte', 'Sporen', 'Nektardrüsen'], 0, [fruitScript, 10]]
];
