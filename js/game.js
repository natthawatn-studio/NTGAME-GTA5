// Page of the browser build. The engine runs in a dedicated worker (loader.js: its "main thread", where the static constructors and
// main() run and which may block); the page only owns the canvas, which is transferred to that worker and on to the GPU worker.
// Query string: ?args=-flag1,-flag2=value (added to the engine command line), ?shot=N (screenshot of every N-th present to the dev server).
function reportAudioPressure(detail){try{const c=new BroadcastChannel('game-progress');c.postMessage({audioPressure:detail});c.close();}catch(_){}}
const q = GTALaunchUrl.expand(location.search);let audioPressureLayout=0;
// Player build: developer launch switches are unavailable.
const playerKeys=new Set(["audiodiag","mode", "map", "custommap", "saveprofile", "fps", "scale", "low", "res", "language", "mousegain", "controller", "granular", "safeuploads", "fxaa", "shadows", "cores", "bcfallback", "bghistory", "pipelast", "cbtemplate", "cbsegments", "usermod", "modmodel", "modpackages", "modpool", "modshare", "modtraffic", "modstory", "trainer", "poseproof", "intro", "texturequality", "reflectionquality", "waterquality", "particlequality", "grassquality", "anisotropic", "lodscale", "pedlod", "vehiclelod", "density", "pedvariety", "vehiclevariety", "postfx", "motionblur", "dof", "shadowquality", "softshadows", "ssao", "drawdistance", "fogvolumes", "particleshadows", "longshadows", "flightstreaming", "distantlights"]);for(const key of [...q.keys()])if(!playerKeys.has(key))q.delete(key);if(q.get("poseproof")!=="4")q.delete("poseproof");
const pageActions = GTAGameUI.mount();
const loadingMusic = GTALoadingMusic.mount(document.getElementById('loading'));
let introFinished = q.get('intro') === '0', startTitle = () => {};
const afterIntro = () => { introFinished = true; startTitle(); loadingMusic.start(); };
const loadingIntro = GTALoadingIntro.mount(document.getElementById('loading'), !introFinished, afterIntro, loadingMusic);
if (q.get('intro') === '0') loadingMusic.start();
const fivemMetadataProbe=q.get('fivem')==='metadata'&&q.get('mode')==='sandbox'&&q.get('poseproof')==='3'&&!q.has('usermod')&&!q.has('carmod')&&q.get('multiplayer')!=='1';
const fivemVehicleProbe=q.get('fivem')==='vehicle'&&q.get('mode')==='sandbox'&&q.get('poseproof')==='3'&&!q.has('usermod')&&!q.has('carmod')&&q.get('multiplayer')==='1';
const fivemPlayerProbe=q.get('fivem')==='player'&&q.get('mode')==='sandbox'&&q.get('poseproof')==='3'&&!q.has('usermod')&&!q.has('carmod')&&q.get('multiplayer')==='1';
// Save storage is chosen before engine startup; undecided launches use the launcher.
if (!['story','sandbox'].includes(q.get('mode'))) {
  location.replace('launcher.html'+location.search+location.hash);
  await new Promise(()=>{});
}
const userdataScope = GTAUserdataPersistence.scope(q.get('mode'));
GTAGameUI.button({id:'return-launcher',label:'Return to launcher',onClick:()=>{location.href='launcher.html';}});
const fpsBenchmarkToken=q.get('fpsdiag')==='1'&&q.get('fpsbench')==='1'&&(!q.has('fps')||q.get('fps')==='60')&&!q.has('fpsdebug')&&!q.has('nativehz')&&q.get('mode')==='sandbox'&&!q.has('poseproof')&&!q.has('usermod')&&!q.has('carmod')&&!q.has('multiplayer')?crypto.randomUUID():null;
const fpsWorldReady=()=>{const loading=document.getElementById('loading');return !loading||loading.classList.contains('done');};
let controllerBridge=null;
const touchControls=GTATouchControls.mount({release:()=>controllerBridge?.release()});
const touchToolbar = document.getElementById('touch-toolbar');
if (touchToolbar) pageActions.append(touchToolbar);
// Retired high-rate and uncapped URLs use the validated default.
if (!['24','30','60'].includes(q.get('fps'))) q.set('fps','60');
// URL prefix of everything this page loads (loader, workers, engine, shaders, title art): empty on the dev server; on the PHP host (phase3/host/index.php) it puts the page's own
// text `/b/8b0b5899ed` through str_replace to `/b/<build id>`, so those files are cached for ever under URLs that change when the build does.
const BASE = '/b/8b0b5899ed'.charAt(0) === '_' ? '' : '/b/8b0b5899ed';
// ?log=1: the page, the engine threads and the workers send their log lines to the dev server (browser.log, browser_<ip>.log); off by default: the player's upload
// bandwidth and this thread's time. The loading screen's own log line and the browser console do not depend on it.
const speechProbe=q.get('speechproof')==='1'&&q.get('mode')==='sandbox'&&q.get('multiplayer')!=='1'&&q.get('poseproof')==='2'&&!q.has('usermod')&&!q.has('carmod');
const trainer=q.get('trainer')==='1'&&['story','sandbox'].includes(q.get('mode'))&&q.get('multiplayer')!=='1'&&q.get('poseproof')==='4';
const storyModTraffic=q.get('modstory')==='1'&&q.get('modtraffic')==='1'&&q.has('usermod')&&q.get('mode')==='story'&&q.get('multiplayer')!=='1'&&q.get('poseproof')==='4';
const storyModSession=q.get('mode')==='story'&&(trainer||storyModTraffic)&&q.get('multiplayer')!=='1'&&q.get('poseproof')==='4';
const modTraffic=q.get('modtraffic')==='1'&&q.has('usermod')&&(q.get('mode')==='sandbox'||storyModTraffic)&&q.get('multiplayer')!=='1'&&q.get('poseproof')==='4';
const remoteLog = q.get('log') === '1';
const clientLog=q.get('clientlog')==='1';
const clientLogs=GTAClientLogs.mount({full:remoteLog||clientLog});
const postLog = (text) => { clientLogs.add('page',text); if (remoteLog) fetch('/log', { method: 'POST', body: text }).catch(() => {}); };
if(q.get('lagdiag')==='1')GTALagDiagnostics.mount(postLog);
// Crash reports from the engine threads (prejs.js __crash, loader.js onAbort/onExit): shown in the bottom-left line with a hint when it looks like memory, and posted to the host's log
// only with ?log=1 (at most 3 per page, ~10 KB each; they were always posted until 2026-10-06, when 10,000 visitors a day made 5,500 posts and a log file per visitor). A normal exit does not report.
{
	let posted = 0;
	new BroadcastChannel('game-crash').onmessage = (ev) => {
		const m = ev.data;
		const memory = /memory|OOM|Aborted\(|RangeError|grow/i.test(m.text);
		const dev = ' deviceMemory ' + (navigator.deviceMemory || '?') + ' GB, cores ' + navigator.hardwareConcurrency;
		if (remoteLog && posted++ < 3) fetch('/log', { method: 'POST', body: '[page] CRASH (' + m.kind + ', ' + m.thread + ' thread, wasm heap ' + m.heap + ' MB,' + dev + ', ' + location.search + '): ' + m.text + '\n' + (m.tail || []).slice(-40).map(line => String(line).slice(0, 1000)).join('\n') + '\n' }).catch(() => {});
		const el = document.getElementById('hud');
		if (el) { el.dataset.crashDetails = String(m.text); el.textContent = 'The game stopped (' + m.kind + '): ' + m.text.split('\n')[0].slice(0, 200) + (memory ? ' - this looks like a lack of memory: close other tabs and reload.' : ' - reload the page.'); el.style.color = '#f96'; }
	};
}
// ---- title screen: the game's own loading screen, LOADINGSCREEN_STARTUP (scaleform_frontend.rpf), redone in HTML ----------------------------------------
// Ported from its ActionScript (com.rockstargames.gtav.loadingScreens.LOADINGSCREEN_STARTUP, decompiled with JPEXS FFDec) as it plays while the game loads
// (CTX_GAMELOAD). On the 1280x720 stage (scaled to the window, black outside 16:9): the built-in beach screen and the 17 loadingscreen<N> art screens in one of
// the movie's six random orders; each is a background panel tilted in 3D (Scaleform's camera: 55 degree field of view around the stage centre, pivot at the
// layer's top-left; Scaleform's +Z points away from the viewer, CSS's towards it, hence the negated angles) and foreground cut-outs. Every 14 s the next screen
// slides in (0.85 s, cubic in-out, from alternating sides) and the old one out; a screen's layers tween linearly to their end values over 42 s. The GTA V logo
// sits bottom left and the instructional button bar bottom right at the boot-time safe zone (7.5 %, CHudTools::GetFakeLoadingScreenSafeZone).
// Art, logo, spinner and the font ($Font2 = Chalet London 1960) are the game's (phase3/make_title.py, served at /b/8b0b5899ed/title/).
let stopTitle = () => {};
{
	const stage = document.getElementById('ls-stage'), holder = document.getElementById('ls-screens');
	const fit = () => {
		const s = Math.min(innerWidth / 1280, innerHeight / 720);
		stage.style.transform = 'translate(' + (innerWidth - 1280 * s) / 2 + 'px,' + (innerHeight - 720 * s) / 2 + 'px) scale(' + s + ')';
	};
	fit();
	addEventListener('resize', fit);
	const L = (tex, w, h, x, y, yr, to) => ({ tex, w, h, x, y, yr, to });
	const BG = (n, yr, to, x = 98) => L('ls' + n + '_background', 1024, 512, x, 95, yr, to);
	const FG = (n, name, w, h, x, y, toX, yr = 0) => L('ls' + n + '_' + name, w, h, x, y, yr, { x: toX });
	const SCREENS = [		// the movie's loadingScreens array: setup (size, position, _yrotation) and tweenTo of every layer, bottom to top
		[L('beach_bg.stock', 1024, 512, 98, 95, 20, { yr: -6, xr: 5 }), L('beach_fg.stock', 343, 629, 480, 95, 0, { x: 720 })],
		null,		// loadingscreen_builtin1 (Frisk): its symbols are not in this build's movie, and no order uses it
		[BG(0, 7, { yr: -7 }), FG(0, 'foreground', 299, 599, 360, 140, 560, 7)],
		[BG(1, 6, { yr: -12 }), FG(1, 'foreground', 503, 206, 300, 465, 480), FG(1, 'foreground_franklin', 368, 588, 440, 140, 745)],
		[BG(2, 7, { yr: -5, xr: 5 }), FG(2, 'foreground', 311, 558, 745, 200, 450), FG(2, 'foreground_chop', 320, 512, 640, 260, 310)],
		[BG(3, 12, { yr: -4 }, 110), FG(3, 'foreground', 412, 609, 440, 120, 730)],		// its foreground_car is an "isInFla" layer missing from the movie: the game shows no car
		[BG(4, 7, { yr: -4, xr: 5 }), FG(4, 'foreground', 251, 643, 400, 85, 250)],
		[BG(5, 7, { yr: -6 }), FG(5, 'foreground', 389, 640, 450, 95, 700)],
		[BG(6, 7, { yr: 0, xr: 5 }), FG(6, 'foreground', 367, 603, 410, 115, 800)],
		[BG(7, 6, { yr: -6, xr: 5 }), FG(7, 'foreground', 311, 625, 860, 95, 520)],
		[BG(8, 7, { yr: -5, xr: 5 }), FG(8, 'foreground', 492, 497, 400, 190, 660)],
		[BG(9, 7, { yr: -3, xr: 5 }), FG(9, 'foreground', 331, 675, 220, 50, 140)],
		[BG(10, 6, { yr: -5, xr: 5 }), FG(10, 'foreground', 352, 682, 545, 65, 485)],
		[BG(11, 7, { yr: -3, xr: 5 }), FG(11, 'foreground', 344, 669, 309, 51, 424)],
		[BG(12, 6, { yr: -4 }), FG(12, 'foreground_michael', 462, 677, 345, 42, 220)],
		[BG(13, 5, { yr: -6, xr: 5 }), FG(13, 'foreground', 399, 681, 430, 39, 250)],
		[BG(14, 6, { yr: -2, xr: 5 }), FG(14, 'foreground', 392, 631, 650, 95, 850)],
		[BG(15, 6, { yr: -3, xr: 5 }), FG(15, 'foreground', 385, 642, 404, 78, 261)],
		[BG(16, 6, { yr: -3, xr: 5 }), FG(16, 'foreground', 300, 600, 300, 150, 400)],
	];
	const ORDERS = [[0, 16, 18, 3, 12, 2, 17, 10, 9, 8, 15, 6, 11, 14, 4, 7, 13], [0, 4, 6, 17, 11, 16, 18, 7, 9, 15, 3, 14, 10, 13, 2, 8, 12],
		[0, 7, 16, 14, 13, 3, 10, 2, 15, 18, 8, 9, 4, 17, 12, 6, 11], [0, 8, 18, 9, 13, 4, 11, 14, 7, 17, 6, 12, 3, 16, 2, 15, 10],
		[0, 11, 12, 7, 18, 14, 9, 13, 4, 2, 15, 11, 8, 16, 6, 3, 17], [0, 10, 16, 2, 13, 17, 8, 9, 18, 3, 12, 6, 7, 4, 14, 15, 10]];
	const order = ORDERS[Math.floor(Math.random() * ORDERS.length)];
	const cubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2);		// TweenStar Cubic.easeInOut
	// the screen's horizontal position; its layers' cameras stay at the stage centre (Scaleform's camera does not move with the clip)
	const slide = (s, x) => {
		s.el.style.transform = 'translateX(' + x + 'px)';
		for (const c of s.cams) c.style.perspectiveOrigin = (640 - x) + 'px 360px';
	};
	const place = (l, x, yr, xr) => { l.el.style.transform = 'translate3d(' + x + 'px,' + l.y + 'px,0) rotateY(' + -yr + 'deg) rotateX(' + -xr + 'deg)'; };
	// a screen's images, decoded before it may show (the movie waits for its texture dictionary the same way)
	const prepare = (i) => {
		const layers = SCREENS[order[i]].map((d) => ({ ...d, img: Object.assign(new Image(), { src: '/b/8b0b5899ed/title/art/' + d.tex + (d.tex.endsWith('.stock') ? '.png?v=layered-stock-v2' : '.webp') }) }));
		return Promise.all(layers.map((l) => l.img.decode().catch(() => {}))).then(() => layers);
	};
	let active = null, leaving = null, index = 0, alt = -1, timer = 0, raf = 0, stopped = false;
	const show = (defs) => {
		const now = performance.now();
		alt = alt <= 0 ? 1 : -1;		// updateScreenIndex: the side alternates
		const el = document.createElement('div');
		el.className = 'ls-screen';
		const cams = [];
		const s = { el, slideFrom: alt * 1280, start: now, settled: 0, cams, layers: defs.map((d) => {
			const cam = document.createElement('div'), e = document.createElement('div');
			cam.className = 'ls-cam';
			e.className = 'ls-layer';
			e.style.width = d.w + 'px'; e.style.height = d.h + 'px';
			e.style.backgroundImage = 'url(' + d.img.src + ')';
			cam.appendChild(e);
			el.appendChild(cam);
			cams.push(cam);
			return { el: e, y: d.y, x0: d.x, yr0: d.yr, xr0: 0, x1: d.to.x ?? d.x, yr1: d.to.yr ?? d.yr, xr1: d.to.xr ?? 0 };
		}) };
		for (const l of s.layers) place(l, l.x0, l.yr0, l.xr0);
		slide(s, s.slideFrom);
		holder.appendChild(el);		// above the screen that leaves
		if (leaving) leaving.el.remove();
		leaving = active;
		if (leaving) { leaving.slideFrom = 0; leaving.slideTo = -alt * 1280; leaving.start = now; }
		active = s;
		s.slideTo = 0;
	};
	const tick = (now) => {
		for (const s of [leaving, active]) {
			if (!s) continue;
			const p = Math.min(1, (now - s.start) / 850);
			if (p < 1 || !s.slid) { slide(s, s.slideFrom + (s.slideTo - s.slideFrom) * cubicInOut(p)); s.slid = p === 1; }
			if (s === active && p === 1 && !s.settled) s.settled = now;		// loadscreenIsSettled: the layers start their 42 s tweens
			if (s.settled) {
				const q = Math.min(1, (now - s.settled) / 42000);
				for (const l of s.layers) place(l, l.x0 + (l.x1 - l.x0) * q, l.yr0 + (l.yr1 - l.yr0) * q, l.xr0 + (l.xr1 - l.xr0) * q);
			}
			if (s === leaving && p === 1) { s.el.remove(); leaving = null; }
		}
		if (!stopped) raf = requestAnimationFrame(tick);
	};
	let next = prepare(0);
	const cycle = () => next.then((defs) => {
		if (stopped) return;
		show(defs);
		index = (index + 1) % order.length;
		next = prepare(index);
		timer = setTimeout(cycle, 14000);		// timerDuration
	});
    let started = false;
    startTitle = () => {
        if (started || stopped) return;
        started = true; cycle(); raf = requestAnimationFrame(tick);
    };
    if (introFinished) startTitle();
	stopTitle = () => { stopped = true; clearTimeout(timer); cancelAnimationFrame(raf); };
}
// ---- start choice: Story Mode / Sandbox Mode, and Sandbox Mode's map, in the title screen's button bar ---------------------------------------------------------
// The game's own loading-time choice (CLoadingScreens::RefreshButtonLayout: "Loading Story Mode" with a spinner, "Online" as a button) with Sandbox Mode in the
// Online slot. Buttons are laid out like updateButtonLayout: the spinner item rightmost; on PC the icons are key caps (a click works too). Enter = Story Mode;
// Space = Sandbox Mode, which asks for the map: 5 = the GTA V map, 6 = "GTA VI Map" (the env_test level), Backspace = back. The choice goes into the engine's
// input block (WasmInputBlock.startMode, wasm/platform/input/browser_input_wasm.cpp): 1 = Story Mode (the release startup: a new game from the Prologue),
// 2 = Sandbox Mode on the GTA V map (free roam at a random spot with every weapon), 3 = Sandbox Mode on env_test. It can change until the engine takes it
// (where it reads -level, about 62 % into the load; it waits there if nothing was chosen, and the page then pulses the key caps); after that only the chosen
// item stays. ?mode=story|sandbox chooses up front (with &map=env_test for Sandbox Mode on env_test).
let startMode = q.get('mode') === 'story' ? 1 : q.get('mode') === 'sandbox' ? (q.get('custommap') && q.get('map') === 'env_test' ? 3 : 2) : 0;
let startModeWord = null, startCommitted = false, pickingMap = false, waitingChoice = false;		// waitingChoice: the engine waits for the choice
const ACTS = {		// button: text, key cap, key codes
	back: ['Back', 'Backspace', ['Backspace']],
	map5: ['GTA V Map', '5', ['Digit5', 'Numpad5']],
	map6: ['Imported Map', '6', ['Digit6', 'Numpad6']],
	sandbox: ['Sandbox Mode', 'Space', ['Space']],
	story: ['Story Mode', 'Enter', ['Enter', 'NumpadEnter']],
};
const LOADING = { 1: 'Loading Story Mode', 2: 'Loading Sandbox Mode: GTA V Map', 3: 'Loading Sandbox Mode: Imported Map' };
const modesEl = document.getElementById('modes'), modeButtons = [...modesEl.querySelectorAll('button')];
const isMode = (act) => act === 'story' || act === 'sandbox';
const showModes = () => {
    modesEl.textContent = q.get('multiplayer') === '1' ? 'Loading Multiplayer Mode' : startMode === 1 ? 'Loading Story Mode' : 'Loading Sandbox Mode';
};
const choose = (m) => {
	pickingMap = false;
	if ((m === 1 ? 'story' : 'sandbox') !== userdataScope) {
		const target = new URL('launcher.html',location.href); target.search=location.search; target.hash=location.hash;
		target.searchParams.set('mode',m===1?'story':'sandbox');
		if(m===3)target.searchParams.set('map','env_test');else target.searchParams.delete('map');
		location.replace(target.href); return;
	}
	if (m !== startMode) {
		startMode = m;
		if (startModeWord) Atomics.store(startModeWord, 0, m);
		postLog('[page] start mode: ' + ({ 1: 'story', 2: 'sandbox', 3: 'sandbox on env_test' })[m]);
	}
	showModes();
};
const act = (a) => {
	if (startCommitted) return;
	if (a === 'story') choose(1);
	else if (a === 'map5') choose(2);
	else if (a === 'map6' && q.has('custommap')) choose(3);
	else { pickingMap = a === 'sandbox'; showModes(); }		// Sandbox Mode (or its loading item: change the map) asks for the map; Back closes that
};
modesEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.hidden) act(b.dataset.act); });
addEventListener('keydown', (e) => {
	if (startCommitted || e.ctrlKey || e.altKey || e.metaKey || !document.getElementById('loading')) return;
	const b = modeButtons.find((x) => !x.hidden && ACTS[x.dataset.act][2].includes(e.code));
	if (!b) return;
	act(b.dataset.act);
	e.preventDefault(); e.stopImmediatePropagation();
}, { capture: true });
showModes();
// ---- loading progress: the engine (prejs.js, loader.js) and the GPU worker publish {pct, label} on a BroadcastChannel ------------------
{
	const loading = document.getElementById('loading'), fill = document.getElementById('fill'), label = document.getElementById('label'), pct = document.getElementById('pct');
	let target = 0, shown = 0, ready = false, dirty = false, loadingGone = false, fatalLoadingError = false;
	let dataBytes = 0, worldBase = -1, ioStatus = null;
    let worldReadyAt = -1, streamingQuietAt = -1;
	const samples = [];
	let lastLine = '';
	const consoleEl = document.getElementById('console');
	const bc = new BroadcastChannel('game-progress');
	let lastActivity = performance.now(), stallLogged = 0, lastLabel = '';
	bc.onmessage = (ev) => {
		const m = ev.data;
		if (m.userdata) { hud.textContent = 'Save data: ' + m.userdata; hud.style.color = m.userdataError ? '#f66' : ''; return; }
		lastActivity = performance.now();
		if (m.io) ioStatus = m.io;
		if (m.dl) {		// bytes of game data fetched by an engine thread since its last report
			dataBytes += m.dl;
			samples.push([performance.now(), m.dl]);
			return;
		}
		if (m.lines) {
			if (loadingGone || !m.lines.length) return;		// the log line above the progress bar is gone: no DOM work for it during play
			lastLine = m.lines[m.lines.length - 1];
			dirty = true;
			return;
		}
		if (m.gpuLost) { loadingIntro.stop(); loadingMusic.stop(); hud.textContent = 'The graphics device was lost (' + m.gpuLost + '): the screen will stay black. Reload the page.'; hud.style.color = '#f66'; return; }
		if (m.error) { loadingIntro.stop(); loadingMusic.stop(); fatalLoadingError = true; label.textContent = m.error; label.style.color = '#e66'; postLog('[page] STARTUP ERROR: ' + m.error); return; }
		if (fatalLoadingError) return;
		if (m.pct > target) { target = m.pct; if (m.label) { lastLabel = m.label; if (!waitingChoice) label.textContent = m.label; } if (m.pct >= 72 && worldBase < 0) worldBase = dataBytes; }
		if (m.choice && !startMode) { waitingChoice = true; modesEl.classList.add('ask'); showModes(); }		// the engine waits for the choice: showModes asks for it in the label
		if (m.commit) { startCommitted = true; pickingMap = false; if (m.mode) startMode = m.mode; showModes(); }		// the engine took the choice
		if (m.compiling !== undefined && !waitingChoice) { label.textContent = lastLabel = 'Preparing shaders (' + m.compiling + ' pending)'; target = Math.max(target, 99); }		// the world is up; the GPU worker holds it until its pipelines are compiled
        if (m.world && worldReadyAt < 0) {
            worldReadyAt = performance.now();
            label.textContent = lastLabel = 'Finishing world streaming';
        }
	};
	// Overall completion is estimated; byte and read counters are measured. No artificial creep.
	const dataEl = document.getElementById('data');
	const WORLD_BYTES = 1.2e9;		// game data the world needs after the scripts start (measured: about 1.2-1.4 GB the first time)
	// Stall watchdog: nothing (no log line, no data, no progress) from any engine thread for 30 s while loading. A tab that ran out of memory dies ("Aw, Snap!") and cannot say so,
	// but one that is thrashing or deadlocked can: show it, and leave a timestamped line in the server log for diagnosis.
	setInterval(() => {
		if (ready || fatalLoadingError) return;
		if (waitingChoice) { if (!startMode) { lastActivity = performance.now(); return; } waitingChoice = false; label.textContent = lastLabel; }
		const quiet = (performance.now() - lastActivity) / 1000;
		if (quiet > 30) {
			label.textContent = 'No loading updates for ' + (quiet | 0) + ' s' + (lastLabel ? ' (last step: ' + lastLabel + ')' : '') + (quiet < 120 ? '. First launch or a slow computer can take longer; keep this tab selected and wait.' : '. Loading may be stalled. Close other heavy apps; if it stays unchanged, return to the launcher ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ Troubleshooting and capture the first console error.');
			label.style.color = '#e96';
			if (quiet - stallLogged > 30) { stallLogged = quiet; postLog('[page] STALL: no progress for ' + (quiet | 0) + ' s, last step "' + lastLabel + '", shown ' + shown.toFixed(0) + '%'); }
		} else if (stallLogged) { stallLogged = 0; label.style.color = ''; if (lastLabel) label.textContent = lastLabel; }
	}, 2000);
	const progressTimer = setInterval(() => {
		const now = performance.now();
		while (samples.length && now - samples[0][0] > 3000) samples.shift();
		const speed = samples.reduce((a, x) => a + x[1], 0) / 3;
        // The GPU's first stable scene does not imply that world assets have finished streaming.
        // Wait for low network demand for 1.5 s, capped at 30 s for continuous background streaming.
        if (worldReadyAt >= 0 && !ready && !fatalLoadingError) {
            const busy = !ioStatus || ioStatus.active > 2 || speed > 1048576;
            if (busy) streamingQuietAt = -1;
            else if (streamingQuietAt < 0) streamingQuietAt = now;
            if ((streamingQuietAt >= 0 && now - streamingQuietAt >= 1500) || now - worldReadyAt >= 30000) {
                label.textContent = lastLabel = 'Ready';
                loadingIntro.hold(); ready = true; shown = 100; fill.style.width = '100%'; pct.textContent = '100%'; loadingGone = true; clearInterval(progressTimer); setTimeout(() => { loadingMusic.fadeOut(1200); loading.style.transition = 'opacity 1.2s ease'; loading.classList.add('done'); setTimeout(() => { loadingIntro.stop(); loadingMusic.stop(); loading.remove(); stopTitle(); }, 1200); }, 500); hud.textContent = 'click the game to capture the mouse (Esc releases it, Shift+P switches keyboard mode, = shows FPS)'; setTimeout(() => { hud.textContent = ''; }, 15000);
            } else {
                label.textContent = lastLabel = 'Finishing world streaming'
                    + (ioStatus ? ' (' + ioStatus.active + ' transfers)' : '');
            }
        }
		dataEl.textContent = 'Game data: ' + (dataBytes / 1048576).toFixed(1) + ' MiB received \u00b7 ' + (speed / 1048576).toFixed(1) + ' MiB/s'
            + (ioStatus ? ' \u00b7 ' + ioStatus.active + ' transfers \u00b7 ' + ioStatus.reads + ' asset read requests'
                + (ioStatus.file ? ' \u00b7 ' + ioStatus.file : '') : '');
		// from the scripts stage on, progress also follows the data that arrives (72 -> 98 %)
		if (worldBase >= 0 && !ready) target = Math.max(target, 72 + 26 * Math.min(1, (dataBytes - worldBase) / WORLD_BYTES));
		const goal = ready ? 100 : Math.min(99, target);
		shown += (goal - shown) * 0.12;
		if (dirty) {		// the newest line only
			dirty = false;
			consoleEl.textContent = lastLine;
		}
		fill.style.width = shown.toFixed(1) + '%';
		pct.textContent = Math.round(shown) + '%';


	}, 50);
}
const hud = document.getElementById('hud');
GTAGameUI.mount();
const canvas = document.getElementById('canvas');
// With ?log=1, log lines of the engine threads and the GPU worker arrive here (prejs.js / wgpu_worker.js post them on 'game-log' without blocking) and go to the dev server
// in order, one POST at a time with whatever queued up meanwhile.
if (remoteLog) {
	const queue = [];
	let sending = false;
	const pump = async () => {
		if (sending || !queue.length) return;
		sending = true;
		const body = queue.splice(0).join('\n');
		try { await fetch('/log', { method: 'POST', body, keepalive: body.length < 60000 }); } catch (e) { /* server gone */ }
		sending = false;
		pump();
	};
	new BroadcastChannel('game-log').onmessage = (ev) => { queue.push(ev.data); if (queue.length > 20000) queue.splice(0, queue.length - 20000); pump(); };
}
// Release the io worker's exclusive storage handles as soon as this page goes away (a quick reload would otherwise find them locked and run without the store).
addEventListener('pagehide', () => { try { new BroadcastChannel('game-io').postMessage('close'); } catch (e) {} });
// The launcher must not clear caches while another game tab is using them.
const cacheControl = new BroadcastChannel('gta-cache-control');
cacheControl.onmessage = ev => { if (ev.data?.type === 'probe') cacheControl.postMessage({type:'active',token:ev.data.token}); };
addEventListener('pagehide', () => cacheControl.close());
// Earlier versions cached the game data with a service worker (sw.js) and the Cache API: remove both, the io worker keeps its own store (io_worker.js).
async function dropOldCache() {
	try {
		if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
		if (window.caches) for (const k of await caches.keys()) if (k.startsWith('gamedata')) await caches.delete(k);
	} catch (e) { console.warn('could not remove the old cache: ' + e); }
}
let lowMemory = false;		// set below (module scope: the ?mem readout further down also needs it)
let startSize = [1280, 720], wantSize = null;		// set below (module scope: installInput uses them)
if (!crossOriginIsolated) { document.getElementById('label').textContent = 'not cross-origin isolated: open the page over https (or localhost); the server sends COOP/COEP'; document.getElementById('label').style.color = '#e66'; }
else {
	const offscreen = canvas.transferControlToOffscreen();
	await dropOldCache();
	let userMod=null;
	if(q.has('custommap')){if(q.get('mode')!=='sandbox'||q.get('multiplayer')==='1'||q.has('usermod')||q.has('carmod')||q.has('trainer')||q.has('poseproof'))throw Error('Custom maps require unmodified single-player Sandbox');try{userMod=await GTACustomMaps.prepare(q.get('custommap'));}catch(error){document.getElementById('label').textContent='Map launch stopped: '+error.message;throw error;}}
	if(q.has('usermod')){
		if((q.get('mode')!=='sandbox'&&!storyModSession)||q.get('multiplayer')==='1'||q.get('poseproof')!=='4')throw new Error('Imported vehicles require Sandbox or the Story trainer/traffic opt-in, without multiplayer');
		try{const pool=modTraffic?(q.has('modpool')?JSON.parse(q.get('modpool')):[{id:q.get('usermod'),model:q.get('modmodel')}]):[];if(modTraffic&&!pool.length)throw new Error('Traffic pool is empty');userMod=await GTAUserMods.prepareMany(q.get('usermod'),q.get('modmodel'),pool,q.has('modpackages')?JSON.parse(q.get('modpackages')):[]);}catch(error){hud.textContent='Mod launch stopped: '+error.message;document.getElementById('label').textContent=hud.textContent;throw error;}
	}
	// Low-memory profile (?low=1 forces it, ?low=0 forbids it; default: navigator.deviceMemory <= 4, which browsers report as 4 for 4 GB and less):
	// every engine thread is a Web Worker of ~20 MB and the engine sizes its thread count from the core count, so pretend to have 2 cores (54 threads
	// instead of 80-116); quarter the texture memory (texture quality 0 = top mip skipped on the GPU), no network stack, and the minimum ped/vehicle
	// variety, city density, LOD and quality settings: measured in a Node run at the world, GPU memory 1.16 GB -> 0.5 GB and streamed assets 1.38 GB -> 0.95 GB.
	// Shadows off (-shadowQuality=-1, engine level 0 below the menu's lowest; SettingsManager.cpp, wasm): the cascade shadow pass was a third of all draws (Node, 1366x600:
	// 600-900 of 1,300-2,900 per frame), and a 4-core Chromebook spent ~110 us per draw. ?shadows=1 keeps them at the lowest level.
	const lowParam = q.get('low');
	lowMemory = lowParam === '1' || (lowParam !== '0' && navigator.deviceMemory && navigator.deviceMemory <= 4);
	const LOW_ARGS = ['-textureQuality=0', '-pedVariety=0', '-vehicleVariety=0', '-shadowQuality=' + (q.get('shadows') === '1' ? 0 : -1), '-reflectionQuality=0', '-particleQuality=0',
		'-grassQuality=0', '-cityDensity=0', '-lodScale=0', '-pedLodBias=0', '-vehicleLodBias=0'];
	const cores = GTACpuSettings.resolve(q.get('cores'),lowMemory);
	if (lowMemory) hud.textContent = 'Low-memory profile active (' + (navigator.deviceMemory || '?') + ' GB reported). If the game stops, save diagnostics before reloading.';
postLog('[page env] ' + JSON.stringify({ deviceMemory: navigator.deviceMemory, cores: navigator.hardwareConcurrency, usingCores: cores, low: lowMemory, isolated: crossOriginIsolated, ua: navigator.userAgent.slice(0, 120), screen: screen.width + 'x' + screen.height + '@' + devicePixelRatio }));
// Back buffer = the browser window in device pixels (native resolution), following window resizes live (see installInput). ?scale=0.75 renders at 75 % (faster), ?fixed=1 keeps the
// start-up size whatever the window does, ?res=1920x1080 forces a size. Even numbers, at most 3840x2160 (2560x1440 in the low-memory profile: screen-sized render targets dominate GPU memory).
wantSize = () => {
	const forced = /^(\d+)x(\d+)$/.exec(q.get('res') || '');
	if (forced) { let w=+forced[1],h=+forced[2]; const cap=lowMemory?[2560,1440]:[3840,2160],k=Math.min(1,cap[0]/w,cap[1]/h); return [Math.max(320,Math.round(w*k/2)*2),Math.max(240,Math.round(h*k/2)*2)]; }
	const sc = Math.max(0.25, Math.min(2, +(q.get('scale') || 1)));
	const viewport = GTATouchControls.viewportSize();
	let w = viewport[0] * devicePixelRatio * sc, h = viewport[1] * devicePixelRatio * sc;
	const minimum = Math.max(1, 320 / w, 240 / h); w *= minimum; h *= minimum;
	const cap = lowMemory ? [2560, 1440] : [3840, 2160], k = Math.min(1, cap[0] / w, cap[1] / h);
	w *= k; h *= k;
	return [Math.max(320, Math.round(w / 2) * 2), Math.max(240, Math.round(h / 2) * 2)];
};
startSize = wantSize();
// Script and replay channels: ~87 % of all log lines in play (the scripts print leaderboard and status lines every few frames). Below warning they are off: formatting, the
// log transport and the dev server's log file cost the main thread for nothing. ?verbose=1 keeps everything.
const LOG_ARGS = q.get('verbose') ? [] : ['-Script_all=warning', '-replay_all=warning'];
// -fastscriptcore: the script interpreter's production core (scrThread::Run static). Without it this build runs the debugging core, which looks up two breakpoint tables
// for every script instruction (scrThread::Run was ~8 % of the main thread).
const GAME_LANGUAGES = new Set(['american', 'french', 'german', 'italian', 'spanish', 'portuguese', 'polish', 'russian', 'korean', 'chinese', 'japanese', 'mexican']);
const ENGINE_ARGS = ['-fastscriptcore', ...(GAME_LANGUAGES.has(q.get('language')) ? ['-uilanguage='+q.get('language')] : [])];
// Chrome on Windows rounds every wait with a timeout (Atomics.wait: the engine's sleeps, its 1 ms event waits, the frame limiter, the yields of its spin loops) up to the OS
// timer tick, 15.6 ms, unless the renderer process has a timer below 16 ms pending, which switches the process to a fine tick (measured: a 1 ms wait takes 15.5 ms; with
// this timer 2.1 ms, a 4 ms wait 5.0 ms). The game has no such timer, so every short sleep cost a whole tick: the limiter held a 60 fps cap to 37 fps and the visibility
// wait added 15 ms to a frame. An empty callback; nothing else on this thread runs while the game plays.
if (/Windows NT/.test(navigator.userAgent)) setInterval(() => {}, 1);
const forceSave=q.get('forcesave')==='1'&&userdataScope==='story'&&!q.has('poseproof')&&!q.has('usermod')&&!q.has('carmod')&&q.get('multiplayer')!=='1';
const forceSaveControl=forceSave?new SharedArrayBuffer(64):null;
const userdataProfile = forceSave&&/^[0-9a-f]{32}$/.test(q.get('forcesaveprofile')||'')?q.get('forcesaveprofile'):GTASaveProfiles.resolve(localStorage,userdataScope,q.get('saveprofile')||'default').profile;
const userdataLegacy=!q.has('saveprofile')||q.get('saveprofile')==='default';
if(forceSave)GTAStorySave.install({control:forceSaveControl,profile:userdataProfile,isReady:fpsWorldReady,log:postLog});
const pacing = GTAPacingSettings.get(q.toString());
if(pacing.diagnosticVsync){postLog('[VSync diagnostic] native mode0; GPU cap'+pacing.fps+'; synchronization fences unchanged');const badge=document.createElement('div');badge.textContent='Diagnostic: native VSync off ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· '+pacing.fps+' FPS cap';badge.style.cssText='position:fixed;top:34px;left:8px;z-index:12;padding:8px;background:#08110feb;color:white;font:13px system-ui';document.body.append(badge);}
const movieEnabled=userdataScope==='story'&&!q.has('poseproof')&&!userMod&&!q.has('carmod')&&!fivemMetadataProbe&&!fivemPlayerProbe&&!fivemVehicleProbe&&q.get('multiplayer')!=='1';
const movieToken=movieEnabled?crypto.randomUUID():null,movieControl=movieEnabled?new SharedArrayBuffer(64):null,movieChannel=movieEnabled?new MessageChannel():null;
const moviePlayer=movieEnabled?GTAMoviePage.install(movieChannel.port1,movieToken,postLog):null;
const worker = new Worker(BASE + '/loader.js?mobilecompat=core-v1&r5=20261020&pressure=voice-v1&customaudio=selective-v1&lightingbuild=compile-wait-emissive-v2&playerfix=mission-reports-v3&scenariofix=bounded-collision-v1&assetfix=friends-cs6-v1&cachefix=registration-lock-v1&sandboxlocations=ambient-v1&releaseprep=compat-fps-v1&resizefix=wait-before-free-v1&floatpatch=auto-fp16-v1&uploadlayout=v2&bcpatch=status-v2&cashfix=bank-sync-v1&msbindings=v3&shaderrepair=pipeline-rt-v1-io2&movie=custom-map-v1-shadow-rollback&assetfix=fencing-pagemap-v1-road-original-v1&shadermods=data-v2&menyoo=xml-v4&traffic=pool16-v1&runtime='+(forceSave?'forcesave-v1':fivemMetadataProbe||fivemPlayerProbe||fivemVehicleProbe?'cfx-meta-v8':'speech-v2')+(userMod?'&modmanifest='+encodeURIComponent(userMod.manifestUrl):''));
	worker.onmessage = (ev) => {
        if(ev.data.audioPressureLayout===1){audioPressureLayout=1;if(audioPending&&q.get('audiodiag')!=='0')GTAAudioPressure.start(audioPending.memory,reportAudioPressure);}
		if (ev.data.hud) hud.textContent = ev.data.hud;
        if(ev.data.bridge&&speechProbe)GTASpeechProbe.attach(ev.data.bridge,postLog);
        if (ev.data.bridge && ['1','2','3','4'].includes(q.get('poseproof'))) { if(fivemPlayerProbe||fivemVehicleProbe)GTACfxGame.attach(ev.data.bridge,postLog,{isWorldReady:fpsWorldReady,vehicleProfile:fivemVehicleProbe});else if(fivemMetadataProbe)GTACfxEngine.install(ev.data.bridge,postLog,{isWorldReady:fpsWorldReady});else if(q.get('multiplayer')==='1')GTAMultiplayerGame.attach(ev.data.bridge,postLog,{isWorldReady:()=>{const loading=document.getElementById('loading');return !loading||loading.classList.contains('done');}});else {GTAPoseBridge.install(ev.data.bridge,postLog,{mode:q.get('mode'),hidePanel:true,context:['2','3','4'].includes(q.get('poseproof')),replica:q.get('poseproof')==='3',car:q.get('poseproof')==='4',trainer,model:userMod?userMod.model:trainer&&!q.has('carmod')?'sultan':null,isWorldReady:()=>{const loading=document.getElementById('loading');return !loading||loading.classList.contains('done');}});if(modTraffic&&userMod)GTAModTraffic.install(ev.data.bridge,postLog,{models:userMod.trafficModels,share:Number(q.get('modshare')||5),isWorldReady:fpsWorldReady});} }
        if (ev.data.input) {moviePlayer?.attach(ev.data.input.memory);
            if(((d)=>{const b=d?.block,m=d?.memory?.buffer;return !!m&&Number.isSafeInteger(b)&&b>0&&b+64<=m.byteLength&&new DataView(m).getUint32(b+32,true)===0x424d5053;})(ev.data.input)){postLog('[bridge safety] refused mailbox mislabeled as ordinary input');return;}
            if(q.get('fpsdiag')==='1'||q.get('lagdiag')==='1')GTANativeFpsDiagnostics.start(ev.data.input.memory,postLog);
            if(pacing.experimental)GTANativeRefreshProbe.start(ev.data.input.memory,fpsWorldReady,postLog,pacing.fps);
            else if(fpsBenchmarkToken)GTAFpsBenchmark.attach(ev.data.input.memory,fpsBenchmarkToken,fpsWorldReady,postLog);
            else if(q.get('fpsdiag')==='1'&&q.get('fpsdebug')==='75'&&q.get('nativehz')==='75'&&q.get('mode')==='sandbox'&&!q.has('poseproof')&&!q.has('usermod'))GTANativeRefreshProbe.start(ev.data.input.memory,fpsWorldReady,postLog);
            installInput(ev.data.input.memory,ev.data.input.block);
            controllerBridge=GTAController.install(ev.data.input.memory,ev.data.input.block,{build:BASE,disabled:q.get('controller')==='off',virtualGamepad:()=>touchControls.sample(),menu:gp=>!!globalThis.GTATrainerPort?.controller?.(gp,touchControls.isSettingsOpen()||!!document.querySelector('dialog[open]')),suspended:()=>touchControls.isSettingsOpen()||!!globalThis.GTATrainerPort?.isOpen(),log:postLog,diag:q.get('radiodiag')==='1'?(sample)=>{const el=document.getElementById('controller-status');el.hidden=false;el.style.whiteSpace='pre-wrap';el.textContent='Radio input trace\n'+JSON.stringify(sample);postLog('[radio input] '+JSON.stringify(sample));}:null,status:(info)=>{ const el=document.getElementById('controller-status'); el.dataset.state=info.state; el.textContent='Controller: '+info.text; el.hidden=q.get('paddebug')!=='1'; }});
            if (q.get('mapdiag') === '1') {
                const memory=ev.data.input.memory;
                let count=0;
                const timer=setInterval(()=>{
                    try {
                        const d=new DataView(memory.buffer), buf=d.getInt32(11062180,true);
                        const tilePtr=Number(d.getBigUint64(19507024,true)),dims=[d.getUint16(19507048,true),d.getUint16(19507050,true),d.getUint16(19507052,true)],n=Math.min(96,dims[0]*dims[1]*dims[2]);
                        const tileDrawIndices=[];
                        if((buf===0||buf===1)&&tilePtr>0&&tilePtr+n*16+8<memory.buffer.byteLength)for(let i=0;i<n;i++)tileDrawIndices.push(d.getInt32(tilePtr+i*16+8+4*buf,true));
                        postLog('[mapdiag] '+JSON.stringify({active:d.getUint8(19538228),movieBg:d.getInt32(19538304,true),movieFg:d.getInt32(19538308,true),golfMap:d.getInt32(19538096,true),renderMinimap:d.getUint8(6974296),backgroundEnabled:d.getUint8(6974078),foregroundEnabled:d.getUint8(6974079),showMainMap:d.getUint8(19538232),renderBuf:buf,superLowDrawIdx:buf===0||buf===1?d.getInt32(19507064+4*buf,true):null,bitmapDims:dims,tileDrawIndices}));
                    } catch(e) { postLog('[mapdiag] '+e); }
                    if(++count>=20)clearInterval(timer);
                },2000);
            }
        }
		if (ev.data.audio) { audioPending = ev.data.audio;if(audioPressureLayout===1&&q.get('audiodiag')!=='0')GTAAudioPressure.start(audioPending.memory,reportAudioPressure); tryStartAudio(); }
	};
	worker.onerror = (e) => { hud.textContent = 'worker error: ' + e.message; };
	worker.postMessage({
        movieToken,movieControl,moviePort:movieChannel?.port2,
		canvas: offscreen,
		base: BASE,
		userdataProfile,
        sandboxLocations:userdataScope==='sandbox'&&q.get('multiplayer')!=='1'&&!q.has('custommap')&&q.get('map')!=='env_test',
		userdataScope,
		userdataLegacy,
        forceSave,forceSaveControl,
		speechProbe,
		poseProof: ['1','2','3','4'].includes(q.get('poseproof')),
		fivemProof: fivemMetadataProbe||fivemPlayerProbe||fivemVehicleProbe,
		fivemVehicle: fivemVehicleProbe,
		replicaProof: q.get('poseproof')==='3'&&q.get('mode')==='sandbox',
		scriptProof: q.get('poseproof') === '2',
		assetMod: q.get('carmod')==='rs318-test'?'audi-rs3-2018-v1':null,
		trainer,
		menyooPresets:trainer?MenyooPresets.list():[],
		menyooPresets:trainer?MenyooPresets.list():[],
		modTraffic,
		storyModTraffic,
		carProof: (trainer||q.get('carmod')==='rs318-test'||!!userMod)&&q.get('poseproof')==='4'&&(q.get('mode')==='sandbox'||storyModSession),
		userMod,
		customMap: q.has('custommap'),
		args: ['-rootdir=/game/', ...(q.get('nogpu') ? [] : ['-wgpu']), '-nodisplaycalibration', '-noloadingtune', '-noSocialClub', '-pc:nosocialclub', ...(q.get('newgame') === '1' ? ['-noautoload'] : []), '-nonetwork', '-nonetlogs', '-output', '-width=' + startSize[0], '-height=' + startSize[1], '-forceResolution', ...LOG_ARGS, ...ENGINE_ARGS, '-frameLimit=' + pacing.frameLimit,		// native VSync: 2 for 30 FPS, 1 for 60; the GPU pacer handles 24 FPS with mode 0. Story Mode continues from the newest savegame (the engine skips that for Sandbox Mode); ?newgame=1 (-noautoload) starts it from the Prologue instead
		 ...(cores <= 2 ? ['-numCores=' + cores] : []), ...(lowMemory ? LOW_ARGS : []), ...(q.get('args') || '').split(',').filter(Boolean),
		 // The granular player-engine path is silent in this port; use the working
		 // standard engine audio. ?granular=1 is retained for focused diagnostics.
		 ...(q.get('granular') === '1' ? [] : ['-disablegranular']),
		 ...(q.get('nogpu') ? [] : [...GTAGraphicsSettings.engineArgs(q.toString()),'-multiSample=0','-reflectionMSAA=0','-txaa=0',GTAGraphicsSettings.shadowArg(q.toString()),'-shaderQuality=1','-tessellation=0','-fxaa='+(q.get('fxaa')==='0'?0:1)])],
		fps: pacing.fps,
		fpsDiag: q.get('fpsdiag') === '1'||q.get('lagdiag')==='1',
		lagDiag:q.get('lagdiag')==='1',lagProfile:q.get('lagprofile')==='1',
		cbFast:q.get('cbfast')==='1',bindReuse:q.get('bindreuse')==='1',bindLocal:q.get('bindlocal')==='1',bindDiag:q.get('binddiag')==='1',quietNativeLogs:q.get('quietnative')==='1',
		fpsBenchmarkToken,
		timingRun:q.get('runtime'),
		streamingDiag:q.get('streamdiag')==='1',
		ioDiag:q.get('iodiag')==='1',
		ioParallel:Number(q.get('iopar')||0),ioWaitDedupe:q.get('iowaitdedup')==='1',
		renderOptOff:q.get('renderopt')==='off',
		bgHistory:q.get('bghistory')==='1',
        pipelineLast:q.get('pipelast')==='1',uniformCopyReuse:q.get('cbtemplate')==='1',uniformSegments:q.get('cbsegments')==='1',
		rtStateCache:q.get('rtstate')==='1',
		bcHalf:q.get('bchalf')==='1',
		fpsDebug75: pacing.diagnostic === true,
		fpsVsyncTest: pacing.diagnosticVsync === true,
		shotEvery: +(q.get('shot') || 0),
		shotRt: q.get('shotrt') === '1',		// ?shotrt=1 (with ?shot=N): every render target of one frame after the world is shown to the dev server's shots/ (wgpu_worker.js)
		noHints: q.get('nohints') === '1',		// ?nohints=1: do not fetch the streamer's queued reads ahead (io_worker.js drainHints; diagnostics)
		noPack: q.get('nopack') === '1',		// ?nopack=1: fetch shaders one by one, not from the shader packs (wgpu_worker.js; diagnostics)
		gpuLimits: q.get('limits') || '',		// ?limits=maxSampledTexturesPerShaderStage:16,... : request a smaller GPU device than the adapter offers (reproduces a weaker device's limits; wgpu_worker.js)
		keepThreads: (q.get('keep') || '').split(',').reduce((m, g) => m | ({ replay: 1, net: 2, bink: 4, idle: 8 }[g] || 0), 0),		// ?keep=replay,net,bink,idle: start those thread groups (diagnostics)
		cores,
		noStore: !!(q.get('nocache') || q.get('nosw')),
		fullConsole: !!q.get('console'),
		remoteLog, clientLog,		// ?log=1 (above): loader.js passes it on to the engine threads and the GPU and io workers
		colourDiag: q.get('colordiag')==='1',
		geometryDiag: q.get('geometrydiag') === '1',
		shadowDiag: q.get('shadowdiag') === '1',
		shadowIndexFix: q.get('shadowindex') === '1',
		shadowBiasGuard: q.get('shadowbiasguard') === '1',
		shadowLookupFix: q.get('shadowlookup') === '1',
		cloudDepthBoundsFix: q.get('cloudbounds') === '1',
		safeUploads: ['0','1','copy'].includes(q.get('safeuploads')) ? q.get('safeuploads') : null,
		trace: !!q.get('trace'),		// ?trace=1: log every engine file request (io_worker.js)
		slots: +(q.get('slots') || 0),		// ?slots=N: frames in flight of the GPU worker (diagnostics)
		syncPipelines: !!q.get('syncpipelines'),		// ?syncpipelines=1: the GPU worker compiles pipelines synchronously (no draws skipped while one compiles)
		record: !!q.get('record'),		// ?record=1: log the boot read set (io_worker.js), for record_bootset.py
		bcFallback: ['auto','off','force'].includes(q.get('bcfallback'))?q.get('bcfallback'):'auto',
		lowMemory,
	}, movieEnabled?[offscreen,movieChannel.port2]:[offscreen]);
}

