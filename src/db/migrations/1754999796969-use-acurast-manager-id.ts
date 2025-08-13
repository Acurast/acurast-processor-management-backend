import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseAcurastManagerId1754999796969 implements MigrationInterface {
  name = 'UseAcurastManagerId1754999796969';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manager" DROP COLUMN "acurastManagerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "processor" DROP CONSTRAINT "FK_aaad925d9440126b71b177ec626"`,
    );
    await queryRunner.query(
      `ALTER TABLE "manager" ALTER COLUMN "id" DROP DEFAULT`,
    );
    await queryRunner.query(`DROP SEQUENCE "manager_id_seq"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_b5e9811a1fc68883b3c3b27ef9" ON "manager" ("address") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_372b672bc375d43e2fc4dd66c8" ON "processor" ("address") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aaad925d9440126b71b177ec62" ON "processor" ("managerId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "processor" ADD CONSTRAINT "FK_aaad925d9440126b71b177ec626" FOREIGN KEY ("managerId") REFERENCES "manager"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "processor" DROP CONSTRAINT "FK_aaad925d9440126b71b177ec626"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aaad925d9440126b71b177ec62"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_372b672bc375d43e2fc4dd66c8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b5e9811a1fc68883b3c3b27ef9"`,
    );
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "manager_id_seq" OWNED BY "manager"."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "manager" ALTER COLUMN "id" SET DEFAULT nextval('"manager_id_seq"')`,
    );
    await queryRunner.query(
      `ALTER TABLE "processor" ADD CONSTRAINT "FK_aaad925d9440126b71b177ec626" FOREIGN KEY ("managerId") REFERENCES "manager"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "manager" ADD "acurastManagerId" integer NOT NULL`,
    );
  }
}
