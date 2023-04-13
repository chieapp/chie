import fs from 'node:fs/promises';
import path from 'node:path';
import ejs from 'ejs';
import gui from 'gui';
import open from 'open';
import {realpathSync} from 'node:fs';

import BaseView from '../view/base-view';
import ChatService from '../model/chat-service';
import IconButton from './icon-button';
import InputView from './input-view';
import TextWindow from './text-window';
import {
  renderMarkdown,
  veryLikelyMarkdown,
  highlightCode,
  escapeText,
} from './markdown';
import {
  ChatRole,
  ChatMessage,
  ChatConversationAPI,
} from '../model/chat-api';

const assetsDir = path.join(__dirname, '../../assets');

export const style = {
  chatViewPadding: 14,
  bgColorDarkMode: '#1B1D21',
};

type ButtonMode = 'refresh' | 'send' | 'stop';

export default class ChatView extends BaseView<ChatService> {
  // EJS templates.
  static pageTemplate?: ejs.AsyncTemplateFunction;
  static messageTemplate?: ejs.AsyncTemplateFunction;

  // Font in entry.
  static font?: gui.Font;

  // Height limitations of entry view.
  static entryHeights?: {
    max: number;
    min: number;
  };

  isSending = false;
  browser: gui.Browser;
  input: InputView;
  replyButton: IconButton;
  menuButton: IconButton;

