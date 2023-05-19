import {Signal} from 'typed-signals';

import WebAPI from '../model/web-api';
import WebService, {WebServiceData, WebServiceOptions} from '../model/web-service';
import historyKeeper from '../controller/history-keeper';
import serviceManager from '../controller/service-manager';
import titleGenerator from '../controller/title-generator';
import {ChatRole, ChatMessage, ChatResponse} from '../model/chat-api';
import {deepAssign} from '../util/object-utils';

export interface BaseChatHistoryData {
  title?: string;
  customTitle?: string;
  history?: ChatMessage[];
}

export interface BaseChatServiceData extends WebServiceData {
  moment?: string;
}

export interface BaseChatServiceOptions<T extends WebAPI = WebAPI, P extends object = object> extends WebServiceOptions<T, P> {
  moment?: string;
}

export interface SendMessageOptions {
  signal?: AbortSignal;
}

export default abstract class BaseChatService<T extends WebAPI = WebAPI, P extends object = object> extends WebService<T, P> {
  // A global map of chat services, mainly used by MessagesView to lookup in the
  // custom protocol handler.
  static services: Record<number, BaseChatService> = {};
  static nextId = 0;
  static fromId = (id: number) => BaseChatService.services[id];

  onLoad: Signal<() => void> = new Signal;
  onNewTitle: Signal<(title: string | null) => void> = new Signal;
  onUserMessage: Signal<(message: ChatMessage) => void> = new Signal;
  onClearError: Signal<() => void> = new Signal;
  onMessageBegin: Signal<() => void> = new Signal;
  onMessageDelta: Signal<(delta: Partial<ChatMessage>, response: ChatResponse) => void> = new Signal;
  onMessageError: Signal<(error: Error) => void> = new Signal;
  onMessage: Signal<(message: ChatMessage) => void> = new Signal;
  onRemoveMessagesAfter: Signal<((index: number) => void)> = new Signal;
  onUpdateMessage: Signal<((message: ChatMessage, index: number) => void)> = new Signal;
  onClearMessages: Signal<() => void> = new Signal;

  // Auto increasing ID.
  id: number = ++BaseChatService.nextId;

  // Whether the chat messages have be recovered from disk.
  isLoaded;

  // ID of the chat history kept on disk.
  moment?: string;

  // Current chat messages.
  history: ChatMessage[] = [];

  // Error is set if last message failed to send.
  lastError?: Error;

  // Whether there is a message being sent.
  pending = false;

  // Saves concatenated content of all the received partial messages.
  pendingMessage?: Partial<ChatMessage>;

  // The aborter that can be used to abort current call.
  aborter: AbortController;

  // Title of the chat.
  protected customTitle?: string;
  protected title?: string;
  // The promise of current generateTitle call.
  protected titlePromise?: Promise<void>;

  static deserialize(data: BaseChatServiceData): WebServiceOptions {
    const options = WebService.deserialize(data) as BaseChatServiceOptions;
    if (typeof data.moment == 'string')
      options.moment = data.moment;
    return options;
  }

  constructor(options: BaseChatServiceOptions<T, P>) {
    super(options);
    BaseChatService.services[this.id] = this;
    if (options.moment) {
      // Load from saved history.
      this.isLoaded = false;
      this.moment = options.moment;
      historyKeeper.remember(this.moment).then((data?: BaseChatHistoryData) => {
        if (data)
          this.deserializeHistory(data);
        this.isLoaded = true;
        this.onLoad.emit();
      });
    } else {
      this.isLoaded = true;
    }
  }

  serialize() {
    const data: BaseChatServiceData = super.serialize();
    if (this.moment)
      data.moment = this.moment;
    return data;
  }

  // Remove this chat and delete its information on disk.
  destructor() {
    super.destructor();
    this.aborter?.abort();
    this.removeTrace();
    delete BaseChatService.services[this.id];
  }

  // Restore from serialized history data.
  deserializeHistory(data: BaseChatHistoryData) {
    if (data.history)
      this.history = data.history.slice();
    if (data.customTitle)
      this.customTitle = data.customTitle;
    else if (data.title)
      this.title = data.title;
  }

