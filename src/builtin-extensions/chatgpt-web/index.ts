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

async function login(firstUrl) {
  const win = new LoginWindow();
  win.window.activate();
  try {
    win.browser.loadURL(firstUrl);
    await win.waitForNavigation(/chat\.openai\.com\/?#?$/);
    const cookie = await win.browser.getCookie('https://chat.openai.com/');
    win.browser.loadURL('https://chat.openai.com/api/auth/session');
    await win.waitForNavigation(/\/api\/auth\/session$/);
    const session = JSON.parse(await win.browser.getValue<string>('document.body.lastChild.textContent'));
    const userAgent = await win.browser.getValue<string>('navigator.userAgent');
    return {cookie, params: {token: session.accessToken, userAgent}};
  } finally {
    win.close();
  }
}
