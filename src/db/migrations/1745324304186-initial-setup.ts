import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSetup1745324304186 implements MigrationInterface {
  name = 'InitialSetup1745324304186';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "processor" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, CONSTRAINT "UQ_372b672bc375d43e2fc4dd66c86" UNIQUE ("address"), CONSTRAINT "PK_ca61b8f346004bfab72b06ca91d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "network_type" ("id" SERIAL NOT NULL, "type" character varying NOT NULL, CONSTRAINT "UQ_65e52e436cb98411423010f92fe" UNIQUE ("type"), CONSTRAINT "PK_e0cedfd9d2bf4a7caf8f65329f1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "battery_health" ("id" SERIAL NOT NULL, "state" character varying NOT NULL, CONSTRAINT "UQ_ebc860e63375b6dcd5da75605bc" UNIQUE ("state"), CONSTRAINT "PK_09760952e0185686db945bbef64" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ssid" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_53f5bb830449f97c0a5f8c2aef4" UNIQUE ("name"), CONSTRAINT "PK_fee77ff26325c84ad6f515e9835" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "temperature_reading" ("id" SERIAL NOT NULL, "type" character varying NOT NULL, "value" double precision NOT NULL, "deviceStatusId" integer, CONSTRAINT "PK_ba14eb110583febfe25e7cda749" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_98bde82e4907a7989419c6b70b" ON "temperature_reading" ("type", "value") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b5dba063b69522a6ca6f246e1d" ON "temperature_reading" ("deviceStatusId", "type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "device_status" ("id" SERIAL NOT NULL, "timestamp" bigint NOT NULL, "batteryLevel" double precision NOT NULL, "isCharging" boolean NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "processorId" integer, "batteryHealthId" integer, "networkTypeId" integer, "ssidId" integer, CONSTRAINT "UQ_ff9b1f100a513d9e5e67e178582" UNIQUE ("processorId", "timestamp"), CONSTRAINT "PK_3924a3d59d98b717232f8f94935" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "temperature_reading" ADD CONSTRAINT "FK_6f3a2319867fab8907650155685" FOREIGN KEY ("deviceStatusId") REFERENCES "device_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_status" ADD CONSTRAINT "FK_c5092e86865722c1a74ed6566e4" FOREIGN KEY ("processorId") REFERENCES "processor"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_status" ADD CONSTRAINT "FK_686e03c6eee3a98754eef113263" FOREIGN KEY ("batteryHealthId") REFERENCES "battery_health"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_status" ADD CONSTRAINT "FK_8f9b165477fef8f25325af0c774" FOREIGN KEY ("networkTypeId") REFERENCES "network_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_status" ADD CONSTRAINT "FK_cb0eb688c50199e8fdc2173b64e" FOREIGN KEY ("ssidId") REFERENCES "ssid"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_status" DROP CONSTRAINT "FK_cb0eb688c50199e8fdc2173b64e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_status" DROP CONSTRAINT "FK_8f9b165477fef8f25325af0c774"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_status" DROP CONSTRAINT "FK_686e03c6eee3a98754eef113263"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_status" DROP CONSTRAINT "FK_c5092e86865722c1a74ed6566e4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "temperature_reading" DROP CONSTRAINT "FK_6f3a2319867fab8907650155685"`,
    );
    await queryRunner.query(`DROP TABLE "device_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b5dba063b69522a6ca6f246e1d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_98bde82e4907a7989419c6b70b"`,
    );
    await queryRunner.query(`DROP TABLE "temperature_reading"`);
    await queryRunner.query(`DROP TABLE "ssid"`);
    await queryRunner.query(`DROP TABLE "battery_health"`);
    await queryRunner.query(`DROP TABLE "network_type"`);
    await queryRunner.query(`DROP TABLE "processor"`);
  }
}
