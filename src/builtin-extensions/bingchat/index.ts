import {apiManager} from 'chie';
import BingChatAPI from './bingchat-api';

export function activate() {
  apiManager.registerAPI({
    name: 'BingChat',
    apiType: BingChatAPI,
    auth: 'login',
    description: 'Chat with new Bing, requires Microsoft account.',
    priority: 9,
  });
}
