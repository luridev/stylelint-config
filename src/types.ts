import type { Config } from 'stylelint';

type NativeOverride = NonNullable<Config['overrides']>[number];

export type BaselineAvailability = 'widely' | 'newly' | number;

export type BaselineOptions = {
  available?: BaselineAvailability;
};

export type BemException = {
  files: NativeOverride['files'];
  ignoreBlocks: Array<string | RegExp>;
};

export type BemOptions = {
  exceptions?: Array<BemException>;
};

export type ProtoConfigOptions = {
  baseline?: BaselineOptions;
  bem?: BemOptions;
  config?: Config;
};
