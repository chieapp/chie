import gui from 'gui';
import {SignalConnections} from 'typed-signals';

import BaseView from './base-view';
import ChatService, {ChatMessageInfo} from '../model/chat-service';
import IconButton from './icon-button';
import InputView from './input-view';
import MessagesView from './messages-view';
import StreamedMarkdown from '../util/streamed-markdown';
import TextWindow from './text-window';
import {ChatRole, ChatMessage, ChatConversationAPI} from '../model/chat-api';
import {style} from './browser-view';

type ButtonMode = 'refresh' | 'send' | 'stop';

export default class ChatView extends BaseView<ChatService> {
  // Font in entry.
  static font?: gui.Font;

  // Height limitations of entry view.
  static entryHeights?: {
    max: number;
    min: number;
  };

  messagesView: MessagesView;
  input: InputView;
  replyButton: IconButton;
  menuButton: IconButton;

  #serviceConnections: SignalConnections = new SignalConnections();
  #markdown?: StreamedMarkdown;
  #lastError?: Error;

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
    this.messagesView.onDomReady.connect(this.#onDomReady.bind(this));
    this.view.addChildView(this.messagesView.view);

    // Font style should be the same with messages.
    if (!ChatView.font)
      ChatView.font = gui.Font.create(gui.Font.default().getName(), 15, 'normal', 'normal');

    this.input = new InputView();
    this.input.view.setStyle({margin: style.padding});
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
    this.input.entry.onTextChange = this.#onTextChange.bind(this);
    this.input.entry.shouldInsertNewLine = this.#onEnter.bind(this);
    this.view.addChildView(this.input.view);

    this.replyButton = new IconButton('send');
    this.replyButton.view.setTooltip(getTooltipForMode('send'));
    this.replyButton.onClick = this.#onButtonClick.bind(this);
    this.input.addButton(this.replyButton);

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
    this.service.aborter?.abort();
  }

  initAsMainView() {
    this.loadChatService(this.service);
  }

  onFocus() {
    if (this.view.isVisibleInHierarchy())
      this.input.entry.focus();
  }

  getTitle() {
    return this.service.title ?? this.service.name;
  }

  async loadChatService(service: ChatService) {
    if (this.service == service)
      return;
    if (!(service instanceof ChatService))
      throw new Error('ChatView can only be used with ChatService');
    this.unload();
    this.service = service;
    this.#serviceConnections.add(service.onNewTitle.connect(
      this.onNewTitle.emit.bind(this.onNewTitle)));
    this.#serviceConnections.add(service.onMessageDelta.connect(
      this.#onMessageDelta.bind(this)));
    this.#serviceConnections.add(service.onMessageError.connect(
      this.#onMessageError.bind(this)));
    this.#serviceConnections.add(service.onRemoveMessage.connect(
      this.messagesView.removeMessage.bind(this.messagesView)));
    this.#serviceConnections.add(service.onClearMessages.connect(
      this.messagesView.clearMessages.bind(this.messagesView)));
    this.messagesView.assistantName = service.name;
    if (service.api.icon)
      this.messagesView.assistantAvatar = service.api.icon.getChieUrl();
    if (service.isLoaded) {
      await this.messagesView.loadMessages(service.history);
    } else {
      this.#serviceConnections.add(service.onLoad.connect(() => {
        this.messagesView.loadMessages(service.history);
      }));
    }
  }

  unload() {
    for (const win of Object.values(this.#textWindows))
      win.window.close();
    this.#serviceConnections.disconnectAll();
  }

  getDraft(): string | null {
    if (this.service.pendingMessage)
      return null;
    const content = this.input.entry.getText();
    if (content.trim().length == 0)
      return null;
    return content;
  }

  // User editing in the entry.
  #onTextChange() {
    const text = this.input.entry.getText();
    if (text.length > 0 ||
        this.service.history.length == 0 ||
        this.service.api instanceof ChatConversationAPI)
      this.#setButtonMode('send');
    else
      this.#setButtonMode('refresh');
  }

  // User presses Enter in the reply entry.
  #onEnter() {
    if (gui.Event.isShiftPressed())  // user wants new line
      return true;
    if (this.service.pendingMessage)  // should never happen
      throw new Error('Sending message while a message is being received');
    const content = this.getDraft();
    if (!content)
      return false;
    // Send message.
    this.service.sendMessage({role: ChatRole.User, content}).catch(() => {
      // Error handled elsewhere.
    });
    return false;
  }

  // User clicks on the send button.
  #onButtonClick() {
    // Success of action always change button mode, so disable button here and
    // when the action finishes it will be enabled again.
    this.replyButton.setEnabled(false);
    // Do the action depending on button mode.
    if (this.#buttonMode == 'send') {
      if (this.getDraft())
        this.#onEnter();
      else
        this.replyButton.setEnabled(true);
    } else if (this.#buttonMode == 'stop') {
      this.service.aborter.abort();
    } else if (this.#buttonMode == 'refresh') {
      this.service.regenerateResponse();
    }
  }

  // User clicks on the menu button.
  #onMenuButton() {
    const menu = gui.Menu.create([
      {
        label: 'Regenerate response',
        enabled: this.service.history.length > 0,
        onClick: () => this.service.regenerateResponse(),
      },
      {
        label: 'Clear',
        enabled: this.service.history.length > 0,
        onClick: () => this.service.clear(),
      },
    ]);
    menu.popup();
  }

  // Message being received.
  #onMessageDelta(delta: Partial<ChatMessage>, info: ChatMessageInfo) {
    if (info.first) {
      // Show the message if we are receiving it for the first time.
      this.messagesView.appendMessage(delta, info);
      if (info.pending) {
        // Prevent editing until message is received.
        this.#setButtonMode('stop');
        this.input.setEntryEnabled(false);
        this.input.setText('');
      }
    } else if (delta.content) {
      // Update the message when receiving deltas.
      if (!this.#markdown)
        this.#markdown = new StreamedMarkdown();
      const change = this.#markdown.appendText(delta.content);
      this.messagesView.appendHtmlToPendingMessage(change);
    }
    if (info.pending)
      return;
    // Reset after message is received.
    this.#markdown = null;
    if (!info.first) {
      this.#resetUIState();
      if (this.service.aborter?.signal.aborted)
        this.messagesView.addAbortedLabelToPendingMessage();
      this.messagesView.removePendingMark();
    }
  }

  // There is error thrown when sending message.
  #onMessageError(error: Error) {
    this.#lastError = error;
    this.messagesView.appendError(error.message);
  }

  // Set the input and button to ready to send state.
  #resetUIState() {
    if (this.service.api instanceof ChatConversationAPI ||
        this.service.history.length == 0) {
      this.#setButtonMode('send');
    } else {
      this.#setButtonMode('refresh');
    }
    if (!this.#lastError) {
      this.input.setEntryEnabled(true);
      this.onFocus();
    }
  }

  // Change button mode.
  #setButtonMode(mode: ButtonMode) {
    this.replyButton.setImage(mode);
    this.replyButton.setEnabled(true);
    this.replyButton.view.setTooltip(getTooltipForMode(mode));
    this.menuButton.setEnabled(mode != 'stop');
    this.#buttonMode = mode;
  }

  async #onDomReady() {
    // There might be pending message when the service is loaded.
    if (this.service.pendingMessage)
      this.#onMessageDelta(this.service.pendingMessage, {first: true, pending: true});
    else
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
