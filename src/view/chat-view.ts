import fs from 'node:fs/promises';
import path from 'node:path';
import ejs from 'ejs';
import gui from 'gui';
import {SignalBinding} from 'type-signals';

import {renderMarkdown} from './markdown';
import ChatService, {ChatRole, ChatMessage} from '../model/chat-service';

const assetsDir = path.join(__dirname, '../../assets/view');

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
  #pendingMessageHtml?: string;
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
      ChatView.imageRefresh = gui.Image.createFromPath(path.join(assetsDir, 'refresh@2x.png'));
      ChatView.imageSend = gui.Image.createFromPath(path.join(assetsDir, 'send@2x.png'));
      ChatView.imageStop = gui.Image.createFromPath(path.join(assetsDir, 'stop@2x.png'));
    }
    this.#setButtonMode('send');
    inputArea.addChildView(this.button);

    this.#bindings.push(this.service.onPartialMessage.add(this.#onPartialMessage.bind(this)));
  }

  unload() {
    for (const binding of this.#bindings)
      binding.detach();
  }

  async addMessage(message: Partial<ChatMessage>, response?: {pending: boolean}) {
    const html = await ChatView.messageTemplate({
      message: messageToDom(message),
      response,
    });
    await this.executeJavaScript(`window.addMessage(${JSON.stringify(html)})`);
  }

  getDraft(): string | null {
    if (this.isSending)
      return null;
    const content = this.entry.getText().trim();
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
          const filename = path.join(assetsDir, 'page.html');
          const html = await fs.readFile(filename);
          ChatView.pageTemplate = await ejs.compile(html.toString(), {filename, async: true});
        })(),
        (async () => {
          const filename = path.join(assetsDir, 'message.html');
          const html = await fs.readFile(filename);
          ChatView.messageTemplate = await ejs.compile(html.toString(), {filename, async: true});
        })(),
      ]);
    }
    // Render.
    const data = {history: this.service.history.map(messageToDom)};
    this.browser.loadHTML(await ChatView.pageTemplate(data), 'https://app');
    // Add bindings to the browser.
    this.browser.setBindingName('chie');
    this.browser.addBinding('notifyReady', this.#notifyReady.bind(this));
    this.browser.addBinding('fetchImage', this.#fetchImage.bind(this));
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
    if (this.#buttonMode == 'send') {
      this.#onEnter();
    } else if (this.#buttonMode == 'stop') {
      this.#aborter.abort();
    } else if (this.#buttonMode == 'refresh') {
      this.#pendingMessageHtml = null;
      this.executeJavaScript('window.clearPending()');
      this.#aborter = new AbortController();
      const promise = this.service.regenerateResponse({signal: this.#aborter.signal});
      this.#startSending(promise);
    }
    // Success of action always change button mode, which then enables the
    // button in it.
    this.button.setEnabled(false);
  }

  // Message being received.
  #onPartialMessage(message: Partial<ChatMessage>, response) {
    if (message.content) {
      if (this.#pendingMessageHtml) {
        // Get html of full message.
        const html = renderMarkdown(this.service.pendingMessage.content + message.content);
        // Pass the delta to browser.
        const pos = findStartOfDifference(this.#pendingMessageHtml, html);
        const back = this.#pendingMessageHtml.length - pos;
        const delta = html.substr(pos);
        this.#pendingMessageHtml = html;
        this.executeJavaScript(`window.updatePending(${JSON.stringify(delta)}, ${back})`);
      } else {
        // This is the first part of message, just update.
        this.#pendingMessageHtml = renderMarkdown(message.content);
        this.executeJavaScript(`window.updatePending(${JSON.stringify(this.#pendingMessageHtml)})`);
      }
    }
    if (response.pending)  // more messages coming
      return;
    this.#pendingMessageHtml = null;
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
      console.log(error);
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
  #notifyReady() {
    this.entry.focus();
  }

  #fetchImage() {
    // TODO
  }

  #openLink() {
    // TODO
  }

  #openLinkContextMenu() {
    // TODO
  }
}

function messageToDom(message: Partial<ChatMessage>) {
  if (!message.role)  // should not happen
    throw new Error('Role of message expected for serialization.');
  return {
    role: message.role,
    content: message.content ? renderMarkdown(message.content) : undefined,
  };
}

function findStartOfDifference(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; ++i) {
    if (a[i] != b[i])
      return i;
  }
  return max;
}
