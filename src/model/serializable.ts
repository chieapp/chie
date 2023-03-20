export default interface Serializable {
  deserialize(config: object): void;
  serialize(): object;
}
