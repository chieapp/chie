import gui from 'gui';
import {SignalConnections} from 'typed-signals';

import BaseView from './base-view';
import ChatService from '../model/chat-service';
import IconButton from './icon-button';
import InputView from './input-view';
import MessagesView from './messages-view';
import StreamedMarkdown from '../util/streamed-markdown';
import TextWindow from './text-window';
import apiManager from '../controller/api-manager';
import basicStyle from './basic-style';
import deepAssign from '../util/deep-assign';
import {APIError} from '../model/errors';
import {
  ChatRole,
  ChatMessage,
  ChatResponse,
  ChatCompletionAPI,
} from '../model/chat-api';

type ButtonMode = 'refresh' | 'send' | 'stop';

export default class ChatView extends BaseView<ChatService> {
  // Font in entry.
  static font?: gui.Font;

  // Height limitations of entry view.
  static entryHeights?: {
    max: number;
    min: number;
  };

  static getMenuItems() {
    return [
      {
        label: 'Clear Conversation',
        accelerator: 'Shift+CmdOrCtrl+C',
        validate: (view: ChatView) => view.service?.history.length > 0,
        onClick: (view: ChatView) => view.service?.clear(),
      },
    ];
  }

  messagesView: MessagesView;
  input: InputView;
  replyButton: IconButton;
  menuButton: IconButton;

  #serviceConnections: SignalConnections = new SignalConnections();
  #markdown?: StreamedMarkdown;

  #buttonMode: ButtonMode = 'send';
  #textWindows: Record<number, TextWindow> = {};

