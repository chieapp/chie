import {Signal} from 'typed-signals';

import BaseChatService, {
  BaseChatServiceOptions,
} from '../model/base-chat-service';
import Icon from '../model/icon';
import WebAPI from '../model/web-api';
import WebService, {
  WebServiceData,
  WebServiceOptions,
} from '../model/web-service';
import serviceManager from '../controller/service-manager';
import {collectGarbage} from '../controller/gc-center';
import {isEmptyObject, shallowEqual} from '../util/object-utils';

interface ChildData<P extends object> {
  moment: string;
  title?: string;
  apiParams?: Record<string, string>;
  params?: P;
}

export interface BaseMultiChatsServiceData<P extends object = object> extends WebServiceData {
  chats?: ChildData<P>[];
}

type BaseChatServiceConstructorType<T extends WebAPI, P extends object> = new (options: BaseChatServiceOptions<T, P>) => BaseChatService<T, P>;

export interface BaseMultiChatsServiceOptions<T extends WebAPI = WebAPI, P extends object = object> extends WebServiceOptions<T, P> {
  chats?: ChildData<P>[];
}

export default class BaseMultiChatsService<T extends WebAPI = WebAPI, P extends object = object> extends WebService<T, P> {
  chatServiceType: BaseChatServiceConstructorType<T, P>;
  chats: BaseChatService<T, P>[];

  onNewChat: Signal<(chat: BaseChatService<T, P>) => void> = new Signal;
  onRemoveChat: Signal<(index: number) => void> = new Signal;
  onClearChats: Signal<() => void> = new Signal;

  static deserialize(data: BaseMultiChatsServiceData) {
    const options = WebService.deserialize(data) as BaseMultiChatsServiceOptions;
    if (Array.isArray(data.chats))
      options.chats = data.chats;
    return options;
  }

  constructor(chatServiceType: BaseChatServiceConstructorType<T, P>, options: BaseMultiChatsServiceOptions<T, P>) {
    super(options);
    this.chatServiceType = chatServiceType;
    if (options.chats) {
      this.chats = options.chats.map(({moment, title, apiParams, params}) => new this.chatServiceType({
        moment,
        title,
        name: options.name,
        icon: options.icon,
        api: options.api.clone() as T,
        apiParams: apiParams ?? options.apiParams,
        params: params ?? options.params,
      }));
    } else {
      this.chats = [];
      this.createChat();
    }
  }

  serialize() {
    const data: BaseMultiChatsServiceData<P> = super.serialize();
    data.chats = this.chats.filter(service => service.moment).map(service => {
      const data: ChildData<P> = {moment: service.moment};
      if (service.getTitle())
        data.title = service.getTitle();
      if (!isEmptyObject(service.api.params) &&
          !shallowEqual(this.api.params, service.api.params)) {
        data.apiParams = service.api.params;
      }
      if (!isEmptyObject(this.params) &&
          !shallowEqual(this.params, service.params)) {
        data.params = service.params;
      }
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

  setAPIParam(name: string, value: string) {
    if (super.setAPIParam(name, value)) {
      this.chats.forEach(c => c.setAPIParam(name, value));
      return true;
    }
    return false;
  }

  setAPIParams(params: Record<string, string>) {
    if (super.setAPIParams(params)) {
      this.chats.forEach(c => c.setAPIParams(params));
      return true;
    }
    return false;
  }

  setParam(name, value) {
    if (super.setParam(name, value)) {
      this.chats.forEach(c => c.setParam(name, value));
      return true;
    }
    return false;
  }

  setParams(params) {
    if (super.setParams(params)) {
      this.chats.forEach(c => c.setParams(params));
      return true;
    }
    return false;
  }

  createChat() {
    const chat = new this.chatServiceType({
      name: this.name,
      api: this.api.clone() as T,
      apiParams: this.api.params,
      params: this.params,
      icon: this.icon,
    });
    this.chats.unshift(chat);
    this.onNewChat.emit(chat);
    serviceManager.saveConfig();
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
    serviceManager.saveConfig();
    collectGarbage();
  }

  clearChats() {
    for (const chat of this.chats)
      chat.destructor();
    this.chats = [];
    this.onClearChats.emit();
    this.createChat();
    serviceManager.saveConfig();
    collectGarbage();
  }
}
