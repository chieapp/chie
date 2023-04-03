import {Signal} from 'typed-signals';
import {
  ChatRole,
  ChatMessage,
  ChatResponse,
  ChatAPI,
  ChatCompletionAPI,
  ChatConversationAPI,
} from './chat-api';

export default class ChatService {
  name: string;
  api: ChatAPI;
  history: ChatMessage[] = [];

  onTitle: Signal<(title: string) => void> = new Signal;
  onMessage: Signal<(message: ChatMessage, response: ChatResponse) => void> = new Signal;
  onMessageDelta: Signal<(delta: Partial<ChatMessage>, response: ChatResponse) => void> = new Signal;

  // Abilities.
  canRegenerate: boolean;

  // Saves concatenated content of all the received partial messages.
  pendingMessage?: Partial<ChatMessage>;

  // The response of last partial message.
  #lastResponse?: ChatResponse;

  // Track generation of title.
  #titlePromise?: Promise<void>;

  constructor(name: string, api: ChatAPI) {
    if (!name || !api)
      throw new Error('Must pass name and api to ChatService');
    if (!(api instanceof ChatCompletionAPI) &&
        !(api instanceof ChatConversationAPI))
      throw new Error('Unsupported API type');
    this.name = name;
    this.api = api;
    this.canRegenerate = api instanceof ChatCompletionAPI;
  }

  // Send a message and wait for response.
  async sendMessage(message: Partial<ChatMessage>, options: {signal?: AbortSignal} = {}) {
    if (this.pendingMessage)
      throw new Error('There is pending message being received.');
    this.history.push(new ChatMessage({
      role: message.role ?? ChatRole.User,
      content: message.content ?? '',
    }));
    await this.#generateResponse(options);
  }

  // Generate a new response for the last user message.
  async regenerateResponse(options) {
    if (this.history.length == 0)
      throw new Error('Unable to regenerate response when there is no message.');
    if (this.pendingMessage)
      throw new Error('Can not regenerate when there is pending message being received.');
    this.history.pop();
    await this.#generateResponse(options);
  }

  // Call the API.
  async #generateResponse(options) {
    try {
      const apiOptions = {
        signal: options.signal,
        onMessageDelta: this.#handleMessageDelta.bind(this),
      };
      if (this.api instanceof ChatCompletionAPI) {
        await this.api.sendConversation(this.history, apiOptions);
      } else if (this.api instanceof ChatConversationAPI) {
        await this.api.sendMessage(this.history[this.history.length - 1].content, apiOptions);
      }
    } catch (error) {
      // AbortError is not treated as error.
      if (error.name == 'AbortError') {
        if (!this.#lastResponse)
          this.#lastResponse = new ChatResponse();
        this.#lastResponse.aborted = true;
      } else {
        throw error;
      }
    }

    // The pendingMessage should be cleared when end of message has been
    // received, if there is no such signal and the partial message has been
    // left after API call ends, send an end signal here.
    if (this.pendingMessage) {
      const response = new ChatResponse(this.#lastResponse ?? {});
      response.pending = false;
      this.onMessageDelta.emit({}, response);
      this.#responseEnded();
    }

    // Generate a title for the conversation.
    if (!this.#titlePromise && this.history.length > 3 && this.history.length < 10)
      this.#titlePromise = this.#generateTitle();
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
    if (delta.content) {
      if (this.pendingMessage.content)
        this.pendingMessage.content += delta.content;
      else
        this.pendingMessage.content = delta.content;
    }

    this.#lastResponse = response;

    // Send onMessage when all pending messags have been received.
    if (!response.pending) {
      if (!this.pendingMessage.role || !this.pendingMessage.content)
        throw new Error('Incomplete delta received from ChatGPT');
      this.onMessage.emit({
        role: this.pendingMessage.role,
        content: this.pendingMessage.content.trim(),
      }, response);
      this.#responseEnded();
    }
  }

  // End of response.
  #responseEnded() {
    if (this.pendingMessage)
      this.history.push(new ChatMessage(this.pendingMessage));
    this.pendingMessage = null;
    this.#lastResponse = null;
  }

  // Generate a title for the conversation.
  async #generateTitle() {
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
        Provide a concise name, within 5 words and without quotation marks,
        using the speak language used in the conversation.
        The conversation is named:
      `
    });
    let title = '';
    await this.api.sendConversation([message], {
      onMessageDelta(delta) { title += delta.content ?? '' }
    });
    if (title.endsWith('.'))
      title = title.slice(0, -1);
    else if (title.startsWith('"') && title.endsWith('"'))
      title = title.slice(1, -1);
    this.onTitle.emit(title);
    this.#titlePromise = null;
  }
}
