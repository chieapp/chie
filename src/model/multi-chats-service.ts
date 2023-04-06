import ChatService from './chat-service';
import WebService from './web-service';
import {ChatCompletionAPI} from './chat-api';

export default class MultiChatsService extends WebService<ChatCompletionAPI> {
  #chats: ChatService[] = [];

  static deserialize(config: object): MultiChatsService {
    const service = WebService.deserialize(config);
    return new MultiChatsService(service.name, service.api as ChatCompletionAPI);
  }

  constructor(name: string, api: ChatCompletionAPI) {
    if (!(api instanceof ChatCompletionAPI))
      throw new Error('MultiChatsService can only be used with ChatCompletionAPI');
    super(name, api);
  }

  createChat() {
    const chat = new ChatService(this.name, this.api);
    this.#chats.unshift(chat);
    return chat;
  }

  removeChatAt(index: number) {
    this.#chats.splice(index, 1);
  }

  clearChats() {
    this.#chats = [];
  }
}
