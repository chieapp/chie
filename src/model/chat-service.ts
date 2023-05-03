import {Signal} from 'typed-signals';

import WebService, {
  WebServiceData,
  WebServiceOptions,
} from './web-service';
import apiManager from '../controller/api-manager';
import serviceManager from '../controller/service-manager';
import historyKeeper from '../controller/history-keeper';
import {
  ChatRole,
  ChatMessage,
  ChatResponse,
  ChatCompletionAPI,
  ChatConversationAPI,
  ChatConversationAPIType,
} from './chat-api';
import {deepAssign} from '../util/object-utils';

export type ChatServiceSupportedAPIs = ChatConversationAPI | ChatCompletionAPI;

export interface ChatServiceData extends WebServiceData {
  moment?: string;
}

export interface ChatServiceOptions extends WebServiceOptions<ChatServiceSupportedAPIs> {
  moment?: string;
}

interface ChatHistoryData {
  title?: string;
  customTitle?: string;
  session?: object;
  history?: ChatMessage[];
}

interface ChatServiceParams {
  systemPrompt?: string;
  contextLength?: number;
}

export default class ChatService extends WebService<ChatServiceSupportedAPIs, ChatServiceParams> {
  static services: Record<number, ChatService> = {};
  static nextId = 0;
  static fromId = (id: number) => ChatService.services[id];

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
  id: number = ++ChatService.nextId;

  // Current chat messages.
  history: ChatMessage[] = [];

  // Whether the chat messages have be recovered from disk.
  isLoaded = false;

  // ID of the chat history kept on disk.
  moment?: string;

  // Title of the chat.
  customTitle?: string;
  title?: string;

  // Error is set if last message failed to send.
  lastError?: Error;

  // Whether there is a message being sent.
  isPending = false;

  // Saves concatenated content of all the received partial messages.
  pendingMessage?: Partial<ChatMessage>;

  // The aborter that can be used to abort current call.
  aborter: AbortController;

  // Track generation of title.
  #titlePromise?: Promise<string | void>;

  static deserialize(data: ChatServiceData): ChatServiceOptions {
    const options = WebService.deserialize(data) as ChatServiceOptions;
    if (typeof data.moment == 'string')
      options.moment = data.moment;
    return options;
  }

  constructor(options: ChatServiceOptions) {
    if (!(options.api instanceof ChatCompletionAPI) &&
        !(options.api instanceof ChatConversationAPI))
      throw new Error('Unsupported API type');
    super(options);
    ChatService.services[this.id] = this;
    if (options.moment) {
      // Load from saved history.
      this.moment = options.moment;
      historyKeeper.remember(this.moment).then((value?: ChatHistoryData) => {
        if (value) {
          if (value.history)
            this.history = value.history.slice();
          if (value.customTitle)
            this.customTitle = value.customTitle;
          else if (value.title)
            this.title = value.title;
          if (options.api instanceof ChatConversationAPI && value.session)
            options.api.session = value.session;
        }
        this.isLoaded = true;
        this.onLoad.emit();
      });
    } else {
      this.isLoaded = true;
    }
  }

  serialize() {
    const data: ChatServiceData = super.serialize();
    if (this.moment)
      data.moment = this.moment;
    return data;
  }

  // Remove this chat and delete its information on disk.
  destructor() {
    super.destructor();
    this.aborter?.abort();
    this.#clearResources();
    delete ChatService.services[this.id];
  }

  // Send a message and wait for response.
  async sendMessage(message: Partial<ChatMessage>, options: object = {}) {
    if (this.pendingMessage)
      throw new Error('There is pending message being received.');
    const senderMessage = {
      role: message.role ?? ChatRole.User,
      content: message.content ?? '',
    };
    this.history.push(senderMessage);
    this.onUserMessage.emit(senderMessage);
    this.#saveMoment();
    // Start sending.
    this.isPending = true;
    try {
      await this.#invokeChatAPI(options);
    } finally {
      this.isPending = false;
    }
  }

  // Resend or regenerate.
  async regenerateLastResponse(options: object = {}) {
    if (!this.canRegenerateLastResponse())
      throw new Error('Unable to regenerate last response.');
    // If last message is from user, then we just need to resend.
    if (this.history[this.history.length - 1].role == ChatRole.User) {
      this.isPending = true;
      try {
        await this.#invokeChatAPI(options);
      } finally {
        this.isPending = false;
      }
      return;
    }
    // For assistant message, we need to remove it and regenerate.
    if (this.history[this.history.length - 1].role == ChatRole.Assistant)
      return await this.regenerateFrom(-1, options);
    // We don't support other cases.
    throw new Error('Can not regenerate from last message');
  }

