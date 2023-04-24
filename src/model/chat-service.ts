import {Signal} from 'typed-signals';

import WebService, {
  WebServiceData,
  WebServiceOptions,
} from './web-service';
import {
  ChatRole,
  ChatMessage,
  ChatResponse,
  ChatCompletionAPI,
  ChatConversationAPI,
} from './chat-api';
import serviceManager from '../controller/service-manager';
import historyKeeper from '../controller/history-keeper';

export type ChatServiceSupportedAPIs = ChatConversationAPI | ChatCompletionAPI;

export interface ChatServiceData extends WebServiceData {
  moment?: string;
}

export interface ChatServiceOptions extends WebServiceOptions<ChatServiceSupportedAPIs> {
  moment?: string;
}

interface ChatHistoryData {
  title?: string;
  session?: object;
  history?: ChatMessage[];
}

export default class ChatService extends WebService<ChatServiceSupportedAPIs> {
  history: ChatMessage[] = [];
  isLoaded = false;
  moment?: string;

  onLoad: Signal<() => void> = new Signal;
  onNewTitle: Signal<(title: string | null) => void> = new Signal;
  onUserMessage: Signal<(message: ChatMessage) => void> = new Signal;
  onClearError: Signal<() => void> = new Signal;
  onMessageBegin: Signal<() => void> = new Signal;
  onMessageDelta: Signal<(delta: Partial<ChatMessage>, response: ChatResponse) => void> = new Signal;
  onMessageError: Signal<(error: Error) => void> = new Signal;
  onMessage: Signal<(message: ChatMessage) => void> = new Signal;
  onRemoveMessage: Signal<((index: number) => void)> = new Signal;
  onClearMessages: Signal<() => void> = new Signal;

  // Title of the chat.
  title?: string;

  // Error is set if last message failed to send.
  lastError?: Error;

  // Saves concatenated content of all the received partial messages.
  pendingMessage?: Partial<ChatMessage>;

  // The job of current sendMessage call.
  pendingPromise?: Promise<void>;

  // The aborter that can be used to abort current call.
  aborter: AbortController;

  // Track generation of name.
  #titlePromise?: Promise<void>;

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
    if (options.moment) {
      // Load from saved history.
      this.moment = options.moment;
      historyKeeper.remember(this.moment).then((value?: ChatHistoryData) => {
        if (value) {
          if (value.history)
            this.history = value.history.slice();
          if (value.title)
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
    if (this.moment)
      historyKeeper.forget(this.moment);
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
    // Start sending.
    await (this.pendingPromise = this.#generateResponse(options));
  }

  // Generate a new response for the last user message, or resend on error.
  async regenerateResponse(options: object = {}) {
    if (this.history.length == 0)
      throw new Error('Unable to regenerate response when there is no message.');
    if (this.pendingMessage && !this.lastError)
      throw new Error('Can not regenerate when there is pending message being received.');
    if (this.api instanceof ChatConversationAPI && !this.lastError)
      throw new Error('Can only regenerate for ChatCompletionAPI.');
    // When last message is from assistant, do regenerate, otherwise it would
    // be the same with sending message.
    if (this.history[this.history.length - 1].role == ChatRole.Assistant) {
      this.history.pop();
      this.onRemoveMessage.emit(this.history.length);
    }
    await (this.pendingPromise = this.#generateResponse(options));
  }

  // Clear chat history.
  clear() {
    if (this.pendingMessage)
      throw new Error('Can not clear when there is pending message being received.');
    this.history = [];
    this.title = null;
    if (this.api instanceof ChatCompletionAPI)
      this.onNewTitle.emit(null);
    else if (this.api instanceof ChatConversationAPI)
      this.api.clear();
    this.onClearMessages.emit();
    if (this.moment)
      historyKeeper.forget(this.moment);
  }

  // Call the API.
  async #generateResponse(options: object) {
    // Clear error and pending message when sending new message.
    if (this.lastError)
      this.onClearError.emit();
    this.lastError = null;
    this.pendingMessage = null;
    // Call API.
    this.aborter = new AbortController();
    this.onMessageBegin.emit();
    try {
      const apiOptions = {
        ...options,
        signal: this.aborter.signal,
        onMessageDelta: this.#handleMessageDelta.bind(this),
      };
      if (this.api instanceof ChatCompletionAPI) {
        await this.api.sendConversation(this.history, apiOptions);
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

    // The pendingMessage should be cleared when end of message has been
    // received, if there is no such signal and the partial message has been
    // left after API call ends (for example aborted), send an end signal here.
    if (this.pendingMessage)
      this.#handleMessageDelta({}, {pending: false});

    // Generate a name for the conversation.
    if (this.api instanceof ChatCompletionAPI &&
        !this.#titlePromise &&
        this.history.length > 1 &&
        this.history.length < 10)
      this.#titlePromise = this.#generateName();

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
    this.pendingMessage = null;
    this.pendingPromise = null;
  }

  // Generate a name for the conversation.
  async #generateName() {
    if (!(this.api instanceof ChatCompletionAPI))
      return;
    const message = {
      role: ChatRole.System,
      content:
      `
        Name the conversation based on following chat records:
        '''
        ${this.history.map(m => m.content).join('\n\n------\n\n')}
        '''
        Provide a concise name, within 20 characters and without quotation marks,
        use the speak language used in the conversation.
        The conversation is named:
      `
    };
    let title = '';
    await this.api.sendConversation([message], {
      onMessageDelta(delta) { title += delta.content ?? ''; }
    });
    if (title.endsWith('.'))
      title = title.slice(0, -1);
    else if (title.startsWith('"') && title.endsWith('"'))
      title = title.slice(1, -1);
    this.title = title;
    this.onNewTitle.emit(title);
    this.#titlePromise = null;
    this.#saveMoment();
  }

  // Write history to disk.
  #saveMoment() {
    if (!this.moment) {
      this.moment = historyKeeper.newMoment();
      serviceManager.saveConfig();
    }
    const data: ChatHistoryData = {history: this.history};
    if (this.title)
      data.title = this.title;
    if (this.api instanceof ChatConversationAPI && this.api.session)
      data.session = this.api.session;
    historyKeeper.save(this.moment, data);
  }
}
