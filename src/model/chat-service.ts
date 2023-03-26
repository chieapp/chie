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

export type ChatServiceOptions = {
  endpoint: APIEndpoint,
  name?: string,
};

export default abstract class ChatService {
  name: string;
  endpoint: APIEndpoint;
  history: ChatMessage[] = [];

  // Saves concatenated content of all the received partial messages.
  pendingMessage?: Partial<ChatMessage>;
  // The response of last partial message.
  lastResponse?: ChatResponse;

  // Abilities.
  canRegenerate: boolean = true;

  onMessage: Signal<(message: ChatMessage, response: ChatResponse) => void>;
  onMessageDelta: Signal<(delta: Partial<ChatMessage>, response: ChatResponse) => void>;

  constructor(name: string, endpoint: APIEndpoint) {
    if (!name || !endpoint)
      throw new Error('Must pass name and endpoint to ChatService');
    this.name = name;
    this.endpoint = endpoint;
    this.onMessageDelta = new Signal();
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
  protected handleMessageDelta(delta: Partial<ChatMessage>, response: ChatResponse) {
    this.onMessageDelta.dispatch(delta, response);

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
      this.onMessageDelta.dispatch({}, response);
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
