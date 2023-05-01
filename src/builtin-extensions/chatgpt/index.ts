import {Icon, apiManager} from 'chie';
import ChatGPTAPI from './chatgpt-api';

export function activate() {
  apiManager.registerAPI({
    name: 'ChatGPT API',
    apiType: ChatGPTAPI,
    auth: 'key',
    icon: new Icon({name: 'openai'}),
    description: `Use OpenAI API key for chat.
Note that if you don't have a credit card bound to your OpenAI account, the \
response might be very slow and rate limited. You get all features of Chie \
under this mode, but GPT-4 API access is quite hard to get.`,
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
        name: 'temperature',
        type: 'number',
        readableName: 'Temperature',
        range: [0, 2],
        value: 1,
      },
      {
        name: 'top_p',
        type: 'number',
        readableName: 'Top P',
        range: [0, 2],
        value: 1,
      },
      {
        name: 'max_tokens',
        type: 'number',
        readableName: 'Max Tokens',
      },
    ],
  });
}