  // Remove last messages and regenerate response.
  async regenerateFrom(index: number = -1, options: object = {}) {
    if (this.history.length == 0)
      throw new Error('Unable to regenerate when there is no message.');
    if (this.isPending)
      throw new Error('Can not regenerate when there is pending message being received.');
    if (index < 0)  // support negative index
      index += this.history.length;
    if (index == 0)
      throw new Error('Can not regenerate from the root message.');
    if (index < 0 || index >= this.history.length)
      throw new Error('Index is out of range.');
    if (this.api instanceof ChatConversationAPI) {
      if (this.history[index - 1].role != ChatRole.User)
        throw new Error('ChatConversationAPI requires last message to be from user.');
      if (!(this.api.constructor as ChatConversationAPIType<ChatServiceSupportedAPIs>).canRemoveMessagesAfter)
        throw new Error('The API does not have ability for regeneration.');
    }
    // Remove the messages from history.
    this.history.splice(index);
    this.onRemoveMessagesAfter.emit(index);
    this.isPending = true;
    try {
      // Tell ChatConversationAPI to remove message records.
      // Note that we are removing one more message (which is guaranteed to be
      // the user's message), because when calling the API we have to send the
      // user message again and we don't want it to be duplicated in server.
      if (this.api instanceof ChatConversationAPI)
        await this.api.removeMessagesAfter(index - 1);
      await this.#invokeChatAPI(options);
    } finally {
      this.isPending = false;
    }
  }

  // Edit chat history.
  updateMessage(message: Partial<ChatMessage>, index: number) {
    const target = this.history[index];
    if (!target)
      throw new Error(`Invalid index ${index}.`);
    deepAssign(target, message);
    this.onUpdateMessage.emit(target, index);
  }

  // Clear chat history.
  clear() {
    if (this.pendingMessage)
      throw new Error('Can not clear when there is pending message being received.');
    this.history = [];
    this.title = null;
    this.lastError = null;
    this.onNewTitle.emit(null);
    this.#clearResources();
    this.onClearMessages.emit();
  }

  // Whether user can do regeneration for last message, can be used for
  // validating the reload button.
  canRegenerateLastResponse() {
    if (this.history.length == 0)
      return false;
    if (this.isPending)
      return false;
    if (this.history[this.history.length - 1].role == ChatRole.User)
      return true;
    if (this.history[this.history.length - 1].role == ChatRole.Assistant &&
        this.canEditMessages())
      return true;
    return false;
  }

  // Helper to know whether this service supports message editing.
  canEditMessages() {
    if (this.api instanceof ChatCompletionAPI)
      return true;
    if (this.api instanceof ChatConversationAPI &&
        (this.api.constructor as ChatConversationAPIType<ChatServiceSupportedAPIs>).canRemoveMessagesAfter)
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
    this.#saveMoment();
  }

  // Call the API.
  async #invokeChatAPI(options: object) {
    // Clear error and pending message when sending new message.
    if (this.lastError)
      this.onClearError.emit();
    this.lastError = null;
    this.pendingMessage = null;
    this.aborter = new AbortController();
    this.onMessageBegin.emit();
    // ChatConversationAPI usually don't like sending multiple conversations
    // at the same time, so wait for title generation to end.
    if (this.api instanceof ChatConversationAPI && this.#titlePromise)
      await this.#titlePromise;
    // Call API.
    try {
      const apiOptions = {
        ...options,
        signal: this.aborter.signal,
        onMessageDelta: this.#handleMessageDelta.bind(this),
      };
      if (this.api instanceof ChatCompletionAPI) {
        let conversation = this.history;
        if (this.params?.contextLength)
          conversation = conversation.slice(-this.params.contextLength);
        if (this.params?.systemPrompt)
          conversation = [{role: ChatRole.System, content: this.params.systemPrompt}, ...conversation];
        await this.api.sendConversation(conversation, apiOptions);
      } else if (this.api instanceof ChatConversationAPI) {
        await this.api.sendMessage(this.history[this.history.length - 1].content, apiOptions);
      }
    } catch (error) {
      // Interrupting a pending message is not treated as error.
      if (!(this.pendingMessage?.content && error.name == 'AbortError')) {
        this.lastError = error;
        this.onMessageError.emit(error);
        return;
      }
    }

    if (this.pendingMessage) {
      // The pendingMessage should be cleared when end of message has been
      // received, if there is no such signal and the partial message has been
      // left after API call ends (for example aborted), send an end signal here.
      this.#handleMessageDelta({}, {pending: false});
    } else if (this.isPending) {
      // If we have never received any message, then it is likely the server
      // refused our connection for some reason.
      this.lastError = new Error('Server closed connection.');
      this.onMessageError.emit(this.lastError);
      return;
    }

    // Generate a title for the conversation.
    if (!this.customTitle && !this.#titlePromise && !this.aborter?.signal.aborted) {
      this.#titlePromise = this.#generateTitle()
        .catch(() => { /* ignore error */ })
        .finally(() => this.#titlePromise = null);
    }

    this.#saveMoment();
  }

  // Called by sub-classes when there is message delta available.
  #handleMessageDelta(delta: Partial<ChatMessage>, response: ChatResponse) {
    this.onMessageDelta.emit(delta, response);

    // Concatenate to the pendingMessage.
    if (!this.pendingMessage) {
      if (!delta.role)
        throw new Error('First message delta should include role');
      this.pendingMessage = {role: delta.role ?? ChatRole.Assistant};
    }
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

    // Send onMessage when all pending messages have been received.
    if (!response.pending) {
      if (!this.pendingMessage.role || !this.pendingMessage.content)
        throw new Error('Incomplete delta received from API');
      const message = {
        role: this.pendingMessage.role,
        content: this.pendingMessage.content.trim(),
      };
      // Should clear pendingMessage before emitting onMessage.
      this.#responseEnded();
      this.onMessage.emit(message);
    }
  }

