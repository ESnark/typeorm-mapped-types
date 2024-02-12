import type { Type } from '@nestjs/common';
import type { MappedType } from '@nestjs/mapped-types';
import type { RemoveFieldsWithType } from '@nestjs/mapped-types/dist/types/remove-fields-with-type.type';
import {
  inheritPropertyInitializers,
  inheritTypeOrmMetadata,
} from './type-helpers.utils';

export function PickType<T, K extends keyof T>(
  classRef: Type<T>,
  keys: readonly K[],
) {
  const isInheritedPredicate = (propertyKey: string) =>
    keys.includes(propertyKey as K);

  abstract class PickClassType {
    constructor() {
      inheritPropertyInitializers(this, classRef, isInheritedPredicate);
    }
  }

  inheritTypeOrmMetadata(classRef, PickClassType, isInheritedPredicate);

  return PickClassType as MappedType<
    RemoveFieldsWithType<Pick<T, (typeof keys)[number]>, Function>
  >;
}
