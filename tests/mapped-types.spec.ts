import 'reflect-metadata';
import {
  Check,
  Column,
  Entity,
  Exclusion,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  getMetadataArgsStorage,
} from 'typeorm';
import { OmitType, PickType } from '../src';

const storage = () => getMetadataArgsStorage();

const columnNames = (target: Function) =>
  storage()
    .columns.filter((column) => column.target === target)
    .map((column) => column.propertyName)
    .sort();

const indexNames = (target: Function) =>
  storage()
    .indices.filter((index) => index.target === target)
    .map((index) => index.name);

@Entity('users')
@Index('IDX_EMAIL_PASSWORD', ['email', 'password'])
@Unique('UQ_EMAIL_PASSWORD', ['email', 'password'])
class UserModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index('IDX_EMAIL')
  email: string;

  @Column()
  password: string;

  @Column({ default: 'user' })
  role: string = 'user';
}

describe('PickType', () => {
  const Picked = PickType(UserModel, ['id', 'email'] as const);

  it('copies only the picked columns', () => {
    expect(columnNames(Picked)).toEqual(['email', 'id']);
  });

  it('copies the table metadata', () => {
    const table = storage().tables.find((t) => t.target === Picked);
    expect(table?.name).toBe('users');
  });

  it('keeps the generation strategy of picked primary columns', () => {
    const generations = storage().generations.filter((g) => g.target === Picked);
    expect(generations.map((g) => g.propertyName)).toEqual(['id']);
  });

  it('drops indices referencing non-picked columns', () => {
    expect(indexNames(Picked)).toEqual(['IDX_EMAIL']);
  });

  it('drops uniques referencing non-picked columns', () => {
    expect(storage().uniques.filter((u) => u.target === Picked)).toHaveLength(0);
  });
});

describe('OmitType', () => {
  const Omitted = OmitType(UserModel, ['password'] as const);

  it('copies all but the omitted columns', () => {
    expect(columnNames(Omitted)).toEqual(['email', 'id', 'role']);
  });

  it('drops indices and uniques referencing omitted columns', () => {
    expect(indexNames(Omitted)).toEqual(['IDX_EMAIL']);
    expect(storage().uniques.filter((u) => u.target === Omitted)).toHaveLength(0);
  });

  it('keeps multi-column indices and uniques when no referenced column is omitted', () => {
    const Full = OmitType(UserModel, [] as const);
    expect(indexNames(Full).sort()).toEqual(['IDX_EMAIL', 'IDX_EMAIL_PASSWORD']);
    expect(storage().uniques.filter((u) => u.target === Full)).toHaveLength(1);
  });

  it('inherits property initializers of kept properties', () => {
    const instance = new Omitted();
    expect(instance.role).toBe('user');
  });
});

describe('relations', () => {
  class Photo {}

  class PhotoOwner {
    @Column()
    name: string;

    @ManyToOne(() => Photo)
    photo: Photo;
  }

  it('are copied only when the property is kept', () => {
    const WithPhoto = OmitType(PhotoOwner, [] as const);
    const WithoutPhoto = PickType(PhotoOwner, ['name'] as const);
    expect(storage().relations.filter((r) => r.target === WithPhoto)).toHaveLength(1);
    expect(storage().relations.filter((r) => r.target === WithoutPhoto)).toHaveLength(0);
  });
});

describe('function-style index columns', () => {
  @Index('IDX_FN', (entity: FnModel) => [entity.a, entity.b])
  class FnModel {
    @Column()
    a: string;

    @Column()
    b: string;
  }

  it('resolves referenced properties and filters accordingly', () => {
    const OnlyA = PickType(FnModel, ['a'] as const);
    expect(indexNames(OnlyA)).toEqual([]);

    const Both = PickType(FnModel, ['a', 'b'] as const);
    expect(indexNames(Both)).toEqual(['IDX_FN']);
  });
});

describe('check and exclusion constraints', () => {
  @Check('CHK_AGE', '"age" > 0')
  @Check('CHK_TITLE', `"title" <> ''`)
  @Exclusion('EXCL_PERIOD', 'USING gist ("period" WITH &&)')
  class ProfileModel {
    @Column()
    age: number;

    @Column()
    title: string;

    @Column({ name: 'period' })
    validityPeriod: string;
  }

  const checkNames = (target: Function) =>
    storage()
      .checks.filter((check) => check.target === target)
      .map((check) => check.name)
      .sort();

  const exclusionNames = (target: Function) =>
    storage()
      .exclusions.filter((exclusion) => exclusion.target === target)
      .map((exclusion) => exclusion.name);

  it('copies every constraint when no column is dropped', () => {
    const Full = OmitType(ProfileModel, [] as const);

    expect(checkNames(Full)).toEqual(['CHK_AGE', 'CHK_TITLE']);
    expect(exclusionNames(Full)).toEqual(['EXCL_PERIOD']);
  });

  it('drops the constraints whose expression references a dropped column', () => {
    const WithoutAge = OmitType(ProfileModel, ['age'] as const);

    expect(checkNames(WithoutAge)).toEqual(['CHK_TITLE']);
    expect(exclusionNames(WithoutAge)).toEqual(['EXCL_PERIOD']);
  });

  it('recognises a dropped column by the name given to @Column', () => {
    const WithoutPeriod = OmitType(ProfileModel, ['validityPeriod'] as const);

    expect(checkNames(WithoutPeriod)).toEqual(['CHK_AGE', 'CHK_TITLE']);
    expect(exclusionNames(WithoutPeriod)).toEqual([]);
  });

  it('keeps only the constraints a picked column can satisfy', () => {
    const OnlyTitle = PickType(ProfileModel, ['title'] as const);

    expect(checkNames(OnlyTitle)).toEqual(['CHK_TITLE']);
    expect(exclusionNames(OnlyTitle)).toEqual([]);
  });
});
