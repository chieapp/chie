import {Icon, apiManager} from 'chie';
import ChatGPTAPI from './chatgpt-api';

export function activate() {
  apiManager.registerAPI({
    name: 'ChatGPT API',
    apiType: ChatGPTAPI,
    auth: 'key',
    icon: new Icon({name: 'openai'}),
    description: 'Use OpenAI API key for chat.',
    url: 'https://api.openai.com/v1/chat/completions',
    priority: 10,
    params: [
      {
        name: 'model',
        type: 'string',
        readableName: 'Model',
        hasSwitcher: true,
        value: 'gpt-3.5-turbo',
        preset: [
          'gpt-3.5-turbo',
          'gpt-4',
          'gpt-4-32k',
        ],
      },
      {
        name: 'max_tokens',
        type: 'number',
        readableName: 'Max Tokens',
        description: 'The maximum number of tokens to generate.',
      },
      {
        name: 'temperature',
        type: 'number',
        readableName: 'Temperature',
        description: 'Higher values will make the output more random.',
        range: [0, 2],
        value: 1,
      },
      {
        name: 'presence_penalty',
        type: 'number',
        readableName: 'Presence Penalty',
        description: 'A higher value increases the likelihood to talk about new topics.',
        range: [-2, 2],
        value: 0,
      },
    ],
  });
}
