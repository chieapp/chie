import {Signal} from 'type-signals';
import APIEndpoint from './api-endpoint';

export enum ChatRole {
  User = 'User',
  Assistant = 'Assistant',
  System = 'System',
}

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export class ChatResponse {
  // Unique ID for each message.
  id?: string;
  // The content is omitted because of content filter.
  filtered: boolean = false;
  // This message is in progress, and waiting for more.
  pending: boolean = false;
  // The response was aborted by user.
  aborted: boolean = false;

  constructor(init?: Partial<ChatResponse>) {
    Object.assign(this, init);
  }
}

export default abstract class ChatService {
  endpoint: APIEndpoint;
  history: ChatMessage[] = [];

  // Saves concatenated content of all the received partial messages.
  pendingMessage?: Partial<ChatMessage>;
  // The response of last partial message.
  lastResponse?: ChatResponse;

  // Abilities.
  canRegenerate: boolean = true;

  onMessage: Signal<(message: ChatMessage, response: ChatResponse) => void>;
  onPartialMessage: Signal<(message: Partial<ChatMessage>, response: ChatResponse) => void>;

  constructor(endpoint: APIEndpoint) {
    this.endpoint = endpoint;
    this.onPartialMessage = new Signal();
    this.onMessage = new Signal();
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

  // Implemented by sub-classes to actually send network requests.
  abstract sendMessageImpl(options: {signal?: AbortSignal}): Promise<void>;

  // Called by sub-classes when there is message delta available.
  protected handlePartialMessage(message: Partial<ChatMessage>, response: ChatResponse) {
    this.onPartialMessage.dispatch(message, response);

    // Concatenate to the pendingMessage.
    if (!this.pendingMessage) {
      if (!message.role)
        throw new Error('First partial message should include role');
      this.pendingMessage = {role: message.role ?? ChatRole.Assistant};
    }
    if (message.content) {
      if (this.pendingMessage.content)
        this.pendingMessage.content += message.content;
      else
        this.pendingMessage.content = message.content;
    }

    this.lastResponse = response;

    // Send onMessage when all pending messags have been received.
    if (!response.pending) {
      if (!this.pendingMessage.role || !this.pendingMessage.content)
        throw new Error('Incomplete delta received from ChatGPT');
      this.onMessage.dispatch({
        role: this.pendingMessage.role,
        content: this.pendingMessage.content.trim(),
      }, response);
      this.pendingMessage = null;
      this.lastResponse = null;
    }
  }

  // Called when the response is abrupted from server's side.
  protected responseEnded() {
    // If there was any partial message sent, give listener an end signal.
    if (this.pendingMessage) {
      const response = new ChatResponse(this.lastResponse ?? {});
      response.pending = false;
      this.onPartialMessage.dispatch({}, response);
    }
    this.pendingMessage = null;
    this.lastResponse = null;
  }

  async #generateResponse(options) {
    try {
      await this.sendMessageImpl(options);
    } catch (error) {
      // AbortError is not treated as error.
      if (error.name == 'AbortError') {
        if (!this.lastResponse)
          this.lastResponse = new ChatResponse();
        this.lastResponse.aborted = true;
        this.responseEnded();
        return;
      }
      throw error;
    }

    // The pendingMessage should be cleared after parsing.
    if (this.pendingMessage) {
      this.pendingMessage = null;
      throw new Error('The pending message is not cleared.');
    }
  }
}
