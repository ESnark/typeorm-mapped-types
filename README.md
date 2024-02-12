typeorm-mapped-types presents a new way to manage TypeORM entities. You can prototype entities that reflect actual database tables and create new entities appropriate for your domain as needed.

This module is based on [@nestjs/mapped-types](https://github.com/nestjs/mapped-types). However, unlike @nestjs/mapped-types, it does not support [@nestjs/swagger](https://github.com/nestjs/swagger) but only the typeorm decorator. Future versions may include support for @nestjs/swagger.

Available mapped types:

* PickType - constructs a new type (class) by picking a set of properties from an input type
* OmitType - constructs a type by picking all properties from an input type and then removing a particular set of keys
* ~~IntersectionType~~ - (Not implemented) combines two types into one new type

## How to use
```typescript
import { Entity, PrimaryColumn, Column } from 'typeorm';

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
import { UserModel } from './user-model';

@Entity('user')
export class QueriedUser extends PickType(UserModel, ['id', 'email'] as const) {}
```
