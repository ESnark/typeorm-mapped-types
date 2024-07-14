/* eslint-disable @typescript-eslint/no-var-requires */
import { Type } from '@nestjs/common';
export { inheritPropertyInitializers } from '@nestjs/mapped-types';

export function inheritTypeOrmMetadata(
  parentClass: Type<any>,
  targetClass: Function,
  isPropertyInherited: (propertyKey: string) => boolean,
) {
  const typeorm: typeof import ('typeorm') = require('typeorm');
  const metadataArgsStorage: import('typeorm/metadata-args/MetadataArgsStorage').MetadataArgsStorage = typeorm.getMetadataArgsStorage();
  const targetEntity = metadataArgsStorage.tables.find(
    (table) => table.target === parentClass,
  );
  if (targetEntity) {
    metadataArgsStorage.tables.push({
      ...targetEntity,
      target: targetClass,
    });
  }
  const targetColumns = metadataArgsStorage.columns.filter(
    (column) => column.target === parentClass && isPropertyInherited(column.propertyName),
  );
  metadataArgsStorage.columns.push(
    ...targetColumns.map((column) => ({ ...column, target: targetClass })),
  );

  const targetRelations = metadataArgsStorage.relations.filter(
    (relation) => relation.target === parentClass && isPropertyInherited(relation.propertyName),
  );
  metadataArgsStorage.relations.push(
    ...targetRelations.map((relation) => ({
      ...relation,
      target: targetClass,
    })),
  );

  const targetIndices = metadataArgsStorage.indices.filter(
    (index) => index.target === parentClass
  );
  metadataArgsStorage.indices.push(
    ...targetIndices.map((index) => ({ ...index, target: targetClass })),
  );

  const targetUniques = metadataArgsStorage.uniques.filter(
    (unique) => unique.target === parentClass,
  );
  metadataArgsStorage.uniques.push(
    ...targetUniques.map((unique) => ({ ...unique, target: targetClass })),
  );

  const targetChecks = metadataArgsStorage.checks.filter(
    (check) => check.target === parentClass,
  );
  metadataArgsStorage.checks.push(
    ...targetChecks.map((check) => ({ ...check, target: targetClass })),
  );

  const targetExclusions = metadataArgsStorage.exclusions.filter(
    (exclusion) => exclusion.target === parentClass,
  );
  metadataArgsStorage.exclusions.push(
    ...targetExclusions.map((exclusion) => ({
      ...exclusion,
      target: targetClass,
    })),
  );

  const targetEmbeddeds = metadataArgsStorage.embeddeds.filter(
    (embedded) => embedded.target === parentClass && isPropertyInherited(embedded.propertyName),
  );
  metadataArgsStorage.embeddeds.push(
    ...targetEmbeddeds.map((embedded) => ({
      ...embedded,
      target: targetClass,
    })),
  );
  const targetEntityListeners = metadataArgsStorage.entityListeners.filter(
    (entityListener) => entityListener.target === parentClass && isPropertyInherited(entityListener.propertyName),
  );
  metadataArgsStorage.entityListeners.push(
    ...targetEntityListeners.map((entityListener) => ({
      ...entityListener,
      target: targetClass,
    })),
  );
}
