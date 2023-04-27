import {Icon, LoginWindow, Param, apiManager} from 'chie';
import ChatGPTWebAPI from './chatgpt-web-api';

const params: Param[] = [
  {
    name: 'token',
    type: 'string',
    readableName: 'Token',
  },
  {
    name: 'userAgent',
    type: 'string',
    readableName: 'UA',
  },
  {
    name: 'model',
    type: 'string',
    readableName: 'Model',
    value: 'text-davinci-002-render',
    preset: [
      'text-davinci-002-render',
      'gpt-4',
    ],
  },
];

export function activate() {
  apiManager.registerAPI({
    name: 'ChatGPT Web',
    apiType: ChatGPTWebAPI,
    auth: 'login',
    icon: new Icon({name: 'chatgpt'}),
    description: 'ChatGPT web backend, requires OpenAI account.',
    url: 'https://chat.openai.com/backend-api/conversation',
    priority: 9,
    params,
    login: login.bind(null, 'https://chat.openai.com/auth/login'),
    refresh: login.bind(null, 'https://chat.openai.com/'),
  });
}

async function login(firstURL) {
  const win = new LoginWindow();
  win.window.activate();
  try {
    win.browser.loadURL(firstURL);
    await win.waitForNavigation(/chat\.openai\.com\/?#?$/);
    for (;;) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Only when input shows do we know login is successful.
      const hasInput = await win.browser.executeJavaScript('document.getElementsByTagName("textarea").length');
      console.log(hasInput);
      if (hasInput)
        break;
    }
    const cookie = await win.browser.getCookie('https://chat.openai.com/');
    win.browser.loadURL('https://chat.openai.com/api/auth/session');
    await win.waitForNavigation(/\/api\/auth\/session$/);
    const session = JSON.parse(await win.browser.executeJavaScript('document.body.lastChild.textContent'));
    const userAgent = await win.browser.executeJavaScript('navigator.userAgent');
    return {cookie, params: {token: session.accessToken, userAgent}};
  } finally {
    win.close();
  }
}
