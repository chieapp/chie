import APIEndpoint from '../src/model/api-endpoint';
import {ChatRole, ChatCompletionAPI} from '../src/model/chat-api';

class FakeAPI extends ChatCompletionAPI {
  constructor(endpoint) {
    super(endpoint);
  }
  async sendConversation(history, {onMessageDelta}) {
    onMessageDelta({role: ChatRole.Assistant, content: 'Reply'}, {pending: false});
  }
}

export function createChatCompletionAPI() {
  const endpoint = APIEndpoint.deserialize({
    name: 'Wuhanfeiyan',
    type: 'ChatGPT',
    url: '',
    key: '',
  });
  return new FakeAPI(endpoint);
}
