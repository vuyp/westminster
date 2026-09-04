// ---------------------------------------------------------------------------
// hud.js — start screen, captions for announcements, interaction prompts,
// location label, help overlay, station map, simple settings.
// ---------------------------------------------------------------------------
export class HUD {
  constructor(root = document.body) {
    this.root = root;
    root.insertAdjacentHTML('beforeend', `
      <div id="hud">
        <div id="hud-location"><span class="roundel"></span><span id="hud-location-text">Westminster</span></div>
        <div id="hud-clock"></div>
        <div id="hud-prompt" hidden></div>
        <div id="hud-caption" hidden><span class="who"></span><span class="text"></span></div>
        <div id="hud-notice" hidden></div>
        <div id="hud-crosshair"></div>
        <div id="hud-help"><b>WASD</b> walk · <b>Shift</b> run · <b>Mouse</b> look · <b>E</b> interact · <b>M</b> map · <b>H</b> help · <b>Esc</b> pause</div>
        <div id="hud-map" hidden></div>
      </div>
      <div id="start">
        <div class="panel">
          <div class="roundel big"><div class="bar">WESTMINSTER</div></div>
          <h1>Westminster</h1>
          <p class="sub">Jubilee · District · Circle</p>
          <p class="desc">You are a passenger on Bridge Street, beneath Portcullis House, with Big Ben across the road. Go down into the ticket hall, touch in at the gates, ride the escalators into the Jubilee line box and board a train.</p>
          <button id="start-btn">Click to enter the station</button>
          <p class="hint">Headphones recommended — everything you hear is synthesised live. <span id="start-status"></span></p>
          <p class="controls"><b>WASD</b> walk · <b>Shift</b> run · <b>Mouse</b> look · <b>E</b> interact (gates, seats) · <b>M</b> map · <b>C</b> crouch</p>
        </div>
      </div>`);
    this.el = {
      location: root.querySelector('#hud-location-text'), prompt: root.querySelector('#hud-prompt'), caption: root.querySelector('#hud-caption'), notice: root.querySelector('#hud-notice'),
      start: root.querySelector('#start'), startBtn: root.querySelector('#start-btn'), status: root.querySelector('#start-status'), help: root.querySelector('#hud-help'), map: root.querySelector('#hud-map'), clock: root.querySelector('#hud-clock'),
    };
    this._captionTimer = null; this._noticeTimer = null; this.paused = true;
    window.addEventListener('keydown', e => { if (e.code === 'KeyH') this.el.help.classList.toggle('hidden'); if (e.code === 'KeyM') this.toggleMap(); });
    setTimeout(() => this.el.help.classList.add('hidden'), 12000);
  }

  onStart(fn) { this.el.startBtn.addEventListener('click', () => { fn(); }); }
  status(text) { this.el.status.textContent = text; }
  hideStart() { this.el.start.classList.add('hidden'); this.paused = false; }
  setPaused(p) { this.paused = p; this.el.start.classList.toggle('hidden', !p); if (p) { this.el.startBtn.textContent = 'Click to continue'; } }

  location(text) { this.el.location.textContent = text; }
  prompt(text) { if (text) { this.el.prompt.textContent = text; this.el.prompt.hidden = false; } else this.el.prompt.hidden = true; }
  caption(text, seconds = 4, who = 'station') {
    const c = this.el.caption; c.querySelector('.text').textContent = text; c.querySelector('.who').textContent = who === 'train' ? '🚇 ' : who === 'pa' || who === 'station' ? '📢 ' : ''; c.hidden = false; c.classList.remove('fade');
    clearTimeout(this._captionTimer); this._captionTimer = setTimeout(() => { c.classList.add('fade'); setTimeout(() => { c.hidden = true; }, 500); }, seconds * 1000);
  }
  notice(text, seconds = 3) { const n = this.el.notice; n.textContent = text; n.hidden = false; clearTimeout(this._noticeTimer); this._noticeTimer = setTimeout(() => { n.hidden = true; }, seconds * 1000); }
  clock(text) { this.el.clock.textContent = text; }
  toggleMap() { this.el.map.hidden = !this.el.map.hidden; }
  setMapHTML(html) { this.el.map.innerHTML = html; }
}
