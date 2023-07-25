import {Signal} from 'typed-signals';

import Tool, {ToolExecutionResult} from '../model/tool';
import WebAPI from '../model/web-api';
import WebService, {WebServiceData, WebServiceOptions} from '../model/web-service';
import historyKeeper from '../controller/history-keeper';
import assistantManager from '../controller/assistant-manager';
import titleGenerator from '../controller/title-generator';
import toolManager from '../controller/tool-manager';
import {AbortError} from '../model/errors';
import {
  ChatMessage,
  ChatResponse,
  ChatRole,
  ChatToolCall,
} from '../model/chat-api';
import {deepAssign} from '../util/object-utils';

export interface BaseChatHistoryData {
  title?: string;
  customTitle?: string;
  history?: ChatMessage[];
}

export interface BaseChatServiceData extends WebServiceData {
  moment?: string;
  title?: string;
}

export interface BaseChatServiceOptions<T extends WebAPI = WebAPI, P extends object = object> extends WebServiceOptions<T, P> {
  moment?: string;
  title?: string;
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

  onNewTitle: Signal<(title: string | null) => void> = new Signal;
  onUserMessage: Signal<(message: ChatMessage) => void> = new Signal;
  onClearError: Signal<() => void> = new Signal;
  onMessageBegin: Signal<() => void> = new Signal;
  onMessageDelta: Signal<(delta: Partial<ChatMessage>, response: ChatResponse) => void> = new Signal;
  onExecuteToolError: Signal<(error: Error) => void> = new Signal;
  onMessageError: Signal<(error: Error) => void> = new Signal;
  onMessage: Signal<(message: ChatMessage, response?: ChatResponse) => void> = new Signal;
  onRemoveMessagesAfter: Signal<((index: number) => void)> = new Signal;
  onUpdateMessage: Signal<((message: ChatMessage, index: number) => void)> = new Signal;
  onClearMessages: Signal<() => void> = new Signal;

  // Auto increasing ID.
  id: number = ++BaseChatService.nextId;

  // Whether the chat messages have be recovered from disk.
  isLoaded = false;

  // ID of the chat history kept on disk.
  moment?: string;

  // Current chat messages.
  history: ChatMessage[] = [];

  // Error is set if last message failed to send.
  lastError?: Error;

  // The response of last chunk.
  lastResponse?: ChatResponse;

  // Whether there is a message being sent.
  pending = false;

  // Saves concatenated content of all the received partial messages.
  pendingMessage?: Partial<ChatMessage>;

  // The aborter that can be used to abort current call.
  aborter = new AbortController();

  // The promise of current load process.
  protected loadPromise?: Promise<void>;

  // Title of the chat.
  protected customTitle?: string;
  protected title?: string;
  // The promise of current generateTitle call.
  protected titlePromise?: Promise<void>;

  static deserialize(data: BaseChatServiceData): WebServiceOptions {
    const options = WebService.deserialize(data) as BaseChatServiceOptions;
    if (typeof data.moment == 'string')
      options.moment = data.moment;
    if (typeof data.title == 'string')
      options.title = data.title;
    return options;
  }

  constructor(options: BaseChatServiceOptions<T, P>) {
    super(options);
    this.moment = options.moment;
    this.title = options.title;
    BaseChatService.services[this.id] = this;
  }

  serialize() {
    const data: BaseChatServiceData = super.serialize();
    if (this.moment)
      data.moment = this.moment;
    if (this.getTitle())
      data.title = this.title;
    return data;
  }

  // Remove this chat and delete its information on disk.
  destructor() {
    super.destructor();
    this.aborter?.abort();
    this.removeTrace();
    delete BaseChatService.services[this.id];
  }

  // Load chat history.
  async load() {
    if (this.isLoaded)
      return;
    if (this.loadPromise)
      return await this.loadPromise;
    this.loadPromise = this.loadHistory();
    await this.loadPromise;
    this.isLoaded = true;
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
    message.role = message.role ?? ChatRole.User;
    if (message.role == ChatRole.User && !message.content)
      throw new Error('Message from user must have content.');
    this.history.push(message as ChatMessage);
    this.onUserMessage.emit(message as ChatMessage);
    this.saveHistory();
    // Start sending.
    this.pending = true;
    try {
      await this.invokeChatAPI();
      // Generate a title for the conversation after sending a user message.
      if (message.role == ChatRole.User)
        this.generateTitle();
    } finally {
      this.pending = false;
    }
  }

  // Execute tool.
  async executeTool(call: ChatToolCall) {
    if (this.pending)
      throw new Error('Can not execute tool when there is pending message.');
    this.pending = true;
    // Get tool and execute it.
    let tool: Tool;
    let result: ToolExecutionResult;
    try {
      tool = toolManager.getToolByName(call.name);
      result = await tool.execute(this.aborter.signal, call.arg);
    } catch(error) {
      if (error.name != 'AbortError')
        this.onExecuteToolError.emit(error);
      return;
    } finally {
      this.pending = false;
    }
    // Some tool does not handle abort signal and we have to manually abort
    // after tool finishes execution.
    if (this.isAborted()) {
      this.onExecuteToolError.emit(new AbortError());
      return;
    }
    // Send the result to API and wait for response.
    await this.sendMessage({
      role: ChatRole.Tool,
      content: result.resultForModel,
      toolName: tool.name,
      toolResult: result.resultForHuman,
    });
  }

