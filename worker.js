const utils = {
  tabs() {
    return chrome.tabs.query({url: 'https://web.skype.com/*'});
  },
  active({windowId, id}) {
    chrome.windows.update(windowId, {
      focused: true
    });
    chrome.tabs.update(id, {
      active: true
    });
  },
  open(url, tab) {
    chrome.tabs.create({
      url,
      index: tab.index + 1
    });
  },
  storage: {
    get(prefs) {
      return new Promise(resvolve => chrome.storage.local.get(prefs, resvolve));
    }
  },
  once(c) {
    chrome.runtime.onStartup.addListener(c);
    chrome.runtime.onInstalled.addListener(c);
  }
};

const onMessage = request => {
  if (request.cmd === 'close-me') {
    utils.tabs().then(tabs => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          cmd: 'close-me'
        });
      }
    });

    utils.storage.get({
      'auto-lock': false,
      'minutes': 30
    }).then(prefs => {
      if (prefs['auto-lock']) {
        chrome.alarms.create('lock-me', {
          when: Date.now() + prefs.minutes * 60 * 1000
        });
      }
      else {
        chrome.alarms.clear('lock-me');
      }
    });
  }
  else if (request.cmd === 'lock-me') {
    utils.tabs().then(tabs => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          cmd: 'lock-me'
        }, () => {
          const lastError = chrome.runtime.lastError;

          if (lastError) {
            chrome.tabs.reload(tab.id);
          }
        });
      }
    });
  }
};
chrome.runtime.onMessage.addListener(onMessage);

chrome.action.onClicked.addListener(async tab => {
  const tabs = await utils.tabs();

  // lock tabs when there is an open one
  if (tabs.length) {
    onMessage({
      cmd: 'lock-me'
    });

    // highlight
    if (tabs.includes(tab) === false) {
      utils.active(tabs[0]);
    }
  }
  else {
    utils.open('https://web.skype.com/', tab);
  }
});

chrome.alarms.onAlarm.addListener(({name}) => {
  if (name === 'lock-me') {
    utils.storage.get({
      'auto-lock': false
    }).then(prefs => prefs['auto-lock'] && onMessage({
      cmd: 'lock-me'
    }));
  }
});

// idle
utils.once(() => utils.storage.get({
  'idle-timeout': 10
}).then(prefs => {
  chrome.idle.setDetectionInterval(prefs['idle-timeout'] * 60);
}));
chrome.storage.onChanged.addListener(ps => {
  if (ps['idle-timeout']) {
    chrome.idle.setDetectionInterval(ps['idle-timeout'].newValue * 60);
  }
});
chrome.idle.onStateChanged.addListener(state => {
  if (state === 'idle' || state === 'locked') {
    utils.storage.get({
      'idle': true
    }).then(prefs => prefs.idle && onMessage({
      cmd: 'lock-me'
    }));
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
