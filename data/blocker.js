const run = forced => chrome.storage.local.get({
  'mode': 'each-time',
  'current': 0,
  'minutes': 30,
  'blur': true,
  'blur-value': 15
}, prefs => {
  if (prefs.mode === 'time-based' && forced !== true) {
    const now = Date.now();
    if (now - prefs.current < prefs.minutes * 60 * 1000) {
      return;
    }
  }
  if (!document.querySelector('dialog.plfsw')) {
    // open dialog
    const dialog = document.createElement('dialog');
    dialog.classList.add('plfsw');
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('/data/lock/index.html');
    dialog.append(iframe);

    document.documentElement.append(dialog);
    dialog.showModal();

    document.body.style.setProperty('--blur-value', prefs['blur-value'] + 'px');
    document.body.dataset.locked = prefs.blur;
  }
});
run();

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.cmd === 'close-me') {
    document.body.dataset.locked = false;
    // remove old blockers
    for (const e of document.querySelectorAll('dialog.plfsw')) {
      e.remove();
    }
  }
  else if (request.cmd === 'lock-me') {
    run(true);
    response(true);
  }
});

chrome.storage.onChanged.addListener(ps => {
  if (ps['blur-value']) {
    document.body.style.setProperty('--blur-value', ps['blur-value'].newValue + 'px');
  }
  if (ps.blur) {
    document.body.dataset.locked = ps.blur.newValue;
  }
});
