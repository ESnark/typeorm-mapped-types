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
  } catch {
    // The source class may not be constructible without arguments, in which
    // case there are no initializers to read off an instance.
  }
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
    } catch {
      // The function may do something the echoing proxy cannot stand in for;
      // an unresolved reference is reported as such to the caller.
    }
  }
  return undefined;
}

/**
 * The part of typeorm's foreign key metadata this package reads. It is declared
 * here instead of imported because foreign key metadata args only exist from
 * typeorm 0.3.21 onwards, while the supported peer range starts at 0.3.20.
 */
interface ForeignKeyArgs {
  target: Function | string;
  propertyName?: string;
  columnNames?: readonly string[];
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Names by which a raw SQL expression could refer to a column: the property
 * name, and the explicit name given to @Column({ name }) when it differs.
 */
function columnIdentifiers(column: {
  propertyName: string;
  options?: { name?: string };
}): string[] {
  const explicitName = column.options?.name;
  return explicitName ? [column.propertyName, explicitName] : [column.propertyName];
}

export function inheritTypeOrmMetadata(
  parentClass: Type<any>,
  targetClass: Function,
  isPropertyInherited: (propertyKey: string) => boolean,
) {
  // Resolved lazily on purpose: importing typeorm at module load would make it
  // a load-time dependency of this package, and the consumer's own copy is the
  // one whose metadata storage must be written to.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const typeorm: typeof import ('typeorm') = require('typeorm');
  const metadataArgsStorage: import('typeorm/metadata-args/MetadataArgsStorage').MetadataArgsStorage = typeorm.getMetadataArgsStorage();

  /**
   * Appends every entry of `args` that belongs to the parent class and that
   * `shouldInherit` accepts, re-targeted at the derived class.
   */
  const inherit = <T extends { target: Function | string }>(
    args: T[],
    shouldInherit: (entry: T) => boolean = () => true,
  ) => {
    const inherited = args.filter(
      (entry) => entry.target === parentClass && shouldInherit(entry),
    );
    args.push(
      ...inherited.map((entry) => ({ ...entry, target: targetClass }) as T),
    );
  };

  // Resolves whether an index/unique/foreign key only spans properties the
  // derived class keeps; an unresolvable reference is treated as inheritable.
  const referencesOnlyInheritedProperties = (columns: unknown) => {
    const properties = referencedPropertyNames(columns);
    return properties === undefined || properties.every(isPropertyInherited);
  };

  inherit(metadataArgsStorage.tables);
  inherit(metadataArgsStorage.columns, (column) =>
    isPropertyInherited(column.propertyName),
  );
  inherit(metadataArgsStorage.generations, (generation) =>
    isPropertyInherited(generation.propertyName),
  );
  inherit(metadataArgsStorage.relations, (relation) =>
    isPropertyInherited(relation.propertyName),
  );

  // A relation is only the owning side of its foreign key or junction table
  // when its @JoinColumn/@JoinTable comes along, so these follow the relation
  // they belong to. Without them an inherited @ManyToMany would silently stop
  // creating its junction table, and an inherited @JoinColumn({ name }) would
  // fall back to the naming strategy's default column name.
  inherit(metadataArgsStorage.joinColumns, (joinColumn) =>
    isPropertyInherited(joinColumn.propertyName),
  );
  inherit(metadataArgsStorage.joinTables, (joinTable) =>
    isPropertyInherited(joinTable.propertyName),
  );

  const foreignKeys = (
    metadataArgsStorage as unknown as { foreignKeys?: ForeignKeyArgs[] }
  ).foreignKeys;
  if (Array.isArray(foreignKeys)) {
    inherit(foreignKeys, (foreignKey) => {
      // Used on a property, @ForeignKey carries that property's name; used on
      // the class, it names the columns it spans instead.
      if (foreignKey.propertyName) {
        return isPropertyInherited(foreignKey.propertyName);
      }
      return referencesOnlyInheritedProperties(foreignKey.columnNames);
    });
  }

  // An index/unique referencing a property that is not inherited would point
  // at a column the new entity does not have, so it is only copied when every
  // referenced property is inherited (or when the reference cannot be resolved).
  inherit(metadataArgsStorage.indices, (index) =>
    referencesOnlyInheritedProperties(index.columns),
  );
  inherit(metadataArgsStorage.uniques, (unique) =>
    referencesOnlyInheritedProperties(unique.columns),
  );

  // @Check/@Exclusion expressions are raw SQL, so the only way to tell whether
  // one depends on a dropped column is to look for its name in the expression.
  // A false positive drops a constraint that would have been valid, which
  // still yields a schema that synchronizes; keeping an expression that names
  // a missing column does not.
  const droppedColumnNames = metadataArgsStorage.columns
    .filter(
      (column) =>
        column.target === parentClass && !isPropertyInherited(column.propertyName),
    )
    .flatMap(columnIdentifiers);

  const expressionAvoidsDroppedColumns = (expression: string) =>
    !droppedColumnNames.some((name) =>
      new RegExp(`\\b${escapeForRegExp(name)}\\b`).test(expression),
    );

  inherit(metadataArgsStorage.checks, (check) =>
    expressionAvoidsDroppedColumns(check.expression),
  );
  inherit(metadataArgsStorage.exclusions, (exclusion) =>
    expressionAvoidsDroppedColumns(exclusion.expression),
  );

  inherit(metadataArgsStorage.embeddeds, (embedded) =>
    isPropertyInherited(embedded.propertyName),
  );
  inherit(metadataArgsStorage.entityListeners, (entityListener) =>
    isPropertyInherited(entityListener.propertyName),
  );
}
