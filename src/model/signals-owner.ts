import gui from 'gui';
import {SignalConnection, SignalConnections} from 'typed-signals';

class YueConnection<T> implements SignalConnection {
  id: number;
  signal: gui.Signal<T>;
  enabled: true;

  constructor(signal: gui.Signal<T>, callback: T) {
    this.id = signal.connect(callback);
    this.signal = signal;
  }

  disconnect() {
    this.signal.disconnect(this.id);
    return true;
  }
}

export default abstract class SignalsOwner {
  connections: SignalConnections = new SignalConnections();

  destructor() {
    this.connections.disconnectAll();
  }

  // Convert yue signal to SignalConnection.
  connectYueSignal<T>(signal: gui.Signal<T>, callback: T) {
    const connection = new YueConnection<T>(signal, callback);
    this.connections.add(connection);
    return connection;
  }
}
