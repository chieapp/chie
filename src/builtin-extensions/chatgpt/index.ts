import {apiManager} from 'chie';
import ChatGPTAPI from './chatgpt-api';

export function activate() {
  apiManager.registerAPI('ChatGPT', ChatGPTAPI);
}
