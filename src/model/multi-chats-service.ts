import ChatService from './chat-service';
import WebService, {WebServiceOptions} from './web-service';
import {ChatCompletionAPI} from './chat-api';

export interface MultiChatsServiceOptions extends WebServiceOptions {
  chats?: ChatService[];
}

export default class MultiChatsService extends WebService<ChatCompletionAPI> {
  chats: ChatService[] = [];

  static deserialize(data: object): MultiChatsService {
    const service = WebService.deserialize(data);
    const options: MultiChatsServiceOptions = service.options;
    if (Array.isArray(data['chats']))
      options.chats = data['chats'].map(c => new ChatService(service.name, service.api as ChatCompletionAPI, c));
    return new MultiChatsService(service.name, service.api as ChatCompletionAPI, options);
  }

  constructor(name: string, api: ChatCompletionAPI, options: MultiChatsServiceOptions = {}) {
    if (!(api instanceof ChatCompletionAPI))
      throw new Error('MultiChatsService can only be used with ChatCompletionAPI');
    super(name, api, options);
    if (options.chats)
      this.chats = options.chats;
  }

  serialize() {
    const chats = this.chats.filter(c => c.moment).map(c => ({moment: c.moment}));
    return Object.assign(super.serialize(), {chats});
  }

  createChat() {
    const chat = new ChatService(this.name, this.api);
    this.chats.unshift(chat);
    return chat;
  }

  removeChatAt(index: number) {
    if (!(index in this.chats))
      throw new Error(`Invalid index for chat: ${index}.`);
    this.chats[index].remove();
    this.chats.splice(index, 1);
  }

  clearChats() {
    for (const chat of this.chats)
      chat.remove();
    this.chats = [];
  }
}
