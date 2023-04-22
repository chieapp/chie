import {Signal} from 'typed-signals';

import WebService, {WebServiceOptions} from './web-service';
import {
  ChatRole,
  ChatMessage,
  ChatResponse,
  ChatCompletionAPI,
  ChatConversationAPI,
} from './chat-api';
import historyKeeper from '../controller/history-keeper';

export interface ChatServiceOptions extends WebServiceOptions {
  moment?: string;
}

export interface ChatMessageInfo {
  first: boolean;
  pending: boolean;
}

export default class ChatService extends WebService<ChatConversationAPI | ChatCompletionAPI> {
  history: ChatMessage[] = [];
  isLoaded = false;
  moment: string;

  onLoad: Signal<() => void> = new Signal;
  onNewTitle: Signal<(title: string | null) => void> = new Signal;
  onMessage: Signal<(message: ChatMessage) => void> = new Signal;
  onMessageDelta: Signal<(delta: Partial<ChatMessage>, info: ChatMessageInfo) => void> = new Signal;
  onMessageError: Signal<(error: Error) => void> = new Signal;
  onRemoveMessage: Signal<((index: number) => void)> = new Signal;
  onClearMessages: Signal<() => void> = new Signal;

  // Title of the chat.
  title?: string;

  // Whether the title is automatically generated.
  autoTitle = true;

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

  static deserialize(data: object): ChatService {
    const service = WebService.deserialize(data);
    const options: ChatServiceOptions = service.options;
    if (typeof data['moment'] == 'string')
      options.moment = data['moment'];
    return new ChatService(service.name, service.api as ChatConversationAPI | ChatCompletionAPI, options);
  }

  constructor(name: string, api: ChatConversationAPI | ChatCompletionAPI, options: ChatServiceOptions = {}) {
    if (!(api instanceof ChatCompletionAPI) &&
        !(api instanceof ChatConversationAPI))
      throw new Error('Unsupported API type');
    super(name, api, options);
    if (options.moment) {
      this.moment = options.moment;
      historyKeeper.remember(this.moment).then(value => {
        if (value.history)
          this.history = value.history.slice();
        this.title = value.title;
        this.isLoaded = true;
        this.onLoad.emit();
      });
    } else {
      if (api instanceof ChatCompletionAPI)
        this.moment = historyKeeper.newMoment();
      this.isLoaded = true;
    }
  }

  serialize() {
    const data = super.serialize();
    if (this.moment)
      data['moment'] = this.moment;
    return data;
  }

  // Remove this chat and delete its information on disk.
  async destructor() {
    super.destructor();
    this.aborter?.abort();
    if (this.moment)
      await historyKeeper.forget(this.moment);
  }

  // Send a message and wait for response.
  async sendMessage(message: Partial<ChatMessage>, options: object = {}) {
    if (this.pendingMessage)
      throw new Error('There is pending message being received.');
    // The message being sent is also notified.
    const senderMessage = new ChatMessage({
      role: message.role ?? ChatRole.User,
      content: message.content ?? '',
    });
    this.#handleMessageDelta(senderMessage, new ChatResponse({pending: false}));
    await this.#saveMoment();
    // Start sending.
    await (this.pendingPromise = this.#generateResponse(options));
  }

  // Generate a new response for the last user message.
  async regenerateResponse(options: object = {}) {
    if (this.history.length == 0)
      throw new Error('Unable to regenerate response when there is no message.');
    if (this.pendingMessage && !this.lastError)
      throw new Error('Can not regenerate when there is pending message being received.');
    if (!(this.api instanceof ChatCompletionAPI))
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
    this.lastError = null;
    this.pendingMessage = null;
    // Send a partial message to indicate the start.
    this.#handleMessageDelta(new ChatMessage({role: ChatRole.Assistant}), new ChatResponse({pending: true}));
    // Call API.
    this.aborter = new AbortController();
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
      // AbortError is not treated as error.
      if (error.name != 'AbortError') {
        this.onMessageError.emit(error);
        this.lastError = error;
        throw error;
      }
    }

    // The pendingMessage should be cleared when end of message has been
    // received, if there is no such signal and the partial message has been
    // left after API call ends, send an end signal here.
    if (this.pendingMessage) {
      this.onMessageDelta.emit({}, {first: false, pending: false});
      this.#responseEnded();
    }

    // Generate a name for the conversation.
    if (this.autoTitle &&
        this.api instanceof ChatCompletionAPI &&
        !this.#titlePromise &&
        this.history.length > 1 &&
        this.history.length < 10)
      this.#titlePromise = this.#generateName();

    await this.#saveMoment();
  }

  // Called by sub-classes when there is message delta available.
  #handleMessageDelta(delta: Partial<ChatMessage>, response: ChatResponse) {
    this.onMessageDelta.emit(delta, {first: !this.pendingMessage, pending: response.pending});

    // Concatenate to the pendingMessage.
    if (!this.pendingMessage) {
      if (!delta.role)
        throw new Error('First message delta should include role');
      this.pendingMessage = {role: delta.role ?? ChatRole.Assistant};
    }
    if (delta.content) {
      if (this.pendingMessage.content)
        this.pendingMessage.content += delta.content;
      else
        this.pendingMessage.content = delta.content;
    }

    // Send onMessage when all pending messags have been received.
    if (!response.pending) {
      if (!this.pendingMessage.role || !this.pendingMessage.content)
        throw new Error('Incomplete delta received from ChatGPT');
      this.onMessage.emit({
        role: this.pendingMessage.role,
        content: this.pendingMessage.content.trim(),
      });
      this.#responseEnded();
    }
  }

  // End of response.
  #responseEnded() {
    if (this.pendingMessage)
      this.history.push(new ChatMessage(this.pendingMessage));
    this.pendingMessage = null;
    this.pendingPromise = null;
  }

  // Generate a name for the conversation.
  async #generateName() {
    if (!(this.api instanceof ChatCompletionAPI))
      return;
    const message = new ChatMessage({
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
    });
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
    await this.#saveMoment();
  }

  // Write history to disk.
  async #saveMoment() {
    if (!this.moment)
      return;
    await historyKeeper.save(this.moment, {
      history: this.history,
      title: this.title,
    });
  }
}
