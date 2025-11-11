import * as migration_20251111_211150 from './20251111_211150';

export const migrations = [
  {
    up: migration_20251111_211150.up,
    down: migration_20251111_211150.down,
    name: '20251111_211150'
  },
];
