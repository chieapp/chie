import fs from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import gui from 'gui';
import hljs from 'highlight.js';
import {escape} from 'html-escaper';
import {SignalBinding} from 'type-signals';

import IconButton from './icon-button';
import InputView from './input-view';
import {renderMarkdown, veryLikelyMarkdown} from './markdown';
import {ChatRole, ChatMessage} from '../model/chat-api';
import ChatService from '../model/chat-service';

const assetsDir = path.join(__dirname, '../../assets');
const chatViewPadding = 10;

type ButtonMode = 'refresh' | 'send' | 'stop';

export default class ChatView {
  // EJS templates.
  static pageTemplate?: ejs.AsyncTemplateFunction;
  static messageTemplate?: ejs.AsyncTemplateFunction;

  // Button images.
  static imageRefresh?: gui.Image;
  static imageSend?: gui.Image;
  static imageStop?: gui.Image;
  static imageMenu?: gui.Image;

  service: ChatService;
  isSending = false;

  view: gui.Container;
  browser: gui.Browser;

  input: InputView;
  replyButton: IconButton;
  menuButton: IconButton;
  #buttonMode: ButtonMode = 'send';

  #subscriptions: SignalBinding[] = [];
  #parsedMessage?: {
    isMarkdown: boolean,
    html: string,
  };
  #aborter?: AbortController;

  constructor(service: ChatService) {
    this.service = service;

    this.view = gui.Container.create();
    this.view.setStyle({flex: 1});

    this.browser = gui.Browser.create({
      devtools: true,
      contextMenu: true,
      allowFileAccessFromFiles: true,
      hardwareAcceleration: false,
    });
    this.browser.setStyle({flex: 1});
    this.#setupBrowser();
    this.view.addChildView(this.browser);

    this.input = new InputView();
    this.input.view.setStyle({margin: chatViewPadding});
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
    this.input.addButton(this.menuButton);

    this.#subscriptions.push(this.service.onMessageDelta.add(this.#onMessageDelta.bind(this)));
  }

  unload() {
    for (const binding of this.#subscriptions)
      binding.detach();
    if (this.#aborter)
      this.#aborter.abort();
  }

  async addMessage(message: Partial<ChatMessage>, response?: {pending: boolean}) {
    const html = await ChatView.messageTemplate({
      message: messageToDom(this.service, message),
      response,
    });
    await this.executeJavaScript(`window.addMessage(${JSON.stringify(html)})`);
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
    const data = {history: this.service.history.map(messageToDom.bind(null, this.service))};
    this.browser.loadHTML(await ChatView.pageTemplate(data), 'https://chie.app');
    // Add bindings to the browser.
    this.browser.setBindingName('chie');
    this.browser.addBinding('focusEntry', this.input.entry.focus.bind(this.input.entry));
    this.browser.addBinding('catchDomError', this.#catchDomError.bind(this));
    this.browser.addBinding('log', this.#log.bind(this));
    this.browser.addBinding('hightCodeBlock', this.#hightCodeBlock.bind(this));
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
      this.#parsedMessage = null;
      this.executeJavaScript('window.regenerateLastMessage()');
      this.#aborter = new AbortController();
      const promise = this.service.regenerateResponse({signal: this.#aborter.signal});
      this.#startSending(promise);
    }
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
    console.log(this.service.pendingMessage);
    console.log(this.#parsedMessage);
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
    this.input.entry.setEnabled(false);
    this.input.setText('');
    // Wait for sending.
    try {
      await promise;
      this.input.entry.setEnabled(true);
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
    this.#buttonMode = mode;
  }

  // Browser bindings used inside the browser view.
  #catchDomError(message: string) {
    console.error('Error in browser:', message);
  }

  #log(...args) {
    console.log(...args);
  }

  #hightCodeBlock(text: string, language: string, callbackId: number) {
    const code = language ?
      hljs.highlight(text, {language, ignoreIllegals: true}).value :
      hljs.highlightAuto(text).value;
    this.executeJavaScript(`window.executeCallback(${callbackId}, ${JSON.stringify(code)})`);
  }

  #openLink() {
    // TODO
  }

  #openLinkContextMenu() {
    // TODO
  }
}

// Register chie:// protocol to work around CROS problem with file:// protocol.
gui.Browser.registerProtocol('chie', (url) => {
  const u = new URL(url);
  if (u.host !== 'file')
    return gui.ProtocolStringJob.create('text/plain', 'Unsupported type');
  const p = realpathSync(`${__dirname}/../..${u.pathname}`);
  return gui.ProtocolFileJob.create(p);
});

// Translate the message into data to be parsed by EJS template.
function messageToDom(service: ChatService, message: Partial<ChatMessage>) {
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
  if (message.role == ChatRole.Assistant) {
    if (service.api.endpoint.type == 'ChatGPT')
      avatar = 'chatgpt';
    else if (service.api.endpoint.type == 'BingChat')
      avatar = 'bingchat';
  }
  return {role: message.role, sender, avatar, content};
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
