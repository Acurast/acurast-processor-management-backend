import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastUpdatedToManager1755089362306
  implements MigrationInterface
{
  name = 'AddLastUpdatedToManager1755089362306';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manager" ADD "lastUpdated" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "manager" DROP COLUMN "lastUpdated"`);
  }
}