  #parsedMessage?: {
    isMarkdown: boolean,
    html: string,
  };
  #lastError?: Error;

  #buttonMode: ButtonMode = 'send';
  #placeholder?: gui.Container;
  #textWindows: Record<number, TextWindow> = {};

  constructor(service: ChatService) {
    if (!(service instanceof ChatService))
      throw new Error('ChatView can only be used with ChatService');
    super(service);

    this.view.setStyle({flex: 1});
    if (process.platform == 'win32')
      this.view.setBackgroundColor('#E5E5E5');

    this.#placeholder = gui.Container.create();
    this.#placeholder.setStyle({flex: 1});
    if (this.darkMode)
      this.#placeholder.setBackgroundColor(style.bgColorDarkMode);
    else
      this.#placeholder.setBackgroundColor('#FFF');
    this.view.addChildView(this.#placeholder);

    this.browser = gui.Browser.create({
      devtools: true,
      contextMenu: true,
      allowFileAccessFromFiles: true,
      hardwareAcceleration: false,
    });
    this.browser.setStyle({flex: 1});
    if (this.darkMode)
      this.browser.setBackgroundColor(style.bgColorDarkMode);

    // Font style should be the same with messages.
    if (!ChatView.font)
      ChatView.font = gui.Font.create(gui.Font.default().getName(), 15, 'normal', 'normal');

    this.input = new InputView();
    if (process.platform == 'win32')
      this.input.view.setBackgroundColor('#E5E5E5');
    this.input.view.setStyle({margin: style.chatViewPadding});
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

    this.#setupBrowser();

    this.replyButton = new IconButton('send');
    this.replyButton.view.setTooltip(getTooltipForMode('send'));
    this.replyButton.onClick = this.#onButtonClick.bind(this);
    this.input.addButton(this.replyButton);

    this.menuButton = new IconButton('menu');
    this.menuButton.onClick = this.#onMenuButton.bind(this);
    this.input.addButton(this.menuButton);
  }

  destructor() {
    this.unload();
    this.input.destructor();
    this.service.aborter?.abort();
    super.destructor();
  }

  initAsMainView() {
    this.loadChatService(this.service);
  }

  onFocus() {
    this.input.entry.focus();
  }

  async loadChatService(service: ChatService) {
    this.unload();
    this.service = service;
    this.connections.add(
      this.service.onMessageDelta.connect(this.#onMessageDelta.bind(this)));

    // Delay loading the templates for rendering conversation.
    if (!ChatView.pageTemplate) {
      await Promise.all([
        (async () => {
          const filename = path.join(assetsDir, 'view', 'page.html');
          const html = await fs.readFile(filename);
          ChatView.pageTemplate = await ejs.compile(html.toString(), {filename, async: true});
        })(),
        (async () => {
          const filename = path.join(assetsDir, 'view', 'message.html');
          const html = await fs.readFile(filename);
          ChatView.messageTemplate = await ejs.compile(html.toString(), {filename, async: true});
        })(),
      ]);
    }
    // Render.
    const data = {
      style,
      history: this.service.history.map(messageToDom.bind(null, this.service)),
    };
    this.browser.loadHTML(await ChatView.pageTemplate(data), 'https://chie.app');
  }

  unload() {
    for (const win of Object.values(this.#textWindows))
      win.window.close();
    this.connections.disconnectAll();
    this.#parsedMessage = null;
  }

  async addMessage(message: Partial<ChatMessage>, response?: {pending: boolean}) {
    const html = await ChatView.messageTemplate({
      message: messageToDom(this.service, message, this.service.history.length),
      response,
    });
    await this.executeJavaScript(`window.addMessage(${JSON.stringify(html)})`);
  }

  async regenerateLastMessage() {
    this.#parsedMessage = null;
    this.executeJavaScript('window.regenerateLastMessage()');
    const promise = this.service.regenerateResponse({});
    await this.#startSending(promise);
  }

  async clearHistory() {
    this.#parsedMessage = null;
    this.executeJavaScript('window.clearHistory()');
    this.input.entry.focus();
    await this.service.clear();
  }

  getDraft(): string | null {
    if (this.isSending)
      return null;
    const content = this.input.entry.getText();
    if (content.trim().length == 0)
      return null;
    return content;
  }

  executeJavaScript(js: string) {
    return new Promise<boolean>((resolve) => this.browser.executeJavaScript(js, resolve));
  }

  async #setupBrowser() {
    // Add bindings to the browser.
    this.browser.setBindingName('chie');
    this.browser.addBinding('focusEntry', this.input.entry.focus.bind(this.input.entry));
    this.browser.addBinding('domReady', this.#domReady.bind(this));
    this.browser.addBinding('catchDomError', this.#catchDomError.bind(this));
    this.browser.addBinding('log', this.#log.bind(this));
    this.browser.addBinding('highlightCode', this.#highlightCode.bind(this));
    this.browser.addBinding('copyText', this.#copyText.bind(this));
    this.browser.addBinding('showTextAt', this.#showTextAt.bind(this));
    this.browser.addBinding('copyTextAt', this.#copyTextAt.bind(this));
    this.browser.addBinding('openLink', this.#openLink.bind(this));
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
    if (this.isSending)  // should never happen
      throw new Error('Sending message while a message is being received');
    const content = this.getDraft();
    if (!content)
      return false;
    const message = {role: ChatRole.User, content};
    (async () => {
      // Append user's reply directly.
      await this.addMessage(message);
      // Show a pending message.
      await this.addMessage({role: ChatRole.Assistant}, {pending: true});
    })();
    // Send message.
    this.#startSending(this.service.sendMessage(message));
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
      this.regenerateLastMessage();
    }
  }

  // User clicks on the menu button.
  #onMenuButton() {
    const menu = gui.Menu.create([
      {
        label: 'Regenerate response',
        enabled: this.service.history.length > 0,
        onClick: () => this.regenerateLastMessage(),
      },
      {
        label: 'Clear',
        enabled: this.service.history.length > 0,
        onClick: () => this.clearHistory(),
      },
    ]);
    menu.popup();
  }

  // Message being received.
  #onMessageDelta(delta: Partial<ChatMessage>, response) {
    if (delta.content) {
      if (this.#parsedMessage) {
        // Get html of full message.
        const isMarkdown = this.#parsedMessage.isMarkdown || veryLikelyMarkdown(delta.content);
        let html = this.service.pendingMessage.content + delta.content;
        if (isMarkdown)
          html = renderMarkdown(html);
        else
          html = escapeText(html);
        // Pass the delta to browser.
        const pos = findStartOfDifference(this.#parsedMessage.html, html);
        const back = this.#parsedMessage.html.length - pos;
        const substr = html.substr(pos);
        this.#parsedMessage = {isMarkdown, html};
        this.executeJavaScript(`window.updatePending(${JSON.stringify(substr)}, ${back})`);
      } else {
        // This is the first part of message, just update.
        const isMarkdown = veryLikelyMarkdown(delta.content);
        this.#parsedMessage = {
          isMarkdown,
          html: isMarkdown ? renderMarkdown(delta.content) : escapeText(delta.content),
        };
        this.executeJavaScript(`window.updatePending(${JSON.stringify(this.#parsedMessage.html)})`);
      }
    }
    if (response.pending)  // more messages coming
      return;
    this.#parsedMessage = null;
  }

  // Handle UI changes after sending messages.
  async #startSending(promise: Promise<void>) {
    // Prevent editing until sent.
    this.isSending = true;
    this.#setButtonMode('stop');
    this.input.setEntryEnabled(false);
    this.input.setText('');
    // Wait for sending.
    try {
      this.#lastError = null;
      await promise;
      this.input.setEntryEnabled(true);
      this.input.entry.focus();
    } catch (error) {
      this.#lastError = error;
      await this.executeJavaScript(`window.markError(${JSON.stringify(error.message)})`);
    } finally {
      this.isSending = false;
      this.#resetUIState();
      if (this.service.aborter?.signal.aborted)
        this.executeJavaScript('window.markAborted()');
      this.executeJavaScript('window.endPending()');
    }
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
      this.input.entry.focus();
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

  // Browser bindings used inside the browser view.
  async #domReady() {
    // Only show browser when it is loaded, this can remove the white flash.
    if (this.#placeholder) {
      this.view.removeChildView(this.#placeholder);
      this.view.addChildViewAt(this.browser, 0);
      this.#placeholder = null;
    }
    // There might be pending message when the service is loaded.
    if (this.service.pendingMessage) {
      await this.addMessage({role: ChatRole.Assistant}, {pending: true});
      this.#onMessageDelta(this.service.pendingMessage, {pending: true});
      this.#startSending(this.service.pendingPromise);
    } else {
      this.#resetUIState();
    }
  }

  #catchDomError(message: string) {
    console.error('Error in browser:', message);
  }

  #log(...args) {
    console.log(...args);
  }

  #highlightCode(text: string, language: string, callbackId: number) {
    const code = highlightCode(text, language);
    this.executeJavaScript(`window.executeCallback(${callbackId}, ${JSON.stringify(code)})`);
  }

  #copyText(text: string) {
    gui.Clipboard.get().setText(text);
  }

  #showTextAt(index: number, textBounds: gui.RectF) {
    if (index in this.#textWindows) {
      this.#textWindows[index].window.activate();
      return;
    }
    const text = this.service.history[index].content;
    const win = new TextWindow(text);
    this.#textWindows[index] = win;
    win.window.onClose = () => delete this.#textWindows[index];
    win.showAt(textBounds);
  }

  #copyTextAt(index: number) {
    this.#copyText(this.service.history[index].content);
  }

  #openLink(url: string) {
    open(url);
  }
}

// Register chie:// protocol to work around CROS problem with file:// protocol.
gui.Browser.registerProtocol('chie', (url) => {
  const u = new URL(url);
  if (u.host !== 'app-file')
    return gui.ProtocolStringJob.create('text/plain', 'Unsupported type');
  const p = realpathSync(`${__dirname}/../..${u.pathname}`);
  return gui.ProtocolFileJob.create(p);
});

// Remove protocol on exit to work around crash.
process.on('exit', () => {
  gui.Browser.unregisterProtocol('chie');
});

// Translate the message into data to be parsed by EJS template.
function messageToDom(service: ChatService, message: Partial<ChatMessage>, index: number) {
  if (!message.role)  // should not happen
    throw new Error('Role of message expected for serialization.');
  let content = message.content;
  if (content && message.role == ChatRole.Assistant && veryLikelyMarkdown(content))
    content = renderMarkdown(content, {highlight: true});
  else
    content = escapeText(content);
  const sender = {
    [ChatRole.User]: 'You',
    [ChatRole.Assistant]: service.name,
    [ChatRole.System]: 'System',
  }[message.role];
  let avatar = null;
  if (message.role == ChatRole.Assistant && service.api.icon)
    avatar = service.api.icon.getChieUrl();
  return {role: message.role, sender, avatar, content, index};
}

// Find the common prefix of two strings.
function findStartOfDifference(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; ++i) {
    if (a[i] != b[i])
      return i;
  }
  return max;
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
