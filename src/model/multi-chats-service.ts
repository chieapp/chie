import {Signal} from 'typed-signals';

import ChatService, {ChatServiceSupportedAPIs} from './chat-service';
import Icon from '../model/icon';
import WebService, {
  WebServiceData,
  WebServiceOptions,
} from './web-service';
import apiManager from '../controller/api-manager';
import WebAPI from './web-api';
import {ChatCompletionAPI, ChatConversationAPI} from './chat-api';

interface ChildChatServiceData {
  moment: string;
  params?: Record<string, string>;
}

export interface MultiChatsServiceData extends WebServiceData {
  chats?: ChildChatServiceData[];
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
    if (Array.isArray(data.chats)) {
      options.chats = data.chats.map(({moment, params}) => new ChatService({
        moment,
        name: options.name,
        api: cloneAPI<ChatServiceSupportedAPIs>(options.api),
        icon: options.icon,
        params: params ?? options.params,
      }));
    }
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
    data.chats = this.chats.filter(service => service.moment).map(service => {
      const data: ChildChatServiceData = {moment: service.moment};
      if (service.api.params && Object.keys(service.api.params).length >0)
        data.params = service.api.params;
      return data;
    });
    return data;
  }

  destructor() {
    super.destructor();
    for (const chat of this.chats)
      chat.destructor();
    this.chats = [];
  }

  setName(name: string) {
    if (super.setName(name)) {
      this.chats.forEach(c => c.setName(name));
      return true;
    }
    return false;
  }

  setIcon(icon: Icon) {
    if (super.setIcon(icon)) {
      this.chats.forEach(c => c.setIcon(icon));
      return true;
    }
    return false;
  }

  setParam(name: string, value: string) {
    if (super.setParam(name, value)) {
      this.chats.forEach(c => c.setParam(name, value));
      return true;
    }
    return false;
  }

  setParams(params: Record<string, string>) {
    if (super.setParams(params)) {
      this.chats.forEach(c => c.setParams(params));
      return true;
    }
    return false;
  }

  createChat() {
    const chat = new ChatService({
      name: this.name,
      api: cloneAPI<ChatServiceSupportedAPIs>(this.api),
      params: this.api.params,
      icon: this.icon,
    });
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

function cloneAPI<T extends WebAPI>(api: T) {
  return apiManager.createAPIForEndpoint(api.endpoint) as T;
}
