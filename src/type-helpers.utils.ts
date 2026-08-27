import { Type } from './interface';

/**
 * Vendored from @nestjs/mapped-types (MIT) so that importing this package
 * does not pull in the @nestjs/common peer dependency chain at runtime.
 */
export function inheritPropertyInitializers(
  target: Record<string, any>,
  sourceClass: Type<any>,
  isPropertyInherited: (key: string) => boolean = () => true,
) {
  try {
    const tempInstance = new sourceClass();
    Object.getOwnPropertyNames(tempInstance)
      .filter(
        (propertyName) =>
          typeof tempInstance[propertyName] !== 'undefined' &&
          typeof target[propertyName] === 'undefined',
      )
      .filter((propertyName) => isPropertyInherited(propertyName))
      .forEach((propertyName) => {
        target[propertyName] = tempInstance[propertyName];
      });
  } catch {}
}

/**
 * Resolves the property names an index/unique refers to. TypeORM accepts
 * either a string[] of property names or a function like
 * `(entity) => [entity.a, entity.b]`; the function form is resolved against
 * a proxy that echoes property names, mirroring TypeORM's propertiesMap.
 * Returns undefined when the columns cannot be resolved.
 */
function referencedPropertyNames(columns: unknown): string[] | undefined {
  if (Array.isArray(columns)) {
    return columns.map(String);
  }
  if (typeof columns === 'function') {
    try {
      const propertiesMap = new Proxy({}, { get: (_, prop) => String(prop) });
      const resolved = columns(propertiesMap);
      if (Array.isArray(resolved)) {
        return resolved.map(String);
      }
      if (resolved && typeof resolved === 'object') {
        return Object.keys(resolved);
      }
    } catch {}
  }
  return undefined;
}

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

  const targetGenerations = metadataArgsStorage.generations.filter(
    (generation) => generation.target === parentClass && isPropertyInherited(generation.propertyName),
  );
  metadataArgsStorage.generations.push(
    ...targetGenerations.map((generation) => ({
      ...generation,
      target: targetClass,
    })),
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

  // An index/unique referencing a property that is not inherited would point
  // at a column the new entity does not have, so it is only copied when every
  // referenced property is inherited (or when the reference cannot be resolved).
  const targetIndices = metadataArgsStorage.indices.filter((index) => {
    if (index.target !== parentClass) return false;
    const properties = referencedPropertyNames(index.columns);
    return properties === undefined || properties.every(isPropertyInherited);
  });
  metadataArgsStorage.indices.push(
    ...targetIndices.map((index) => ({ ...index, target: targetClass })),
  );

  const targetUniques = metadataArgsStorage.uniques.filter((unique) => {
    if (unique.target !== parentClass) return false;
    const properties = referencedPropertyNames(unique.columns);
    return properties === undefined || properties.every(isPropertyInherited);
  });
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
