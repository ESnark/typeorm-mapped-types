typeorm-mapped-types presents a new way to manage TypeORM entities. You can prototype entities that reflect actual database tables and create new entities appropriate for your domain as needed.

This module is based on [@nestjs/mapped-types](https://github.com/nestjs/mapped-types). However, unlike @nestjs/mapped-types, it does not support [@nestjs/swagger](https://github.com/nestjs/swagger) but only the typeorm decorator. Future versions may include support for @nestjs/swagger.

Available mapped types:

* PickType - constructs a new type (class) by picking a set of properties from an input type
* OmitType - constructs a type by picking all properties from an input type and then removing a particular set of keys
* ~~IntersectionType~~ - (Not implemented) combines two types into one new type

## Install

```bash
npm install @esnark/typeorm-mapped-types
```

typeorm is a peer dependency, so it is whichever copy your project already has.

## Compatibility

| | Supported |
| --- | --- |
| typeorm | `0.3.20` and above, including `1.x` |
| Node.js | whatever the typeorm version in use requires — `>=16.13.0` for typeorm 0.3.x, `^20.19.0 \|\| ^22.13.0 \|\| >=24.11.0` for typeorm 1.x |
| TypeScript | `experimentalDecorators` and `emitDecoratorMetadata` enabled, as typeorm itself requires |

Both typeorm lines are covered by CI at the oldest and newest version of each.

## How to use

```typescript
import { Column, PrimaryColumn } from 'typeorm';

export class UserModel {
  @PrimaryColumn()
  id: number;

  @Column()
  email: string;

  /** no need for most cases */
  @Column()
  privacyData: string;
}
```

```typescript
import { PickType } from '@esnark/typeorm-mapped-types';
import { Entity } from 'typeorm';
import { UserModel } from './user-model';

@Entity('user')
export class QueriedUser extends PickType(UserModel, ['id', 'email'] as const) {}
```

## What gets inherited

The mapped class receives the metadata the source class registered for the
properties it keeps: `@Entity` table options, `@Column`,
`@PrimaryGeneratedColumn` generation strategies, relations together with their
`@JoinColumn`/`@JoinTable` configuration, standalone `@ForeignKey` constraints
(typeorm 0.3.21 and above), `@Index`, `@Unique`, `@Check`, `@Exclusion`,
embedded columns, entity listeners, and property initializers.

Constraints that cannot apply to the mapped class are left behind rather than
copied, so the resulting schema stays valid:

* an `@Index` or `@Unique` is dropped unless every property it references is kept;
* a `@Check` or `@Exclusion` is dropped when its expression mentions a dropped
  column. Those expressions are raw SQL, so they are matched by column name —
  a constraint whose expression merely happens to contain the name of a dropped
  column is dropped too.

### Known limitations

* `@Tree`, `@TableInheritance`/`@ChildEntity` and `@RelationId` metadata is not
  inherited.
* Table names are copied verbatim, so making an `@Entity` inherit from another
  `@Entity` produces two classes mapped to the same table. Source classes are
  meant to be plain, undecorated prototypes as in the example above.
