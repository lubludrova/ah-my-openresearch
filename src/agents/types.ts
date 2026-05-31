// Shape of an agent definition as registered with OpenCode.
// Mirrors the slim pattern (single tier per persona by default).

export type Tier = 'cheap' | 'midtier' | 'frontier' | 'mixed';

export interface AgentDefinition {
  name: string;
  description: string;
  config: {
    model: string;
    temperature: number;
    prompt: string;
  };
}
