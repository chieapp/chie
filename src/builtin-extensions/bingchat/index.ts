import {Icon, LoginWindow, apiManager} from 'chie';
import BingChatAPI from './bingchat-api';

export function activate() {
  apiManager.registerAPI({
    name: 'BingChat',
    apiType: BingChatAPI,
    auth: 'login',
    icon: new Icon({name: 'bingchat'}),
    description: 'Chat with new Bing, requires Microsoft account.',
    priority: 9,
    login: async () => {
      const win = new LoginWindow();
      win.window.activate();
      const requrl = encodeURIComponent('https://www.bing.com/?app=chie&wlexpsignin=1');
      win.browser.loadURL(`https://login.live.com/login.srf?wa=wsignin1.0&wreply=${requrl}&aadredir=1`);
      try {
        for (;;) {
          await win.waitForNavigation(/(.*\.)?bing\.com\/\?app=chie/);
          const cookie = await win.getCookie();
          const match = cookie.match(/(_U=)[^\s;]+/);
          if (match)
            return {cookie: match[0]};
        }
      } finally {
        win.close();
      }
    },
  });
}
