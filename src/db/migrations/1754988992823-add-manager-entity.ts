import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManagerEntity1754988992823 implements MigrationInterface {
  name = 'AddManagerEntity1754988992823';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "manager" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "acurastManagerId" integer NOT NULL, CONSTRAINT "UQ_b5e9811a1fc68883b3c3b27ef94" UNIQUE ("address"), CONSTRAINT "PK_b3ac840005ee4ed76a7f1c51d01" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "processor" ADD "managerId" integer`);
    await queryRunner.query(
      `ALTER TABLE "processor" ADD CONSTRAINT "FK_aaad925d9440126b71b177ec626" FOREIGN KEY ("managerId") REFERENCES "manager"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "processor" DROP CONSTRAINT "FK_aaad925d9440126b71b177ec626"`,
    );
    await queryRunner.query(`ALTER TABLE "processor" DROP COLUMN "managerId"`);
    await queryRunner.query(`DROP TABLE "manager"`);
  }
}