// ?mem=1 (diagnostics, needs ?log=1): performance.measureUserAgentSpecificMemory() every 15 s (needs cross-origin isolation), posted to the dev server's log.
if (remoteLog && (q.get('mem') || lowMemory) && performance.measureUserAgentSpecificMemory) {		// with ?log=1 on by default in the low-memory profile: the last reading before a crash/stall is in the log
	const report = async () => {
		try {
			const r = await performance.measureUserAgentSpecificMemory();
			const rows = r.breakdown.filter((b) => b.bytes > 1e6).map((b) => (b.bytes / 1048576 | 0) + ' MB ' + (b.types || []).join('+') + ' ' + (b.attribution || []).map((a) => (a.url || '').split('/').pop() + '/' + (a.scope || '')).join(','));
			postLog('[page mem] total ' + (r.bytes / 1048576 | 0) + ' MB; ' + rows.join(' | '));
		} catch (e) { postLog('[page mem] failed: ' + e); }
		setTimeout(report, 15000);
	};
	setTimeout(report, 15000);
}

// ---- audio: the engine mixer writes into a ring in shared memory (platform/audio/browser_audio_wasm.cpp); an AudioWorklet plays it -------------------
// Browsers only allow audio after a user gesture: the context is created on the first click/key press.
function reportAudioLifecycle(detail) {
 try { const channel=new BroadcastChannel('game-progress');channel.postMessage({audioLifecycle:detail});channel.close(); } catch (_) {}
}
let audioPending = null, audioGesture = false, audioStarted = false;
function tryStartAudio() {
	if (!audioPending || !audioGesture || audioStarted) return;
	audioStarted = true;
	(async () => {
		try {
			const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
			await ctx.audioWorklet.addModule(BASE + '/audio-worklet.js?patch=voice-pressure-v1');
			const node = new AudioWorkletNode(ctx, 'game-audio', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { ...audioPending, bufferDiagnostics:q.get('audiodiag')!=='0', diagnostics: q.get('audiodiag') === '1' || q.get('audiodiag') !== '0' && (remoteLog || clientLog) } });
			node.port.onmessage = (ev) => { if(ev.data?.audioBufferStats)reportAudioLifecycle({stage:'buffer',...ev.data});if (ev.data?.audioStats) postLog('[audio diagnostic] ' + JSON.stringify(ev.data)); };
			node.connect(ctx.destination);
			// Install recovery gestures before resume(), whose promise may remain pending.
            let samples=0;
            const report=()=>{try{const h=new Int32Array(audioPending.memory.buffer,audioPending.ring,8);reportAudioLifecycle({stage:'playback',state:ctx.state,time:ctx.currentTime,written:Atomics.load(h,0)>>>0,read:Atomics.load(h,1)>>>0,workletCalls:Atomics.load(h,3)>>>0,peak:Atomics.load(h,4)/1e6});}catch(e){reportAudioLifecycle({stage:'snapshot-error',error:String(e)});}};
            const resume=()=>{void ctx.resume().catch(e=>reportAudioLifecycle({stage:'resume-error',error:String(e)}));};
            addEventListener('pointerdown',resume);addEventListener('keydown',resume);
            report();const diagnosticTimer=setInterval(()=>{report();if(++samples>=12)clearInterval(diagnosticTimer);},15000);
            await ctx.resume();
			if (q.get('mem')) {		// diagnostics: ring state every 5 s
				const hdr = new Int32Array(audioPending.memory.buffer, audioPending.ring, 8);
				setInterval(() => postLog('[page audio] state ' + ctx.state + ', frames written ' + (hdr[0] >>> 0) + ', read ' + (hdr[1] >>> 0) + ', fill ' + (((hdr[0] - hdr[1]) >>> 0)) + ', worklet calls ' + (hdr[3] >>> 0) + ', peak ' + (Atomics.exchange(hdr, 4, 0) / 1e6).toFixed(3)), 5000);
			}
			reportAudioLifecycle({stage:'started',state:ctx.state,sampleRate:ctx.sampleRate});
			postLog('[page] audio started: ' + ctx.sampleRate + ' Hz, base latency ' + ctx.baseLatency);
		} catch (e) { audioStarted = false; reportAudioLifecycle({stage:'setup-error',error:String(e)}); postLog('[page] audio failed: ' + e); }
	})();
}
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => { audioGesture = true; tryStartAudio(); }, { capture: true });

