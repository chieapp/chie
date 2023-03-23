export default function main() {
  // Create global controllers.
  require('./controller/api-manager');

  // Read configurations.
  const {config} = require('./controller/config-store');
  config.initFromFile();

  // Capture all errors if succeeded to start.
  require('./util/capture-errors');
}
