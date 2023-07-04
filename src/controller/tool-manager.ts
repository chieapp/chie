import Tool from '../model/tool';
import {ChatToolCall} from '../model/chat-api';
import {Selection} from '../model/param';

export class ToolManager {
  #tools: Record<string, Tool> = {};

  registerTool(tool: Tool) {
    if (tool.name in this.#tools)
      throw new Error(`Tool "${tool.name}" has already been registered.`);
    this.#tools[tool.name] = tool;
  }

  unregisterTool(name: string) {
    const tool = this.getToolByName(name);
    const assistantManager = require('./assistant-manager').default;
    if (assistantManager.getAssistants().find(a => a.tools?.includes(tool)))
      throw new Error(`Can not unregister Tool "${name}" because there is an assistant using it.`);
    delete this.#tools[name];
  }

  getToolByName(name: string) {
    const tool = this.#tools[name];
    if (!tool)
      throw new Error(`There is no Tool named "${name}".`);
    return tool;
  }

  getToolSelections(): Selection[] {
    return Object.values(this.#tools).map(tool => ({name: tool.displayName, value: tool.name}));
  }

  getToolCallDescription(call: ChatToolCall) {
    const tool = this.#tools[call.name];
    const arg = Object.keys(call.arg).map(key => `${key}: ${JSON.stringify(call.arg[key])}`).join(', ');
    return `Tool: ${tool?.displayName ?? call.name}(${arg})`;
  }
}

export default new ToolManager();
