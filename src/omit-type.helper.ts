import type { Type, MappedType } from "./interface";
import type { RemoveFieldsWithType } from "./types";
import {
  inheritTypeOrmMetadata,
  inheritPropertyInitializers
} from "./type-helpers.utils";

export function OmitType<T, K extends keyof T>(
  classRef: Type<T>,
  keys: readonly K[],
) {
  const isInheritedPredicate = (propertyKey: string) => keys.includes(propertyKey as K) === false;

  abstract class OmitClassType {
    constructor() {
      inheritPropertyInitializers(this, classRef, isInheritedPredicate);
    }
  }

  inheritTypeOrmMetadata(classRef, OmitClassType, isInheritedPredicate);

  return OmitClassType as MappedType<
    RemoveFieldsWithType<Omit<T, (typeof keys)[number]>, Function>
  >;
}