  // Called when user clicks the reload button, should usually resend last user
  // message or regenerate last bot message.
  async regenerateLastResponse() {
    if (!this.canRegenerateLastResponse())
      throw new Error('Unable to regenerate last response.');
    const lastMessage = this.getLastMessage();
    // If last message is from user, then we just need to resend.
    if (lastMessage.role == ChatRole.User) {
      this.pending = true;
      try {
        await this.invokeChatAPI();
        // Usually there is no need to generate title when doing regeneration,
        // but it may happend that the first message failed to send and after
        // resending there is no title generated.
        if (!this.title)
          this.generateTitle();
      } finally {
        this.pending = false;
      }
      return;
    }
    // For assistant message, we need to remove it and regenerate.
    if (lastMessage.role == ChatRole.Assistant ||
        lastMessage.role == ChatRole.Tool) {
      // Assistant and Tool messages are merged together, so find the index of
      // last user message and restart regenerate from its reply.
      let lastIndex = this.history.length;
      while (--lastIndex >= 0) {
        const {role} = this.history[lastIndex];
        if (role != ChatRole.Assistant && role != ChatRole.Tool)
          break;
      }
      return await this.regenerateFrom(lastIndex + 1);
    }
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
    this.aborter = new AbortController();
    this.customTitle = null;
    this.title = null;
    this.titlePromise = null;
    this.lastError = null;
    this.lastResponse = null;
    this.removeTrace();
    this.onNewTitle.emit(null);
    this.onClearMessages.emit();
  }

  // Whether user can do regeneration for last message, can be used for
  // validating the reload button.
  canRegenerateLastResponse() {
    if (this.pending)
      return false;
    const lastMessage = this.getLastMessage();
    if (!lastMessage)
      return false;
    if (lastMessage.role == ChatRole.User)
      return true;
    if ((lastMessage.role == ChatRole.Assistant ||
         lastMessage.role == ChatRole.Tool) &&
        this.canRegenerateFrom())
      return true;
    return false;
  }

  // Helper to get last message in history.
  getLastMessage() {
    if (this.history.length == 0)
      return null;
    return this.history[this.history.length - 1];
  }

  // Titles.
  getTitle() {
    return this.customTitle ?? this.title;
  }

  setCustomTitle(title: string) {
    this.customTitle = title;
    this.notifyNewTitle(title);
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
    this.lastResponse = null;
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

    // If we have never received any message, then it is likely the server
    // refused our connection for some reason.
    if (!this.lastResponse) {
      this.notifyMessageError(new Error('Server closed connection.'));
      return;
    }

    // A complete message should have some properties set.
    if (!this.pendingMessage.role ||
        (!this.pendingMessage.content && !this.pendingMessage.tool)) {
      this.notifyMessageError(new Error('Incomplete delta received from API'));
      return;
    }

    // If we are still waiting for more messages after the API call ends (for
    // example aborted), send an end signal here.
    if (this.lastResponse.pending)
      this.notifyMessageDelta({}, {pending: false});

    // Push the received message.
    const message = this.pendingMessage as ChatMessage;
    this.history.push(message);

    // Clear pending state before emitting onMessage.
    this.pending = false;
    this.pendingMessage = null;
    this.onMessage.emit(message, this.lastResponse);

    // Save to disk after emitting onMessage, which may modify history.
    this.saveHistory();

    // TODO(zcbenz): Ask for user's confirmation before executing tools.
    if (this.lastResponse.useTool)
      await this.executeTool(message.tool);
  }

  // Generate a title for the chat.
  protected async generateTitle() {
    if (this.lastError || this.customTitle || this.titlePromise || this.isAborted())
      return;
    return this.titlePromise = titleGenerator
      .generateForConversation(this.history, this.api, this.aborter?.signal)
      .then((title) => {
        if (title.startsWith('"') && title.endsWith('"'))
          title = title.slice(1, -1);
        if (title.endsWith('.'))
          title = title.slice(0, -1);
        this.title = title;
        this.notifyNewTitle(title);
      })
      .catch(() => { /* ignore error */ })
      .finally(() => this.titlePromise = null);
  }

  // Error happened when requesting chat response.
  protected notifyMessageError(error: Error) {
    this.lastError = error;
    this.onMessageError.emit(error);
  }

  // Called by sub-class when there is message delta available.
  protected notifyMessageDelta(delta: Partial<ChatMessage>, response: ChatResponse) {
    this.lastResponse = response;
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
    if (delta.tool) {
      if (this.pendingMessage.tool)
        throw new Error('Got multiple function calls in one message.');
      this.pendingMessage.tool = delta.tool;
    }
    if (delta.links) {
      if (this.pendingMessage.links)
        this.pendingMessage.links.push(...delta.links);
      else
        this.pendingMessage.links = delta.links;
    }

    // Notify the view of message delta.
    this.onMessageDelta.emit(delta, response);
  }

  // Notify the title of chat has changed.
  protected notifyNewTitle(title: string | null) {
    this.onNewTitle.emit(title);
    // The title is written to both chat history and the main config file, the
    // latter is used for cache purpose when showing UI.
    this.saveHistory();
    assistantManager.saveConfig();
  }

  // Load history from disk.
  protected async loadHistory() {
    if (!this.moment)
      return;
    // Load from saved history.
    const data = await historyKeeper.remember(this.moment);
    if (data)
      this.deserializeHistory(data);
  }

  // Write history to disk.
  protected saveHistory() {
    if (!this.moment) {
      this.moment = historyKeeper.newMoment();
      assistantManager.saveConfig();
    }
    historyKeeper.save(this.moment, this.serializeHistory());
  }
}
