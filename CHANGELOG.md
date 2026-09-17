# Changelog

The section matching the version in `package.json` becomes the body of the
GitHub Release, above the automatically generated commit list. Headings are
`## <version>` exactly, since the release workflow matches on that.

## 1.0.0

Fixes to which TypeORM metadata a mapped class inherits. **These change the
schema TypeORM generates**, so upgrading is not transparent: generate a
migration and review it before deploying.

### Fixed

* `@JoinTable` is now inherited, so an inherited `@ManyToMany` builds its
  junction table. It previously built none at all — no error, the relation
  simply did nothing.
* `@JoinColumn` is now inherited, so `@JoinColumn({ name: 'team_fk' })` keeps
  its column name instead of falling back to the naming strategy's default
  (`teamId`). **Existing databases will see the foreign key column renamed.**
* Standalone `@ForeignKey` constraints are now inherited (typeorm 0.3.21 and
  above, guarded so the supported 0.3.20 floor still works).
* `@Check` and `@Exclusion` are no longer copied when their expression names a
  column the mapped class dropped. They were previously copied unconditionally,
  emitting DDL that referenced columns the table did not have. Those
  expressions are raw SQL, so the match is by column name and errs towards
  dropping the constraint.

### Changed

* Declared `engines` (`node >=16.13.0`) and documented compatibility and the
  inheritance rules in the README.

### Internal

* New schema spec builds a real sql.js DataSource rather than inspecting the
  metadata args storage, covering the junction table name, join column names
  and a persisted many-to-many round trip through both sides.
* CI covers the oldest and newest version of each supported typeorm line across
  node 20/22/24, and runs eslint — which had been failing to start entirely,
  because `.eslintrc.json` referenced a plugin that was never a devDependency.
* Releases publish automatically when the version in `package.json` reaches
  `main`.

### Verified against TypeORM 1.x

No code change was needed for the 1.x release itself: `getMetadataArgsStorage()`
is unchanged, the only `MetadataArgsStorage` differences are two removed arrays
this package never read (`entityRepositories`, `relationCounts`), and decorators
remain legacy `PropertyDecorator`. The suite passes on 0.3.20, 0.3.31, 1.0.0,
1.1.0 and 1.1.1.

## 0.6.0

* Widened the typeorm peer range to `^0.3.20 || ^1.0.0`; the old range made
  installs alongside typeorm 1.x fail with `ERESOLVE`.
* Declared explicit types and an exports map.

## 0.5.0

* Fixed `RemoveFieldsWithType`, which never removed method fields from the
  mapped type.
* Copied generation metadata (`@PrimaryGeneratedColumn` strategy), previously
  lost on derived entities.
* Copied indices and uniques only when every property they reference is
  inherited.
* Vendored `inheritPropertyInitializers` and dropped `@nestjs/mapped-types`,
  whose import chain required `@nestjs/common` at load time.
