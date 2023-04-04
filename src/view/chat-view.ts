import fs from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import gui from 'gui';
import opn from 'opn';
import hljs from 'highlight.js';
import {escape} from 'html-escaper';

import AppearanceAware from '../model/appearance-aware';
import ChatService from '../model/chat-service';
import IconButton from './icon-button';
import InputView from './input-view';
import TextWindow from './text-window';
import {renderMarkdown, veryLikelyMarkdown} from './markdown';
import {ChatRole, ChatMessage} from '../model/chat-api';

const assetsDir = path.join(__dirname, '../../assets');

const style = {
  chatViewPadding: 12,
  bgColorDarkMode: '#1B1D21',
};

type ButtonMode = 'refresh' | 'send' | 'stop';

export default class ChatView extends AppearanceAware {
  // EJS templates.
  static pageTemplate?: ejs.AsyncTemplateFunction;
  static messageTemplate?: ejs.AsyncTemplateFunction;

  // Button images.
  static imageRefresh?: gui.Image;
  static imageSend?: gui.Image;
  static imageStop?: gui.Image;
  static imageMenu?: gui.Image;

  // Font in entry.
  static font?: gui.Font;

  // Height limitations of entry view.
  static entryHeights?: {
    max: number;
    min: number;
  };

  service: ChatService;
  isSending = false;

  placeholder: gui.Container;
  browser: gui.Browser;

  input: InputView;
  replyButton: IconButton;
  menuButton: IconButton;
  #buttonMode: ButtonMode = 'send';