  // Return the serialized history data.
  serializeHistory() {
    const data: BaseChatHistoryData = {history: this.history};
    if (this.customTitle)
      data.customTitle = this.customTitle;
    else if (this.title)
      data.title = this.title;
    return data;
  }

  // Must be implemented by sub-class to invoke the actual chat API.
  abstract sendHistoryAndGetResponse(options: SendMessageOptions): Promise<void>;

  // Whether this service supports regenerating remove from index.
  abstract canRegenerateFrom(): boolean;

  // Remove all messages after index (including message at index), only called
  // when |canRegenerateFrom()| returns true.
  // It should usually be overriden by sub-class when it needs to communicate
  // with server.
  async removeMessagesAfter(index: number) {
    this.history.splice(index);
    this.onRemoveMessagesAfter.emit(index);
  }

  // Remove resources left on filesystem or server.
  async removeTrace() {
    if (this.moment)
      historyKeeper.forget(this.moment);
  }

  // Send a message and wait for response.
  async sendMessage(message: Partial<ChatMessage>) {
    if (this.pendingMessage)
      throw new Error('There is pending message being received.');
    const senderMessage = {
      role: message.role ?? ChatRole.User,
      content: message.content ?? '',
    };
    this.history.push(senderMessage);
    this.onUserMessage.emit(senderMessage);
    this.saveHistory();
    // Start sending.
    this.pending = true;
    try {
      await this.invokeChatAPI();
    } finally {
      this.pending = false;
      // Generate a title for the conversation.
      if (!this.customTitle && !this.titlePromise && !this.isAborted()) {
        this.titlePromise = this.generateTitle()
          .catch(() => { /* ignore error */ })
          .finally(() => this.titlePromise = null);
      }
    }
  }

  // Called when user clicks the reload button, should usually resend last user
  // message or regenerate last bot message.
  async regenerateLastResponse() {
    if (!this.canRegenerateLastResponse())
      throw new Error('Unable to regenerate last response.');
    // If last message is from user, then we just need to resend.
    if (this.history[this.history.length - 1].role == ChatRole.User) {
      this.pending = true;
      try {
        await this.invokeChatAPI();
      } finally {
        this.pending = false;
      }
      return;
    }
    // For assistant message, we need to remove it and regenerate.
    if (this.history[this.history.length - 1].role == ChatRole.Assistant)
      return await this.regenerateFrom(-1);
    // We don't support other cases.
    throw new Error('Can not regenerate from last message');
  }

  // Remove last messages and regenerate response.
  async regenerateFrom(index: number) {
    if (!this.canRegenerateFrom())
      throw new Error('Unable to regenerate response.');
    if (this.history.length == 0)
      throw new Error('Unable to regenerate when there is no message.');
    if (this.pending)
      throw new Error('Can not regenerate when there is pending message being received.');
    if (index < 0)  // support negative index
      index += this.history.length;
    if (index == 0)
      throw new Error('Can not regenerate from the root message.');
    if (index < 0 || index >= this.history.length)
      throw new Error('Index is out of range.');
    this.pending = true;
    try {
      // Remove messages from history.
      await this.removeMessagesAfter(index);
      // Request for new response.
      await this.invokeChatAPI();
    } finally {
      this.pending = false;
    }
  }

  // Edit chat message in history without resending.
  async updateMessage(message: Partial<ChatMessage>, index: number) {
    const target = this.history[index];
    if (!target)
      throw new Error(`Invalid index ${index}.`);
    deepAssign(target, message);
    this.onUpdateMessage.emit(target, index);
  }

  // Clear chat history.
  clear() {
    if (this.pending)
      throw new Error('Can not clear when there is pending message being received.');
    this.history = [];
    this.title = null;
    this.lastError = null;
    this.removeTrace();
    this.onNewTitle.emit(null);
    this.onClearMessages.emit();
  }

