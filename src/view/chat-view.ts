import fs from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import gui from 'gui';
import hljs from 'highlight.js';
import {escape} from 'html-escaper';
import {SignalBinding} from 'type-signals';

import {renderMarkdown, veryLikelyMarkdown} from './markdown';
import {APIEndpointType} from '../model/api-endpoint';
import ChatService, {ChatRole, ChatMessage} from '../model/chat-service';

const assetsDir = path.join(__dirname, '../../assets');

type ButtonMode = 'refresh' | 'send' | 'stop';

export default class ChatView {
  // Height limitations of entry view.
  static entryHeights?: {
    max: number;
    min: number;
  };

  // EJS templates.
  static pageTemplate?: ejs.AsyncTemplateFunction;
  static messageTemplate?: ejs.AsyncTemplateFunction;

  // Button images.
  static imageRefresh?: gui.Image;
  static imageSend?: gui.Image;
  static imageStop?: gui.Image;

  service: ChatService;
  isSending: boolean = false;

  view: gui.Container;
  browser: gui.Browser;
  entry: gui.TextEdit;

  button: gui.Button;
  #buttonMode: ButtonMode = 'send';

  #bindings: SignalBinding[] = [];
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

    const inputArea = gui.Container.create();
    inputArea.setStyle({flexDirection: 'row', padding: 5});
    this.view.addChildView(inputArea);

    this.entry = gui.TextEdit.create();
    if (process.platform != 'win32') {
      // Force using overlay scrollbar.
      this.entry.setOverlayScrollbar(true);
      this.entry.setScrollbarPolicy('never', 'automatic');
    }
    // Font size should be the same with messages.
    const font = gui.Font.create(gui.Font.default().getName(), 15, 'normal', 'normal');
    this.entry.setFont(font);
    // Calculate height for 1 and 5 lines.
    if (!ChatView.entryHeights) {
      this.entry.setText('1');
      const min = this.entry.getTextBounds().height;
      this.entry.setText('1\n2\n3\n4\n5');
      const max = this.entry.getTextBounds().height;
      this.entry.setText('');
      ChatView.entryHeights = {min, max};
    }
    this.entry.setStyle({flex: 1, height: ChatView.entryHeights.min});
    // Handle input events.
    this.entry.onTextChange = this.#onTextChange.bind(this);
    this.entry.shouldInsertNewLine = this.#onEnter.bind(this);
    inputArea.addChildView(this.entry);

    this.button = gui.Button.create({type: 'normal'});
    this.button.setStyle({marginLeft: 5});
    this.button.onClick = this.#onButtonClick.bind(this);
    // This is the only button type can have a small height.
    if (process.platform == 'darwin')
      this.button.setButtonStyle('round-rect');
    if (!ChatView.imageRefresh) {
      const create = (name) => gui.Image.createFromPath(realpathSync(path.join(assetsDir, 'icons', `${name}@2x.png`)));
      ChatView.imageRefresh = create('refresh');
      ChatView.imageSend = create('send');
      ChatView.imageStop = create('stop');
    }
    this.#setButtonMode('send');
    inputArea.addChildView(this.button);

    this.#bindings.push(this.service.onMessageDelta.add(this.#onMessageDelta.bind(this)));
  }

  unload() {
    for (const binding of this.#bindings)
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
    const content = this.entry.getText();
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
    this.browser.addBinding('focusEntry', this.entry.focus.bind(this.entry));
    this.browser.addBinding('hightCodeBlock', this.#hightCodeBlock.bind(this));
    this.browser.addBinding('openLink', this.#openLink.bind(this));
    this.browser.addBinding('openLinkContextMenu', this.#openLinkContextMenu.bind(this));
  }

  // User editing in the entry.
  #onTextChange() {
    this.#adjustEntryHeight();
    const text = this.entry.getText();
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
    // Append user's reply directly.
    const message = {role: ChatRole.User, content};
    this.addMessage(message);
    // Show a pending message.
    this.addMessage({role: ChatRole.Assistant}, {pending: true});
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
    this.button.setEnabled(false);
    // Do the action depending on button mode.
    if (this.#buttonMode == 'send') {
      if (this.getDraft())
        this.#onEnter();
      else
        this.button.setEnabled(true);
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
    this.entry.setEnabled(false);
    this.entry.setText('');
    this.#adjustEntryHeight();
    // Wait for sending.
    try {
      await promise;
      this.entry.setEnabled(true);
      this.entry.focus();
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
      this.button.setImage(ChatView.imageRefresh);
    else if (mode == 'send')
      this.button.setImage(ChatView.imageSend);
    else if (mode == 'stop')
      this.button.setImage(ChatView.imageStop);
    else
      throw new Error(`Invalid button mode: ${mode}`);
    this.button.setEnabled(true);
    this.#buttonMode = mode;
  }

  // Automatically changes the height of entry to show all of user's inputs.
  #adjustEntryHeight() {
    let height = this.entry.getTextBounds().height;
    if (height < ChatView.entryHeights.min)
      height = ChatView.entryHeights.min;
    else if (height > ChatView.entryHeights.max)
      height = ChatView.entryHeights.max;
    this.entry.setStyle({height});
  }

  // Browser bindings used inside the browser view.
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
    if (service.endpoint.type == APIEndpointType.ChatGPT)
      avatar = 'chatgpt';
    else if (service.endpoint.type == APIEndpointType.BingChat)
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