  #parsedMessage?: {
    isMarkdown: boolean,
    html: string,
  };
  #aborter?: AbortController;

  #textWindows: Record<number, TextWindow> = {};

  constructor(service: ChatService) {
    super();

    this.service = service;

    this.view.setStyle({flex: 1});
    if (process.platform == 'win32')
      this.view.setBackgroundColor('#E5E5E5');

    this.placeholder = gui.Container.create();
    this.placeholder.setStyle({flex: 1});
    if (this.darkMode)
      this.placeholder.setBackgroundColor(style.bgColorDarkMode);
    else
      this.placeholder.setBackgroundColor('#FFF');
    this.view.addChildView(this.placeholder);

    this.browser = gui.Browser.create({
      devtools: true,
      contextMenu: true,
      allowFileAccessFromFiles: true,
      hardwareAcceleration: false,
    });
    this.browser.setStyle({flex: 1});
    this.browser.setBackgroundColor(style.bgColorDarkMode);
    this.#setupBrowser();

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

    if (!ChatView.imageRefresh) {
      const create = (name) => gui.Image.createFromPath(realpathSync(path.join(assetsDir, 'icons', `${name}@2x.png`)));
      ChatView.imageRefresh = create('refresh');
      ChatView.imageSend = create('send');
      ChatView.imageStop = create('stop');
      ChatView.imageMenu = create('menu');
    }

    this.replyButton = new IconButton(ChatView.imageSend);
    this.replyButton.onClick = this.#onButtonClick.bind(this);
    this.input.addButton(this.replyButton);

    this.menuButton = new IconButton(ChatView.imageMenu);
    this.menuButton.onClick = this.#onMenuButton.bind(this);
    this.input.addButton(this.menuButton);

    this.connections.add(
      this.service.onMessageDelta.connect(this.#onMessageDelta.bind(this)));
  }

  unload() {
    super.unload();
    this.input.unload();
    if (this.#aborter)
      this.#aborter.abort();
    for (const win of Object.values(this.#textWindows))
      win.window.close();
  }

  async addMessage(message: Partial<ChatMessage>, response?: {pending: boolean}) {
    const html = await ChatView.messageTemplate({
      message: messageToDom(this.service, message, this.service.history.length),
      response,
    });
    await this.executeJavaScript(`window.addMessage(${JSON.stringify(html)})`);
  }

  async regenerateLastMessage() {
    if (this.service.history.length == 0)
      return;
    this.#parsedMessage = null;
    this.executeJavaScript('window.regenerateLastMessage()');
    this.#aborter = new AbortController();
    const promise = this.service.regenerateResponse({signal: this.#aborter.signal});
    await this.#startSending(promise);
  }

  async clear() {
    if (this.service.history.length == 0)
      return;
    this.#parsedMessage = null;
    this.executeJavaScript('window.clear()');
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
    return new Promise<boolean>((resolve) => {
      this.browser.executeJavaScript(js, resolve);
    });
  }

  async #setupBrowser() {
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
    // Add bindings to the browser.
    this.browser.setBindingName('chie');
    this.browser.addBinding('focusEntry', this.input.entry.focus.bind(this.input.entry));
    this.browser.addBinding('domReady', this.#domReady.bind(this));
    this.browser.addBinding('catchDomError', this.#catchDomError.bind(this));
    this.browser.addBinding('log', this.#log.bind(this));
    this.browser.addBinding('highlightCode', this.#highlightCode.bind(this));
    this.browser.addBinding('showText', this.#showText.bind(this));
    this.browser.addBinding('copyText', this.#copyText.bind(this));
    this.browser.addBinding('openLink', this.#openLink.bind(this));
    this.browser.addBinding('openLinkContextMenu', this.#openLinkContextMenu.bind(this));
  }

  // User editing in the entry.
  #onTextChange() {
    const text = this.input.entry.getText();
    if (text.length > 0 ||
        this.service.history.length == 0 ||
        !this.service.canRegenerate)
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
    this.#aborter = new AbortController();
    const promise = this.service.sendMessage(message, {signal: this.#aborter.signal});
    this.#startSending(promise);
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
      this.#aborter.abort();
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
        onClick: () => this.clear(),
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
    if (response.aborted)
      this.executeJavaScript('window.markAborted()');
    this.executeJavaScript('window.endPending()');
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
      await promise;
      this.input.setEntryEnabled(true);
      this.input.entry.focus();
      this.input.view.schedulePaint();
    } catch (error) {
      await this.executeJavaScript(`window.markError(${JSON.stringify(error.message)})`);
    } finally {
      this.#setButtonMode(this.service.canRegenerate ? 'refresh' : 'send');
      this.isSending = false;
    }
  }

  // Change button mode.
  #setButtonMode(mode: ButtonMode) {
    if (mode == 'refresh')
      this.replyButton.setImage(ChatView.imageRefresh);
    else if (mode == 'send')
      this.replyButton.setImage(ChatView.imageSend);
    else if (mode == 'stop')
      this.replyButton.setImage(ChatView.imageStop);
    else
      throw new Error(`Invalid button mode: ${mode}`);
    this.replyButton.setEnabled(true);
    this.menuButton.setEnabled(mode != 'stop');
    this.#buttonMode = mode;
  }

  // Browser bindings used inside the browser view.
  #domReady() {
    this.input.entry.focus();
    // Only show browser when it is loaded, this can remove the white flash.
    this.view.removeChildView(this.placeholder);
    this.view.addChildViewAt(this.browser, 0);
  }

  #catchDomError(message: string) {
    console.error('Error in browser:', message);
  }

  #log(...args) {
    console.log(...args);
  }

  #highlightCode(text: string, language: string, callbackId: number) {
    const code = language ?
      hljs.highlight(text, {language, ignoreIllegals: true}).value :
      hljs.highlightAuto(text).value;
    this.executeJavaScript(`window.executeCallback(${callbackId}, ${JSON.stringify(code)})`);
  }

  #showText(index: number, bounds: {width: number}) {
    if (index in this.#textWindows) {
      this.#textWindows[index].activate();
      return;
    }
    const text = this.service.history[index].content;
    const win = new TextWindow(text);
    this.#textWindows[index] = win;
    win.window.onClose = () => delete this.#textWindows[index];
    win.window.setContentSize({
      width: bounds.width + 20,
      height: Math.min(win.input.entry.getTextBounds().height + 50, 400),
    });
    win.activate();
  }

  #copyText(index: number) {
    gui.Clipboard.get().setText(this.service.history[index].content);
  }

  #openLink(url: string) {
    opn(url);
  }

  #openLinkContextMenu() {
    // TODO
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

// Translate the message into data to be parsed by EJS template.
function messageToDom(service: ChatService, message: Partial<ChatMessage>, index: number) {
  if (!message.role)  // should not happen
    throw new Error('Role of message expected for serialization.');
  let content = message.content;
  if (content && message.role == ChatRole.Assistant && veryLikelyMarkdown(content))
    content = renderMarkdown(content);
  else
    content = escapeText(content);
  const sender = {
    [ChatRole.User]: 'You',
    [ChatRole.Assistant]: service.name,
    [ChatRole.System]: 'System',
  }[message.role];
  let avatar = null;
  if (message.role == ChatRole.Assistant)
    avatar = service.api.avatar;
  return {role: message.role, sender, avatar, content, index};
}

// Escape the special HTML characters in plain text message.
function escapeText(str: string) {
  if (!str)
    return '';
  return escape(str).replaceAll('\n', '<br/>');
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
