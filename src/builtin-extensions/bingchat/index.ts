import {apiManager} from 'chie';
import BingChatAPI from './bingchat-api';

export function activate() {
  apiManager.registerAPI('BingChat', BingChatAPI);
}
