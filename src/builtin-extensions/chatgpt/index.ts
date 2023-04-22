import {apiManager} from 'chie';
import ChatGPTAPI from './chatgpt-api';

export function activate() {
  apiManager.registerAPI({
    name: 'ChatGPT API',
    apiType: ChatGPTAPI,
    auth: 'key',
    description: 'OpenAI Chat API, requires an API key.',
    url: 'https://api.openai.com/v1/chat/completions',
    priority: 10,
    params: [
      {
        name: 'model',
        type: 'string',
        readableName: 'Model',
        value: 'gpt-3.5-turbo',
        preset: [
          'gpt-3.5-turbo',
          'gpt-4',
          'gpt-4-32k',
        ],
      }
    ],
  });
}