// ---- input: DOM events -> the engine's input block in shared memory (platform/input/browser_input_wasm.cpp) ------------------------
// Layout of WasmInputBlock: 256 key bytes, then int32 words: mouseX, mouseY, dX, dY, dZ, buttons, focus, locked, textHead, textTail, text[64] (uint16).
const VK = {
	Backspace: 0x08, Tab: 0x09, Enter: 0x0D, NumpadEnter: 0xFD, Pause: 0x13, CapsLock: 0x14, Escape: 0x1B, Space: 0x20, PageUp: 0x21, PageDown: 0x22,
	End: 0x23, Home: 0x24, ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28, PrintScreen: 0x2C, Insert: 0x2D, Delete: 0x2E,
	MetaLeft: 0x5B, MetaRight: 0x5C, ContextMenu: 0x5D, NumpadMultiply: 0x6A, NumpadAdd: 0x6B, NumpadSubtract: 0x6D, NumpadDecimal: 0x6E, NumpadDivide: 0x6F,
	NumLock: 0x90, ScrollLock: 0x91, ShiftLeft: 0xA0, ShiftRight: 0xA1, ControlLeft: 0xA2, ControlRight: 0xA3, AltLeft: 0xA4, AltRight: 0xA5,
	Semicolon: 0xBA, Equal: 0xBB, Comma: 0xBC, Minus: 0xBD, Period: 0xBE, Slash: 0xBF, Backquote: 0xC0, BracketLeft: 0xDB, Backslash: 0xDC, BracketRight: 0xDD,
	Quote: 0xDE, IntlBackslash: 0xE2,
};
for (let i = 0; i < 10; i++) { VK['Digit' + i] = 0x30 + i; VK['Numpad' + i] = 0x60 + i; }
for (let i = 0; i < 26; i++) VK['Key' + String.fromCharCode(65 + i)] = 0x41 + i;
for (let i = 1; i <= 24; i++) VK['F' + i] = 0x6F + i;

