import ConfigStore from '../model/config-store';

// The global configs.
export const config = new ConfigStore('config');
export const windowConfig = new ConfigStore('windowStates');
