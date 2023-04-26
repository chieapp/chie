import {Signal} from 'typed-signals';

import ChatService, {ChatServiceSupportedAPIs} from './chat-service';
import WebService, {
  WebServiceData,
  WebServiceOptions,
} from './web-service';
import {ChatCompletionAPI, ChatConversationAPI} from './chat-api';

export interface MultiChatsServiceData extends WebServiceData {
  chats?: string[];
}

export interface MultiChatsServiceOptions extends WebServiceOptions<ChatServiceSupportedAPIs> {
  chats?: ChatService[];
}

export default class MultiChatsService extends WebService<ChatServiceSupportedAPIs> {
  chats: ChatService[];

  onNewChat: Signal<(chat: ChatService) => void> = new Signal;
  onRemoveChat: Signal<(index: number) => void> = new Signal;
  onClearChats: Signal<() => void> = new Signal;

  static deserialize(data: MultiChatsServiceData): MultiChatsServiceOptions {
    const options = WebService.deserialize(data) as MultiChatsServiceOptions;
    if (Array.isArray(data.chats))
      options.chats = data.chats.map(moment => new ChatService(Object.assign({moment}, options)));
    return options;
  }

  constructor(options: MultiChatsServiceOptions) {
    if (!(options.api instanceof ChatCompletionAPI) &&
        !(options.api instanceof ChatConversationAPI))
      throw new Error('MultiChatsService does not support passed API.');
    super(options);
    this.chats = options.chats ?? [];
  }

  serialize() {
    const data: MultiChatsServiceData = super.serialize();
    data.chats = this.chats.filter(c => c.moment).map(c => c.moment);
    return data;
  }

  destructor() {
    super.destructor();
    for (const chat of this.chats)
      chat.destructor();
    this.chats = [];
  }

  createChat() {
    const chat = new ChatService({name: this.name, api: this.api, icon: this.icon});
    this.chats.unshift(chat);
    this.onNewChat.emit(chat);
    return chat;
  }

  removeChatAt(index: number) {
    if (!(index in this.chats))
      throw new Error(`Invalid index for chat: ${index}.`);
    this.chats[index].destructor();
    this.chats.splice(index, 1);
    this.onRemoveChat.emit(index);
    if (this.chats.length == 0)
      this.createChat();
  }

  clearChats() {
    for (const chat of this.chats)
      chat.destructor();
    this.chats = [];
    this.onClearChats.emit();
    this.createChat();
  }
}
