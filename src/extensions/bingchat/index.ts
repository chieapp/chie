import {Icon, BrowserWindow, Param, apiManager} from 'chie';
import BingChatAPI from './bingchat-api';

const toneParam: Param = {
  name: 'tone',
  type: 'selection',
  displayName: 'Tone',
  hasSwitcher: true,
  selection: 'Balanced',
  selections: [
    {
      name: 'Creative',
      value: 'h3imaginative',
    },
    {
      name: 'Precise',
      value: 'h3precise',
    },
    {
      name: 'Balanced',
      value: 'harmonyv3',
    },
  ]
};

export function activate() {
  apiManager.registerAPI({
    name: 'BingChat',
    apiType: BingChatAPI,
    auth: 'login',
    icon: new Icon({name: 'bingchat'}),
    description: 'Chat with new Bing, requires Microsoft account.',
    priority: 8,
    params: [ toneParam ],
    login: login,
    refresh: login,
  });
}

async function login() {
  const win = new BrowserWindow();
  win.window.activate();
  const requrl = encodeURIComponent('https://www.bing.com/?wlexpsignin=1');
  win.browser.loadURL(`https://login.live.com/login.srf?wa=wsignin1.0&wreply=${requrl}&aadredir=1`);
  try {
    for (;;) {
      await win.waitForNavigation(/(.*\.)?bing\.com/);
      const cookie = await win.browser.executeJavaScript('document.cookie');
      const match = cookie.match(/(_U=)[^\s;]+/);
      if (match)
        return {cookie: match[0]};
    }
  } finally {
    win.close();
  }
}
