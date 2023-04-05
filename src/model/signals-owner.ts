import gui from 'gui';
import {SignalConnection, SignalConnections} from 'typed-signals';

class YueSignal<T> implements SignalConnection {
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
    this.connections.add(new YueSignal<T>(signal, callback));
  }
}
