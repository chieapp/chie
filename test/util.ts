import APIEndpoint from '../src/model/api-endpoint';
import {ChatRole, ChatMessage, ChatResponse, ChatCompletionAPI} from '../src/model/chat-api';

class FakeAPI extends ChatCompletionAPI {
  constructor(endpoint) {
    super(endpoint);
  }
  async sendConversation(history, {onMessageDelta}) {
    onMessageDelta(
      new ChatMessage({role: ChatRole.Assistant, content: 'Reply'}),
      new ChatResponse({pending: false}));
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