  // Whether user can do regeneration for last message, can be used for
  // validating the reload button.
  canRegenerateLastResponse() {
    if (this.history.length == 0)
      return false;
    if (this.pending)
      return false;
    if (this.history[this.history.length - 1].role == ChatRole.User)
      return true;
    if (this.history[this.history.length - 1].role == ChatRole.Assistant &&
        this.canRegenerateFrom())
      return true;
    return false;
  }

  // Titles.
  getTitle() {
    return this.customTitle ?? this.title;
  }

  setCustomTitle(title: string) {
    this.customTitle = title;
    this.onNewTitle.emit(title);
    this.saveHistory();
  }

  // Abort current message.
  abort() {
    this.aborter?.abort();
  }

  isAborted() {
    return this.aborter?.signal.aborted;
  }

  // Wraps the API call with failure handling.
  protected async invokeChatAPI() {
    // Clear error and pending message when sending new message.
    if (this.lastError)
      this.onClearError.emit();
    this.lastError = null;
    this.pendingMessage = null;
    this.aborter = new AbortController();
    this.onMessageBegin.emit();
    // Wait for title generation to finish to avoid sending too much requests.
    if (this.titlePromise)
      await this.titlePromise;
    // Call API.
    try {
      await this.sendHistoryAndGetResponse({signal: this.aborter.signal});
    } catch (error) {
      // Interrupting a pending message is not treated as error.
      if (!(this.pendingMessage?.content && error.name == 'AbortError')) {
        this.notifyMessageError(error);
        return;
      }
    }

    if (this.pendingMessage) {
      // The pendingMessage should be cleared when end of message has been
      // received, if there is no such signal and the partial message has been
      // left after API call ends (for example aborted), send an end signal here.
      this.notifyMessageDelta({}, {pending: false});
    } else if (this.pending) {
      // If we have never received any message, then it is likely the server
      // refused our connection for some reason.
      this.notifyMessageError(new Error('Server closed connection.'));
    }

    this.saveHistory();
  }

  // Generate a title for the chat.
  protected async generateTitle() {
    let title = await titleGenerator.generateForConversation(this.history, this.api, this.aborter?.signal);
    if (title.startsWith('"') && title.endsWith('"'))
      title = title.slice(1, -1);
    if (title.endsWith('.'))
      title = title.slice(0, -1);
    this.title = title;
    this.onNewTitle.emit(title);
    this.saveHistory();
  }

  // Error happened when requesting chat response.
  protected notifyMessageError(error: Error) {
    this.lastError = error;
    this.onMessageError.emit(error);
  }

  // Called by sub-class when there is message delta available.
  protected notifyMessageDelta(delta: Partial<ChatMessage>, response: ChatResponse) {
    this.onMessageDelta.emit(delta, response);

    // Concatenate to the pendingMessage.
    if (!this.pendingMessage)
      this.pendingMessage = {role: delta.role ?? ChatRole.Assistant};
    if (delta.steps) {
      if (this.pendingMessage.steps)
        this.pendingMessage.steps.push(...delta.steps);
      else
        this.pendingMessage.steps = delta.steps;
    }
    if (delta.content) {
      if (this.pendingMessage.content)
        this.pendingMessage.content += delta.content;
      else
        this.pendingMessage.content = delta.content;
    }
    if (delta.links) {
      if (this.pendingMessage.links)
        this.pendingMessage.links.push(...delta.links);
      else
        this.pendingMessage.links = delta.links;
    }

    if (response.pending)
      return;
    if (!this.pendingMessage.role || !this.pendingMessage.content)
      throw new Error('Incomplete delta received from API');

    // Send onMessage when all pending messages have been received.
    const message = {
      role: this.pendingMessage.role,
      content: this.pendingMessage.content.trim(),
    };
    // Should clear pendingMessage before emitting onMessage.
    this.history.push(this.pendingMessage as ChatMessage);
    this.pending = false;
    this.pendingMessage = null;
    this.onMessage.emit(message);
  }

  // Write history to disk.
  protected saveHistory() {
    if (!this.moment) {
      this.moment = historyKeeper.newMoment();
      serviceManager.saveConfig();
    }
    historyKeeper.save(this.moment, this.serializeHistory());
  }
}
