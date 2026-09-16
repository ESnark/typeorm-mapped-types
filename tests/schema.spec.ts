import 'reflect-metadata';
import {
  Column,
  DataSource,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OmitType, PickType } from '../src';

/**
 * These specs build a real schema through a DataSource instead of inspecting
 * the metadata args storage, so that a relation is only considered inherited
 * when the database it produces actually works.
 */

// @ForeignKey only exists from typeorm 0.3.21 onwards while the supported peer
// range starts at 0.3.20, so it is resolved at runtime rather than imported.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ForeignKey } = require('typeorm') as {
  ForeignKey?: (
    type: () => Function,
    options?: { onDelete?: string },
  ) => PropertyDecorator;
};

@Entity('tags')
class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  label: string;

  @ManyToMany(() => Article, (article) => article.tags)
  articles: Article[];
}

@Entity('teams')
class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}

class ArticleModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  draftNotes: string;

  @ManyToMany(() => Tag, (tag) => tag.articles)
  @JoinTable({
    name: 'article_tags',
    joinColumn: { name: 'article_fk', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_fk', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @ManyToOne(() => Team)
  @JoinColumn({ name: 'team_fk' })
  team: Team;
}

@Entity('articles')
class Article extends OmitType(ArticleModel, ['draftNotes'] as const) {}

@Entity('article_titles')
class ArticleTitle extends PickType(ArticleModel, ['id', 'title'] as const) {}

const createDataSource = (entities: Function[]) =>
  new DataSource({ type: 'sqljs', entities, synchronize: true });

describe('many-to-many inheritance', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createDataSource([Tag, Team, Article]);
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  const articleMetadata = () =>
    dataSource.entityMetadatas.find((entity) => entity.tableName === 'articles')!;

  const junctionMetadata = () =>
    dataSource.entityMetadatas.find((entity) => entity.tableType === 'junction');

  it('keeps the inherited relation on the owning side', () => {
    const relation = articleMetadata().findRelationWithPropertyPath('tags')!;

    expect(relation).toBeDefined();
    expect(relation.relationType).toBe('many-to-many');
    expect(relation.isOwning).toBe(true);
  });

  it('builds the junction table declared by the inherited @JoinTable', () => {
    const junction = junctionMetadata();

    expect(junction).toBeDefined();
    expect(junction!.tableName).toBe('article_tags');
  });

  it('keeps the join column names declared by the inherited @JoinTable', () => {
    const relation = articleMetadata().findRelationWithPropertyPath('tags')!;

    expect(relation.joinColumns.map((column) => column.databaseName)).toEqual([
      'article_fk',
    ]);
    expect(
      relation.inverseJoinColumns.map((column) => column.databaseName),
    ).toEqual(['tag_fk']);
    expect(junctionMetadata()!.columns.map((column) => column.databaseName)).toEqual(
      ['article_fk', 'tag_fk'],
    );
  });

  it('creates the junction table in the database', async () => {
    const tables: { name: string }[] = await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );

    expect(tables.map((table) => table.name)).toContain('article_tags');
  });

  it('persists and reads back both sides of the relation', async () => {
    const tags = await dataSource
      .getRepository(Tag)
      .save([{ label: 'typeorm' }, { label: 'mapped-types' }]);
    const team = await dataSource.getRepository(Team).save({ name: 'core' });

    const saved = await dataSource
      .getRepository(Article)
      .save(Object.assign(new Article(), { title: 'v1', tags, team }));

    const loaded = await dataSource.getRepository(Article).findOne({
      where: { id: saved.id },
      relations: { tags: true },
    });

    expect(loaded!.tags.map((tag) => tag.label).sort()).toEqual([
      'mapped-types',
      'typeorm',
    ]);

    const rows = await dataSource.query('SELECT * FROM article_tags');
    expect(rows).toHaveLength(2);

    const inverse = await dataSource.getRepository(Tag).findOne({
      where: { id: tags[0].id },
      relations: { articles: true },
    });
    expect(inverse!.articles.map((article) => article.title)).toEqual(['v1']);
  });

  it('does not create a junction table when the relation is not inherited', async () => {
    // Tag is left out on purpose: nothing should reference it once the
    // relation is gone.
    const withoutTags = createDataSource([ArticleTitle]);
    await withoutTags.initialize();

    try {
      const titles = withoutTags.entityMetadatas.find(
        (entity) => entity.tableName === 'article_titles',
      )!;

      expect(titles.relations).toHaveLength(0);
      expect(
        withoutTags.entityMetadatas.filter(
          (entity) => entity.tableType === 'junction',
        ),
      ).toHaveLength(0);
    } finally {
      await withoutTags.destroy();
    }
  });
});

describe('many-to-one inheritance', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createDataSource([Tag, Team, Article]);
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  it('keeps the column name declared by the inherited @JoinColumn', () => {
    const articles = dataSource.entityMetadatas.find(
      (entity) => entity.tableName === 'articles',
    )!;

    expect(articles.columns.map((column) => column.databaseName)).toContain(
      'team_fk',
    );
    expect(articles.foreignKeys.map((key) => key.columnNames)).toContainEqual([
      'team_fk',
    ]);
  });
});

describe('standalone @ForeignKey inheritance', () => {
  const itSupportsForeignKey = typeof ForeignKey === 'function' ? it : it.skip;

  itSupportsForeignKey('is inherited with its options', async () => {
    class OrderModel {
      @PrimaryGeneratedColumn()
      id: number;

      @Column()
      teamId: number;

      @Column()
      internalNote: string;
    }
    ForeignKey!(() => Team, { onDelete: 'CASCADE' })(
      OrderModel.prototype,
      'teamId',
    );

    @Entity('orders')
    class Order extends OmitType(OrderModel, ['internalNote'] as const) {}

    const dataSource = createDataSource([Team, Order]);
    await dataSource.initialize();

    try {
      const orders = dataSource.entityMetadatas.find(
        (entity) => entity.tableName === 'orders',
      )!;
      const foreignKey = orders.foreignKeys.find((key) =>
        key.columnNames.includes('teamId'),
      );

      expect(foreignKey).toBeDefined();
      expect(foreignKey!.referencedTablePath).toBe('teams');
      expect(foreignKey!.onDelete).toBe('CASCADE');
    } finally {
      await dataSource.destroy();
    }
  });

  itSupportsForeignKey('is dropped when its property is not inherited', async () => {
    class InvoiceModel {
      @PrimaryGeneratedColumn()
      id: number;

      @Column()
      teamId: number;
    }
    ForeignKey!(() => Team, { onDelete: 'CASCADE' })(
      InvoiceModel.prototype,
      'teamId',
    );

    @Entity('invoices')
    class Invoice extends PickType(InvoiceModel, ['id'] as const) {}

    const dataSource = createDataSource([Team, Invoice]);
    await dataSource.initialize();

    try {
      const invoices = dataSource.entityMetadatas.find(
        (entity) => entity.tableName === 'invoices',
      )!;

      expect(invoices.columns.map((column) => column.databaseName)).toEqual(['id']);
      expect(invoices.foreignKeys).toHaveLength(0);
    } finally {
      await dataSource.destroy();
    }
  });
});
