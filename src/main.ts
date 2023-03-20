export default function main() {
  // Create global controllers.
  require('./controller/api-manager');

  // Read configurations.
  const {config} = require('./controller/config-store');
  config.initFromFile();

  // Enable GC helper.
  require('./util/gc');

  // Capture all errors if succeeded to start.
  require('./util/capture-errors');
}
