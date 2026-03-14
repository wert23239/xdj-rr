/**
 * Top 100 DJ Tracks - Static curated list
 */
const TOP_100_TRACKS = [
  { title: "Levels", artist: "Avicii", bpm: 126, key: "Dm" },
  { title: "Sandstorm", artist: "Darude", bpm: 136, key: "Bm" },
  { title: "One More Time", artist: "Daft Punk", bpm: 123, key: "Bbm" },
  { title: "Strobe", artist: "deadmau5", bpm: 128, key: "Cm" },
  { title: "In Da Club", artist: "50 Cent", bpm: 90, key: "Em" },
  { title: "Titanium", artist: "David Guetta ft. Sia", bpm: 126, key: "Eb" },
  { title: "Clarity", artist: "Zedd ft. Foxes", bpm: 128, key: "G" },
  { title: "Animals", artist: "Martin Garrix", bpm: 128, key: "Cm" },
  { title: "Turn Down for What", artist: "DJ Snake & Lil Jon", bpm: 100, key: "Gm" },
  { title: "Wake Me Up", artist: "Avicii", bpm: 124, key: "Bm" },
  { title: "Lean On", artist: "Major Lazer & DJ Snake", bpm: 98, key: "Gm" },
  { title: "Scary Monsters and Nice Sprites", artist: "Skrillex", bpm: 140, key: "Cm" },
  { title: "Don't You Worry Child", artist: "Swedish House Mafia", bpm: 129, key: "G" },
  { title: "Calabria 2007", artist: "Enur ft. Natasja", bpm: 130, key: "Dm" },
  { title: "Insomnia", artist: "Faithless", bpm: 130, key: "Am" },
  { title: "Blue (Da Ba Dee)", artist: "Eiffel 65", bpm: 128, key: "Ab" },
  { title: "Everytime We Touch", artist: "Cascada", bpm: 142, key: "Eb" },
  { title: "Satisfaction", artist: "Benny Benassi", bpm: 130, key: "Fm" },
  { title: "Around the World", artist: "Daft Punk", bpm: 121, key: "Bbm" },
  { title: "Better Off Alone", artist: "Alice Deejay", bpm: 138, key: "Am" },
  { title: "Opus", artist: "Eric Prydz", bpm: 126, key: "Fm" },
  { title: "Gecko (Overdrive)", artist: "Oliver Heldens", bpm: 124, key: "Bbm" },
  { title: "Show Me Love", artist: "Robin S", bpm: 124, key: "Gm" },
  { title: "Finally", artist: "CeCe Peniston", bpm: 122, key: "F" },
  { title: "Born Slippy", artist: "Underworld", bpm: 139, key: "Am" },
  { title: "Your Love", artist: "Frankie Knuckles", bpm: 122, key: "Cm" },
  { title: "Professional Widow", artist: "Tori Amos (Armand Van Helden)", bpm: 128, key: "Gm" },
  { title: "Kernkraft 400", artist: "Zombie Nation", bpm: 140, key: "Dm" },
  { title: "Children", artist: "Robert Miles", bpm: 138, key: "Bm" },
  { title: "Lonely", artist: "Joel Corry", bpm: 124, key: "Am" },
  { title: "Cola", artist: "CamelPhat & Elderbrook", bpm: 122, key: "Am" },
  { title: "Losing It", artist: "Fisher", bpm: 126, key: "Gm" },
  { title: "Your Mind", artist: "Adam Beyer & Bart Skils", bpm: 132, key: "Am" },
  { title: "Destination Calabria", artist: "Alex Gaudino", bpm: 130, key: "Cm" },
  { title: "Pump It Up", artist: "Endor", bpm: 126, key: "Am" },
  { title: "Where Love Lives", artist: "Alison Limerick", bpm: 120, key: "Am" },
  { title: "No Stress", artist: "Laurent Wolf", bpm: 128, key: "Am" },
  { title: "Latch", artist: "Disclosure ft. Sam Smith", bpm: 122, key: "Fm" },
  { title: "Promises", artist: "Calvin Harris ft. Sam Smith", bpm: 124, key: "Fm" },
  { title: "Summer", artist: "Calvin Harris", bpm: 128, key: "A" },
  { title: "Don't Let Me Down", artist: "The Chainsmokers", bpm: 160, key: "Cm" },
  { title: "Roses", artist: "SAINt JHN (Imanbek Remix)", bpm: 122, key: "Dm" },
  { title: "Head & Heart", artist: "Joel Corry ft. MNEK", bpm: 123, key: "F" },
  { title: "Piece of Your Heart", artist: "Meduza", bpm: 124, key: "Am" },
  { title: "Paradise", artist: "Meduza ft. Dermot Kennedy", bpm: 120, key: "Bb" },
  { title: "Freed from Desire", artist: "Gala", bpm: 132, key: "Gm" },
  { title: "You've Got the Love", artist: "Florence + The Machine", bpm: 125, key: "C" },
  { title: "I Gotta Feeling", artist: "Black Eyed Peas", bpm: 128, key: "G" },
  { title: "Levels (Skrillex Remix)", artist: "Avicii", bpm: 128, key: "Dm" },
  { title: "Tremor", artist: "Dimitri Vegas & Like Mike vs. Martin Garrix", bpm: 128, key: "Am" },
  { title: "Greyhound", artist: "Swedish House Mafia", bpm: 126, key: "Bbm" },
  { title: "Antidote", artist: "Swedish House Mafia", bpm: 128, key: "Fm" },
  { title: "Save the World", artist: "Swedish House Mafia", bpm: 128, key: "Ab" },
  { title: "Pjanoo", artist: "Eric Prydz", bpm: 128, key: "Am" },
  { title: "Call On Me", artist: "Eric Prydz", bpm: 128, key: "A" },
  { title: "I Remember", artist: "deadmau5 & Kaskade", bpm: 128, key: "Fm" },
  { title: "Ghosts 'n' Stuff", artist: "deadmau5 ft. Rob Swire", bpm: 128, key: "G" },
  { title: "Spectrum", artist: "Zedd ft. Matthew Koma", bpm: 128, key: "G" },
  { title: "Language", artist: "Porter Robinson", bpm: 128, key: "F" },
  { title: "Sun & Moon", artist: "Above & Beyond", bpm: 136, key: "D" },
  { title: "Adagio for Strings", artist: "Tiësto", bpm: 138, key: "Gm" },
  { title: "In My Mind", artist: "Ivan Gough & Feenixpawl ft. Georgi Kay", bpm: 128, key: "Am" },
  { title: "Reload", artist: "Sebastian Ingrosso & Tommy Trash", bpm: 128, key: "Em" },
  { title: "Epic", artist: "Sandro Silva & Quintino", bpm: 128, key: "Em" },
  { title: "Spaceman", artist: "Hardwell", bpm: 128, key: "Em" },
  { title: "Apollo", artist: "Hardwell ft. Amba Shepherd", bpm: 128, key: "Em" },
  { title: "Tsunami", artist: "DVBBS & Borgeous", bpm: 128, key: "Bm" },
  { title: "Cannonball", artist: "Showtek & Justin Prime", bpm: 128, key: "Am" },
  { title: "Alone", artist: "Marshmello", bpm: 128, key: "F" },
  { title: "Faded", artist: "Alan Walker", bpm: 90, key: "Ebm" },
  { title: "The Nights", artist: "Avicii", bpm: 126, key: "Em" },
  { title: "Waiting for Love", artist: "Avicii", bpm: 128, key: "Eb" },
  { title: "Hey Brother", artist: "Avicii", bpm: 125, key: "G" },
  { title: "Thinking About You", artist: "Calvin Harris ft. Ayah Marar", bpm: 128, key: "A" },
  { title: "Feel So Close", artist: "Calvin Harris", bpm: 129, key: "Ab" },
  { title: "This Is What You Came For", artist: "Calvin Harris ft. Rihanna", bpm: 124, key: "Gm" },
  { title: "How Deep Is Your Love", artist: "Calvin Harris & Disciples", bpm: 122, key: "Gm" },
  { title: "I Took a Pill in Ibiza (SeeB Remix)", artist: "Mike Posner", bpm: 102, key: "F#m" },
  { title: "Something Just Like This", artist: "The Chainsmokers & Coldplay", bpm: 103, key: "Ab" },
  { title: "Closer", artist: "The Chainsmokers ft. Halsey", bpm: 95, key: "Db" },
  { title: "Where Are Ü Now", artist: "Jack Ü ft. Justin Bieber", bpm: 140, key: "Cm" },
  { title: "Bangarang", artist: "Skrillex ft. Sirah", bpm: 110, key: "Gm" },
  { title: "Cinema", artist: "Benny Benassi ft. Gary Go (Skrillex Remix)", bpm: 140, key: "Cm" },
  { title: "Bonfire", artist: "Knife Party", bpm: 128, key: "Am" },
  { title: "Internet Friends", artist: "Knife Party", bpm: 128, key: "Cm" },
  { title: "Magenta Riddim", artist: "DJ Snake", bpm: 105, key: "Gm" },
  { title: "Get Lucky", artist: "Daft Punk ft. Pharrell", bpm: 116, key: "Bm" },
  { title: "Instant Crush", artist: "Daft Punk ft. Julian Casablancas", bpm: 105, key: "Am" },
  { title: "Technologic", artist: "Daft Punk", bpm: 122, key: "Am" },
  { title: "Robot Rock", artist: "Daft Punk", bpm: 112, key: "Am" },
  { title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", bpm: 115, key: "Dm" },
  { title: "Blinding Lights", artist: "The Weeknd", bpm: 171, key: "Fm" },
  { title: "Bad Guy", artist: "Billie Eilish", bpm: 135, key: "Gm" },
  { title: "Old Town Road", artist: "Lil Nas X", bpm: 136, key: "G" },
  { title: "Mr. Brightside", artist: "The Killers", bpm: 148, key: "Bb" },
  { title: "Sweet Nothing", artist: "Calvin Harris ft. Florence Welch", bpm: 128, key: "G" },
  { title: "Seek Bromance", artist: "Tim Berg (Avicii)", bpm: 128, key: "Em" },
  { title: "Alive", artist: "Krewella", bpm: 128, key: "Ab" },
  { title: "Five Hours", artist: "Deorro", bpm: 128, key: "Gm" },
  { title: "Deep Down", artist: "Alok x Ella Eyre x Kenny Dope", bpm: 124, key: "Cm" }
];

// ==================== TOP 100 UI ====================
let top100Visible = false;

function initTop100() {
  // Add tab buttons to browser header
  const browserHeader = document.querySelector('.browser-header');
  if (!browserHeader) return;
  browserHeader.innerHTML = `
    <div class="browser-tabs">
      <button class="browser-tab active" id="tabLibrary" onclick="showBrowserTab('library')">Library</button>
      <button class="browser-tab" id="tabTop100" onclick="showBrowserTab('top100')">Top 100</button>
    </div>
  `;
  
  // Create top 100 list container
  const trackList = document.getElementById('trackList');
  const top100List = document.createElement('div');
  top100List.id = 'top100List';
  top100List.className = 'track-list';
  top100List.style.display = 'none';
  trackList.parentNode.insertBefore(top100List, trackList.nextSibling);
  
  renderTop100();
}

function showBrowserTab(tab) {
  const trackList = document.getElementById('trackList');
  const top100List = document.getElementById('top100List');
  const searchBox = document.querySelector('.search-box');
  const sortControls = document.querySelector('.sort-controls');
  
  document.getElementById('tabLibrary').classList.toggle('active', tab === 'library');
  document.getElementById('tabTop100').classList.toggle('active', tab === 'top100');
  
  if (tab === 'top100') {
    trackList.style.display = 'none';
    top100List.style.display = '';
    if (searchBox) searchBox.style.display = 'none';
    if (sortControls) sortControls.style.display = 'none';
    top100Visible = true;
  } else {
    trackList.style.display = '';
    top100List.style.display = 'none';
    if (searchBox) searchBox.style.display = '';
    if (sortControls) sortControls.style.display = '';
    top100Visible = false;
  }
}

function renderTop100() {
  const list = document.getElementById('top100List');
  if (!list) return;
  list.innerHTML = '';
  
  TOP_100_TRACKS.forEach((track, idx) => {
    const cam = getCamelot(track.key);
    const camStr = cam ? cam.code : '';
    const div = document.createElement('div');
    div.className = 'track-item top100-item';
    div.innerHTML = `
      <span class="top100-rank">${idx + 1}</span>
      <div class="top100-info">
        <span class="top100-title">${track.title}</span>
        <span class="top100-artist">${track.artist}</span>
      </div>
      <span class="top100-meta">${track.bpm} · ${track.key}${camStr ? ' ' + camStr : ''}</span>
      <div class="load-btns" style="opacity:1">
        <button class="load-btn d1" onclick="event.stopPropagation();loadTop100ToDeck(0,${idx})">D1</button>
        <button class="load-btn d2" onclick="event.stopPropagation();loadTop100ToDeck(1,${idx})">D2</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function loadTop100ToDeck(deckId, idx) {
  const track = TOP_100_TRACKS[idx];
  if (!track) return;
  // Search library for a matching track
  const searchTerms = [track.title.toLowerCase(), track.artist.split(' ')[0].toLowerCase()];
  const match = allTracks.find(t => {
    const name = t.name.toLowerCase();
    return searchTerms.every(term => name.includes(term));
  });
  if (match) {
    loadToDeck(deckId, encodeURIComponent(match.name));
  } else {
    showError(`"${track.title}" not found in library. Download it via Discover!`);
  }
}

// Initialize after DOM ready
setTimeout(initTop100, 100);
