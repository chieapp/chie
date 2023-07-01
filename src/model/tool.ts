export interface ToolExecutionResult {
  resultForModel: string;
  resultForHuman: string;
}

export interface ToolParamter {
  name: string;
  description: string;
  type: 'string' | 'integer' | 'number';
  enum?: string[];
  optional?: boolean;
}

export default class Tool {
  name: string;
  displayName: string;
  descriptionForModel: string;
  descriptionForHuman?: string;
  parameters: ToolParamter[];
  execute: (signal: AbortSignal, arg?: object) => Promise<ToolExecutionResult>;
}