  // End of response.
  #responseEnded() {
    if (this.pendingMessage)
      this.history.push(this.pendingMessage as ChatMessage);
    this.isPending = false;
    this.pendingMessage = null;
  }

  // Generate a name for the conversation.
  async #generateTitle() {
    let conversation = this.history.map(m => m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content);
    if (this.params?.systemPrompt)
      conversation = [this.params.systemPrompt, ...conversation];
    const prompt = `Name the conversation based on following chat records:
'''
${conversation.join('\n\n------\n\n')}
'''
Provide a concise name, within 15 characters and without quotation marks,
use the speak language used in the conversation.
The conversation is named:
`;
    let title = '';
    if (this.api instanceof ChatCompletionAPI) {
      if (this.history.length > 10)
        return;
      const message = {role: ChatRole.System, content: prompt};
      await this.api.sendConversation([message], {
        signal: this.aborter.signal,
        onMessageDelta(delta) { title += delta.content ?? ''; }
      });
    } else if (this.canEditMessages()) {
      if (this.history.length > 10)
        return;
      // Spawn a new conversation to ask for title generation,
      const api = apiManager.createAPIForEndpoint(this.api.endpoint) as ChatConversationAPI;
      await api.sendMessage(prompt, {
        signal: this.aborter.signal,
        onMessageDelta(delta) { title += delta.content ?? ''; }
      });
      // Clear the temporary conversation.
      await api.removeFromServer();
    } else {
      // Return the first words of last message.
      const words = this.history[this.history.length - 1].content.substring(0, 30).split(' ').slice(0, 5);
      if (words.length < 3) {
        // Likely a language without spaces in words.
        title = words[0].substring(0, 10);
      } else {
        // Join the words but do not exceed 15 characters.
        for (const word of words) {
          title += word + ' ';
          if (title.length > 15)
            break;
        }
      }
      // Do a fake await since this method is async.
      await new Promise(resolve => setImmediate(resolve));
    }
    this.#setTitle(title.trim());
  }

  #setTitle(title: string | null) {
    if (!title)
      return;
    if (title.endsWith('.'))
      title = title.slice(0, -1);
    else if (title.startsWith('"') && title.endsWith('"'))
      title = title.slice(1, -1);
    this.title = title;
    this.onNewTitle.emit(title);
    this.#saveMoment();
  }

  #clearResources() {
    if (this.api instanceof ChatConversationAPI) {
      if ((this.api.constructor as ChatConversationAPIType<ChatServiceSupportedAPIs>).canRemoveFromServer)
        this.api.removeFromServer().catch(() => { /* Ignore error */ });
      this.api.session = null;
    }
    if (this.moment)
      historyKeeper.forget(this.moment);
  }

  // Write history to disk.
  #saveMoment() {
    if (!this.moment) {
      this.moment = historyKeeper.newMoment();
      serviceManager.saveConfig();
    }
    const data: ChatHistoryData = {history: this.history};
    if (this.customTitle)
      data.customTitle = this.customTitle;
    else if (this.title)
      data.title = this.title;
    if (this.api instanceof ChatConversationAPI && this.api.session)
      data.session = this.api.session;
    historyKeeper.save(this.moment, data);
  }
}
