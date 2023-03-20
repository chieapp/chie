export default interface Serializable {
  serialize(): object;
  deserialize(config: object): void;
}
