import ejs from 'ejs';
import fs from 'node:fs/promises';
import gui from 'gui';
import path from 'node:path';

import BrowserView, {style} from './browser-view';
import StreamedMarkdown, {escapeText, highlightCode} from '../util/streamed-markdown';
import {ChatRole, ChatMessage} from '../model/chat-api';

// EJS templates.
let pageTemplate: ejs.AsyncTemplateFunction;
let messageTemplate: ejs.AsyncTemplateFunction;
let initPromise: Promise<[void, void]>;

// Init templates immediately, since it is asynchronous it won't affect UI
// loading and will speed up chat loading later.
initTemplates();

export default class MessagesView extends BrowserView {
  assistantName = 'Bot';
  assistantAvatar = 'chie://app-file/assets/icons/bot.png';
  messagesCount = 0;

  constructor() {
    super();
    // Add bindings to the browser.
    this.browser.addBinding('highlightCode', this.#highlightCode.bind(this));
    this.browser.addBinding('copyText', this.#copyText.bind(this));
    this.browser.addBinding('openLink', this.#openLink.bind(this));
  }

  // Load messages.
  async loadMessages(messages: ChatMessage[]) {
    const data = {
      style,
      messages: messages.map(this.#messageToData.bind(this)),
    };
    await initTemplates();
    this.browser.loadHTML(await pageTemplate(data), 'https://chie.app');
    this.messagesCount = messages.length;
  }

  // Append a message.
  async appendMessage(message: Partial<ChatMessage>, response: {pending: boolean} = {pending: false}) {
    const html = await messageTemplate({
      message: this.#messageToData(message, this.messagesCount++),
      response,
    });
    await this.executeJavaScript(`window.appendMessage(${JSON.stringify(html)})`);
  }

  // Append html to the pending message.
  async appendHtmlToPendingMessage(html: string, back: number = 0) {
    await this.executeJavaScript(`window.appendHtmlToPendingMessage(${JSON.stringify(html)}, ${back ?? 0})`);
  }

  // Mark the pending message as not pending.
  async removePendingMark() {
    await this.executeJavaScript('window.removePendingMark()');
  }

  // Remove all messages.
  async clearMessages() {
    this.messagesCount = 0;
    await this.executeJavaScript('window.clearMessages()');
  }

  // Reset the last message to pending state.
  async resetLastMessageAsPending() {
    await this.executeJavaScript('window.resetLastMessageAsPending()');
  }

  // Add (aborted) label to the pending message.
  async addAbortedLabelToPendingMessage() {
    await this.executeJavaScript('window.addAbortedLabelToPendingMessage()');
  }

  // Show error.
  async appendError(error: string) {
    await this.executeJavaScript(`window.appendError(${JSON.stringify(error)})`);
  }

  // Translate the message into data to be parsed by EJS template.
  #messageToData(message: Partial<ChatMessage>, index: number) {
    if (!message.role)  // should not happen
      throw new Error('Role of message expected for serialization.');
    let content = message.content;
    if (content && message.role == ChatRole.Assistant)
      content = (new StreamedMarkdown({highlight: true})).appendText(content).html;
    else
      content = escapeText(content);
    const sender = {
      [ChatRole.User]: 'You',
      [ChatRole.Assistant]: this.assistantName,
      [ChatRole.System]: 'System',
    }[message.role];
    let avatar = null;
    if (message.role == ChatRole.Assistant)
      avatar = this.assistantAvatar;
    return {role: message.role, sender, avatar, content, index};
  }

  // Browser bindings.
  #highlightCode(text: string, language: string, callbackId: number) {
    const code = highlightCode(text, language);
    this.executeJavaScript(`window.executeCallback(${callbackId}, ${JSON.stringify(code)})`);
  }

  #copyText(text: string) {
    gui.Clipboard.get().setText(text);
  }

  #openLink(url: string) {
    open(url);
  }
}

// Initialize EJS templates, and when there are multiple calls to init, they
// will all wait for the same initialization work.
async function initTemplates() {
  if (pageTemplate && messageTemplate)
    return;
  if (initPromise)
    return initPromise;
  const assetsDir = path.join(__dirname, '../../assets');
  initPromise = Promise.all([
    (async () => {
      const filename = path.join(assetsDir, 'view', 'page.html');
      const html = await fs.readFile(filename);
      pageTemplate = await ejs.compile(html.toString(), {filename, async: true});
    })(),
    (async () => {
      const filename = path.join(assetsDir, 'view', 'message.html');
      const html = await fs.readFile(filename);
      messageTemplate = await ejs.compile(html.toString(), {filename, async: true});
    })(),
  ]);
  await initPromise;
  initPromise = null;
}
