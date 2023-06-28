export interface ExecutionResult {
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
  execute: (arg: object) => Promise<ExecutionResult>;
}
