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

  onMessage: Signal<(message: ChatMessage, response: ChatResponse) => void> = new Signal;
  onMessageDelta: Signal<(delta: Partial<ChatMessage>, response: ChatResponse) => void> = new Signal;

  // Abilities.
  canRegenerate: boolean;

  // Saves concatenated content of all the received partial messages.
  pendingMessage?: Partial<ChatMessage>;

  // The response of last partial message.
  #lastResponse?: ChatResponse;

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
    this.history.push({
      role: message.role ?? ChatRole.User,
      content: message.content ?? '',
    });
    await this.#generateResponse(options);
  }

  // Generate a new response for the last user message.
  async regenerateResponse(options) {
    if (this.history.length == 0)
      throw new Error('Unable to regenerate response when there is no message.');
    this.pendingMessage = null;
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
        this.#responseEnded();
        return;
      }
      throw error;
    }

    // API call may end without sending a finish signal.
    if (this.pendingMessage)
      this.#responseEnded();
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
      this.pendingMessage = null;
      this.#lastResponse = null;
    }
  }

  // Called when the response is abrupted from server's side.
  #responseEnded() {
    // If there was any partial message sent, give listener an end signal.
    if (this.pendingMessage) {
      const response = new ChatResponse(this.#lastResponse ?? {});
      response.pending = false;
      this.onMessageDelta.emit({}, response);
    }
    this.pendingMessage = null;
    this.#lastResponse = null;
  }
}
