// Adapted from @nestjs/mapped-types (MIT)

type KeysWithType<T, Type> = {
  [K in keyof T]: T[K] extends Type ? K : never;
}[keyof T];

export type RemoveFieldsWithType<T, Type> = {
  [K in Exclude<keyof T, KeysWithType<T, Type>>]: T[K];
};