// ?dbg=1: draw isolation for hunting rendering artifacts. The GPU worker runs only the first N draws of each frame (N in the input block, -1 = all) and
// reports the pipeline of the last one it ran. Find the smallest N at which the artifact appears: that draw paints it. F1/F2: N -1/+1, F3/F4: N -25/+25,
// F5: back to all draws, F6: write the current draw to the server log (the log is what to send).
function installInput(memory, block) {
	if(q.get('log')==='1'||q.get('clientlog')==='1')GTACinematicDiag.start(memory,postLog);
	
	const keys = new Uint8Array(memory.buffer, block, 256);
	const w = new Int32Array(memory.buffer, block + 256, 10);
	touchControls.bind({keys,w,VK});
	const U16 = new Uint16Array(memory.buffer, block + 256 + 40, 64);
	const MX = 0, MY = 1, DX = 2, DY = 3, DZ = 4, BTN = 5, FOCUS = 6, LOCKED = 7, HEAD = 8, TAIL = 9;
	let W = startSize[0], H = startSize[1];		// back buffer size in device pixels (mouse clamping); updated when the window is resized
	const ext = new Int32Array(memory.buffer, block + 424, 4);		// dbgDrawLimit, dbgFrameDraws, winW, winH
	startModeWord = new Int32Array(memory.buffer, block + 440, 1);		// startMode (the start menu above)
	if (startMode) Atomics.store(startModeWord, 0, startMode);
	Atomics.store(ext, 2, W); Atomics.store(ext, 3, H);
	if (!q.get('fixed')) {
		let timer = 0;
		const updateViewport = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				const [w, h] = wantSize();
				if (w === W && h === H) return;
				W = w; H = h;
				Atomics.store(ext, 2, w); Atomics.store(ext, 3, h);
				trace('window resized: back buffer ' + w + 'x' + h);
			}, 150);
		};
		addEventListener('resize', updateViewport);
		addEventListener('touchviewportchange', updateViewport);
	}
	Atomics.store(w, FOCUS, document.hasFocus() ? 1 : 0);
	Atomics.store(w, MX, W >> 1);
	Atomics.store(w, MY, H >> 1);

	// Input tracing: the first events the page sees and where they go (POST /log), so a session that loses its keyboard says at which stage
	let traced = 0;
	const trace = (msg) => { if (traced < 80) { traced++; postLog('[page input] ' + msg); } };
	const passThrough = (e) => e.code === 'F12' || e.code === 'F11' || (e.ctrlKey && e.shiftKey && (e.code === 'KeyI' || e.code === 'KeyJ')) || e.code === 'F5';
	// Aircraft and submarine pitch and roll are on the numpad in the game (8/2/4/6, target select 7/9), which many keyboards lack. The numpad keys are bound to nothing else, so I/K (pitch), J/L (roll)
	// and U/O (target left/right) press the same keys for the engine; the real numpad keeps working.
	const FLY_ALIAS = { KeyI: 'Numpad8', KeyK: 'Numpad2', KeyJ: 'Numpad4', KeyL: 'Numpad6', KeyU: 'Numpad7', KeyO: 'Numpad9' };
	const held = new Set(),pressedPhysical=new Map();
	const uiTarget=e=>!!globalThis.GTATrainerPort?.isOpen()||!!e.target.closest?.('#pad,.tc-ui,#tc-box,#tc-rotate,#tc-xclose,dialog,input,textarea,select,button,#pose-proof-status,#fivem-player-status,#fivem-activity-panel,#return-launcher');
	const syncFlyAlias = () => { for (const [src, target] of Object.entries(FLY_ALIAS)) Atomics.store(keys, VK[target], held.has(src) || held.has(target) ? 0x80 : 0); };
	addEventListener('keydown', (e) => {
		if (passThrough(e)) return;
		if(uiTarget(e))return;
		e.preventDefault();
		if(!pressedPhysical.has(e.code))pressedPhysical.set(e.code,GTAKeyboardControls.resolve(e.code));
		const codes=pressedPhysical.get(e.code),vk=VK[codes[0]];
		if (!e.repeat) trace('keydown ' + e.code + ' vk=' + (vk || 'UNMAPPED') + ' hasFocus=' + document.hasFocus() + ' engineFocus=' + Atomics.load(w, FOCUS));
		for(const code of codes){if(VK[code])Atomics.store(keys,VK[code],0x80);held.add(code);}syncFlyAlias();
		if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
			const head = Atomics.load(w, HEAD);
			if (((head - Atomics.load(w, TAIL)) >>> 0) < 64) { U16[head & 63] = e.key.charCodeAt(0); Atomics.store(w, HEAD, (head + 1) | 0); }
		} else if (e.code === 'Backspace' || e.code === 'Enter') {
			const head = Atomics.load(w, HEAD);
			if (((head - Atomics.load(w, TAIL)) >>> 0) < 64) { U16[head & 63] = e.code === 'Enter' ? 13 : 8; Atomics.store(w, HEAD, (head + 1) | 0); }
		}
	});
	addEventListener('keyup', (e) => {
		if (passThrough(e)) return;
		if(!uiTarget(e))e.preventDefault();
		const codes=pressedPhysical.get(e.code)||[];pressedPhysical.delete(e.code);held.clear();for(const list of pressedPhysical.values())for(const code of list)held.add(code);
		for(const code of codes)if(VK[code]&&!held.has(code))Atomics.store(keys,VK[code],0);syncFlyAlias();
	});
	const releaseAll = () => { pressedPhysical.clear();held.clear(); for (let i = 0; i < 256; i++) Atomics.store(keys, i, 0); Atomics.store(w, BTN, 0); };
	addEventListener('keyboard-controls-change',()=>{releaseAll();touchControls.release();controllerBridge?.release();});
	addEventListener('focusin', e=>{if(uiTarget(e)){releaseAll();controllerBridge?.release();}});
	addEventListener('focus', () => { trace('window focus'); Atomics.store(w, FOCUS, 1); });
	addEventListener('blur', () => { trace('window blur (all keys released)'); Atomics.store(w, FOCUS, 0); releaseAll(); });

	const locked = () => document.pointerLockElement === canvas;
	canvas.addEventListener('mousedown', (e) => {
		if(GTATouchControls.fromTouchMouse(e))return;
		canvas.focus({preventScroll:true});
		if (!locked()) { canvas.requestPointerLock({ unadjustedMovement: true }).catch(() => canvas.requestPointerLock()); }
		Atomics.or(w, BTN, 1 << [0, 2, 1, 3, 4][e.button]);
		e.preventDefault();
	});
	addEventListener('mouseup', (e) => { if(!GTATouchControls.fromTouchMouse(e))Atomics.and(w, BTN, ~(1 << [0, 2, 1, 3, 4][e.button])); });
	addEventListener('contextmenu', (e) => e.preventDefault());
	document.addEventListener('pointerlockchange', () => { trace('pointer lock ' + (locked() ? 'on' : 'off')); Atomics.store(w, LOCKED, locked() ? 1 : 0); });
	const mouseGain = ['0.5','1','1.5','2','3','4','6'].includes(q.get('mousegain')) ? +q.get('mousegain') : 1;
	let mouseRemainderX=0, mouseRemainderY=0;
	addEventListener('mousemove', (e) => {
		if(GTATouchControls.fromTouchMouse(e)||uiTarget(e))return;
		const r = canvas.getBoundingClientRect();
		if (locked()) {
			const dx=e.movementX*mouseGain+mouseRemainderX, dy=e.movementY*mouseGain+mouseRemainderY;
			const ix=Math.trunc(dx), iy=Math.trunc(dy);mouseRemainderX=dx-ix;mouseRemainderY=dy-iy;
			Atomics.add(w, DX, ix);
			Atomics.add(w, DY, iy);
			const x = Math.max(0, Math.min(W - 1, Atomics.load(w, MX) + e.movementX));
			const y = Math.max(0, Math.min(H - 1, Atomics.load(w, MY) + e.movementY));
			Atomics.store(w, MX, x);
			Atomics.store(w, MY, y);
		} else {
			const x = Math.max(0, Math.min(W - 1, Math.round((e.clientX - r.left) * W / r.width)));
			const y = Math.max(0, Math.min(H - 1, Math.round((e.clientY - r.top) * H / r.height)));
			Atomics.add(w, DX, x - Atomics.load(w, MX));
			Atomics.add(w, DY, y - Atomics.load(w, MY));
			Atomics.store(w, MX, x);
			Atomics.store(w, MY, y);
		}
	});
	// Notches from the real scroll distance: Chrome reports ~100 px per notch on Windows (pixel mode), 3 lines in line mode; fractions (trackpads, smooth
	// scrolling) accumulate. The engine consumes one notch per frame (browser_input_wasm.cpp), so a long scroll keeps scrolling for a few frames.
	let wheelAccum = 0;
	addEventListener('wheel', (e) => {
		if(uiTarget(e))return;
		e.preventDefault();
		wheelAccum += -e.deltaY / (e.deltaMode === 0 ? 100 : e.deltaMode === 1 ? 3 : 1);
		const n = Math.trunc(wheelAccum);
		if (n) { wheelAccum -= n; Atomics.add(w, DZ, n); }
	}, { passive: false });
}
