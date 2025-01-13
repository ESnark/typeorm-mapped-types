export interface Type<T = any> extends Function {
  new (...args: any[]): T;
}

export interface MappedType<T> extends Type<T> {
  new (): T;
}