  constructor(service?: ChatService) {
    super();

    this.view.setStyle({flex: 1});
    if (process.platform == 'win32')
      this.view.setBackgroundColor('#D3D3D3');

    this.messagesView = new MessagesView();
    this.messagesView.view.setStyle({flex: 1});
    this.messagesView.browser.addBinding('focusEntry', this.onFocus.bind(this));
    this.messagesView.browser.addBinding('showTextAt', this.#showTextAt.bind(this));
    this.messagesView.browser.addBinding('copyTextAt', this.#copyTextAt.bind(this));
    this.messagesView.browser.addBinding('sendReply', this.#sendReply.bind(this));
    this.messagesView.browser.addBinding('refreshToken', this.#refreshToken.bind(this));
    this.messagesView.onDomReady.connect(this.#onDomReady.bind(this));
    this.view.addChildView(this.messagesView.view);

    // Font style should be the same with messages.
    if (!ChatView.font)
      ChatView.font = gui.Font.create(gui.Font.default().getName(), 15, 'normal', 'normal');

    this.input = new InputView();
    this.input.view.setStyle({margin: basicStyle.padding});
    this.input.entry.setFont(ChatView.font);
    // Calculate height for 1 and 5 lines.
    if (!ChatView.entryHeights) {
      this.input.entry.setText('1');
      const min = this.input.entry.getTextBounds().height;
      this.input.entry.setText('1\n2\n3\n4\n5');
      const max = this.input.entry.getTextBounds().height;
      this.input.entry.setText('');
      ChatView.entryHeights = {min, max};
    }
    this.input.setAutoResize(ChatView.entryHeights);
    this.input.entry.onTextChange = this.#resetUIState.bind(this);
    this.input.entry.shouldInsertNewLine = this.#onEnter.bind(this);
    this.view.addChildView(this.input.view);

    this.replyButton = new IconButton('send');
    this.replyButton.view.setTooltip(getTooltipForMode('send'));
    this.replyButton.onClick = this.#onButtonClick.bind(this);
    this.input.addButton(this.replyButton);

    // Disable button and entry until loaded.
    this.input.setEntryEnabled(false);
    this.replyButton.setEnabled(false);

    this.menuButton = new IconButton('menu');
    this.menuButton.onClick = this.#onMenuButton.bind(this);
    this.input.addButton(this.menuButton);

    if (service)
      this.loadChatService(service);
  }

  destructor() {
    super.destructor();
    this.unload();
    this.messagesView.destructor();
    this.input.destructor();
  }

  initAsMainView() {
    this.loadChatService(this.service);
  }

  onFocus() {
    if (this.view.isVisibleInHierarchy())
      this.input.entry.focus();
  }

  getTitle() {
    if (!this.service)
      return '';
    return this.service.title ?? this.service.name;
  }

  async loadChatService(service: ChatService) {
    if (this.service == service)
      return;
    if (!(service instanceof ChatService))
      throw new Error('ChatView can only be used with ChatService');
    // Clear previous load.
    this.unload();
    // Delay loading until the service is ready.
    if (!service.isLoaded) {
      this.#serviceConnections.add(service.onLoad.connect(this.loadChatService.bind(this, service)));
      return;
    }
    // Load messages.
    this.messagesView.assistantName = service.name;
    this.messagesView.assistantAvatar = service.icon.getChieURL();
    this.messagesView.loadURL(`chie://chat/${service.id}/${encodeURIComponent(service.title)}`);
    // Connect signals.
    this.service = service;
    this.#serviceConnections.add(service.onNewTitle.connect(
      this.onNewTitle.emit.bind(this.onNewTitle)));
    this.#serviceConnections.add(service.onUserMessage.connect(
      this.#onUserMessage.bind(this)));
    this.#serviceConnections.add(service.onClearError.connect(
      this.#onClearError.bind(this)));
    this.#serviceConnections.add(service.onMessageBegin.connect(
      this.#onMessageBegin.bind(this)));
    this.#serviceConnections.add(service.onMessageDelta.connect(
      this.#onMessageDelta.bind(this)));
    this.#serviceConnections.add(service.onMessageError.connect(
      this.#onMessageError.bind(this)));
    this.#serviceConnections.add(service.onMessage.connect(
      this.#resetUIState.bind(this)));
    this.#serviceConnections.add(service.onRemoveMessage.connect(
      this.messagesView.removeMessage.bind(this.messagesView)));
    this.#serviceConnections.add(service.onClearMessages.connect(
      this.messagesView.clearMessages.bind(this.messagesView)));
    // Load pending message.
    if (this.service.isPending) {
      this.#onMessageBegin();
      if (this.service.pendingMessage)
        this.#onMessageDelta(this.service.pendingMessage, {pending: true});
      if (this.service.lastError)
        this.#onMessageError(this.service.lastError);
    }
  }

  unload() {
    for (const win of Object.values(this.#textWindows))
      win.window.close();
    this.#serviceConnections.disconnectAll();
  }

  getDraft(): string | null {
    const content = this.input.entry.getText();
    if (content.trim().length == 0)
      return null;
    return content;
  }

  // Change button mode.
  #setButtonMode(mode: ButtonMode) {
    this.replyButton.setImage(mode);
    this.replyButton.setEnabled(true);
    this.replyButton.view.setTooltip(getTooltipForMode(mode));
    this.menuButton.setEnabled(mode != 'stop');
    this.#buttonMode = mode;
    // Disable send button when there is error happened.
    if (mode == 'send' && this.service.lastError)
      this.replyButton.setEnabled(false);
  }

  // Set the input and button to ready to send state.
  #resetUIState() {
    // Can only refresh if there was error.
    if (this.service.lastError) {
      this.#setButtonMode('refresh');
      return;
    }
    // Can only stop if there is pending message.
    if (this.service.isPending) {
      this.#setButtonMode('stop');
      return;
    }
    if (this.service.history.length > 0) {
      // Show refresh button if last message is from user, this usually means
      // the last message failed to send.
      if (this.service.history[this.service.history.length - 1].role == ChatRole.User) {
        this.#setButtonMode('refresh');
        return;
      }
      // Show refresh button if last message is from bot and there is no input.
      if (this.service.api instanceof ChatCompletionAPI &&
          this.service.history[this.service.history.length - 1].role == ChatRole.Assistant &&
          this.input.entry.getText().length == 0) {
        this.#setButtonMode('refresh');
        return;
      }
    }
    // Otherwise ready to send.
    this.#setButtonMode('send');
    this.onFocus();
  }

  // User presses Enter in the reply entry.
  #onEnter() {
    if (gui.Event.isShiftPressed())  // user wants new line
      return true;
    if (this.#buttonMode != 'send')
      return false;
    const content = this.getDraft();
    if (!content)
      return false;
    // Send message.
    this.replyButton.setEnabled(false);
    this.service.sendMessage({role: ChatRole.User, content});
    return false;
  }

  // User clicks on the send button.
  #onButtonClick() {
    // Do the action depending on button mode.
    if (this.#buttonMode == 'send') {
      this.#onEnter();
    } else if (this.#buttonMode == 'stop') {
      this.replyButton.setEnabled(false);
      this.service.aborter.abort();
    } else if (this.#buttonMode == 'refresh') {
      this.replyButton.setEnabled(false);
      this.service.regenerateResponse();
    }
  }

  // User clicks on the menu button.
  #onMenuButton() {
    const menu = gui.Menu.create([
      {
        label: 'Clear',
        enabled: this.service.history.length > 0,
        onClick: () => this.service.clear(),
      },
    ]);
    menu.popup();
  }

  // Recover current state of chat.
  #onDomReady() {
    this.input.setEntryEnabled(true);
    if (!this.service.isPending)
      this.#resetUIState();
  }

  // User has sent a message.
  #onUserMessage(message: ChatMessage) {
    this.messagesView.appendMessage(message, this.service.history.length - 1);
  }

  // Last error has been cleared for renegeration.
  #onClearError() {
    this.messagesView.removeMessage(this.service.history.length);
  }

  // Begin receving response.
  #onMessageBegin() {
    // Add a bot message to indicate we are loading.
    this.messagesView.appendPendingMessage({role: ChatRole.Assistant}, this.service.history.length);
    // Clear input.
    this.#markdown = null;
    this.input.setText('');
    // Mark state as sending.
    this.#setButtonMode('stop');
  }

  // Message being received.
  #onMessageDelta(delta: Partial<ChatMessage>, response: ChatResponse) {
    if (delta.steps)
      this.messagesView.appendSteps(delta.steps);
    if (!this.#markdown && (delta.links || delta.content))
      this.#markdown = new StreamedMarkdown();
    if (delta.links) {
      this.#markdown.appendLinks(delta.links);
      this.messagesView.appendLinks(this.service.pendingMessage?.links?.length ?? 0, delta.links);
    }
    if (delta.content) {
      // Update the message when receiving deltas.
      const change = this.#markdown.appendText(delta.content);
      this.messagesView.appendHtmlToPendingMessage(change);
    }
    if (response.suggestedReplies)
      this.messagesView.setSuggestdReplies(response.suggestedReplies);
    if (response.pending)
      return;
    // Reset after message is received.
    this.#resetUIState();
    if (this.service.aborter?.signal.aborted)
      this.messagesView.abortPending();
    this.messagesView.endPending();
  }

  // There is error thrown when sending message.
  #onMessageError(error: Error | APIError) {
    if (error.name == 'AbortError')
      this.messagesView.abortPending();
    else
      this.messagesView.appendError(error.message);
    // Append refresh button.
    if (error.name == 'APIError' && (error as APIError).code == 'refresh')
      this.messagesView.setRefreshAction();
    this.#resetUIState();
  }

  // Browser bindings.
  #showTextAt(index: number, textWidth: number) {
    if (index in this.#textWindows) {
      this.#textWindows[index].window.activate();
      return;
    }
    const text = this.service.history[index].content;
    const win = new TextWindow(text);
    this.#textWindows[index] = win;
    win.window.onClose = () => delete this.#textWindows[index];
    win.showWithWidth(textWidth);
  }

  #copyTextAt(index: number) {
    gui.Clipboard.get().setText(this.service.history[index].content);
  }

  #sendReply(content: string) {
    this.service.sendMessage({role: ChatRole.User, content});
  }

  async #refreshToken() {
    try {
      const record = apiManager.getAPIRecord(this.service.api.endpoint.type);
      deepAssign(this.service.api.endpoint, await record.refresh());
      apiManager.updateEndpoint(this.service.api.endpoint);
      this.service.regenerateResponse();
    } catch (error) {
      // Ignore error.
      console.log(error);
    }
  }
}

// Return the button tooltip for button mode.
function getTooltipForMode(mode: ButtonMode) {
  if (mode == 'refresh')
    return 'Reload';
  else if (mode == 'send')
    return 'Send';
  else if (mode == 'stop')
    return 'Stop';
  else
    throw new Error(`Invalid button mode ${mode}.`);
}
